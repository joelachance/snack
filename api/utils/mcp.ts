import { MCPClient } from '@mastra/mcp';
import { Agent } from '@mastra/core/agent';
import { decryptApiKey } from './crypto';
import { ServerConfigManager } from './storage';
import { UserAuthManager } from './auth';

/**
 * Configuration for an MCP server connection
 */
interface MCPServerConfig {
	url: URL;
	requestInit?: RequestInit;
	timeout?: number;
}

/**
 * Manages MCP server configurations and creates stateless agents with tool access.
 *
 * This class provides a centralized interface for managing Model Context Protocol (MCP) servers,
 * user authentication, and agent creation in a Cloudflare Workers environment. It maintains
 * conversation context using KV storage with Slack thread IDs and ensures proper resource cleanup.
 *
 * @example
 * ```typescript
 * const hub = new McpServerHub(kv);
 *
 * // List available tools for a user
 * const tools = await hub.listAvailTools('user123', 'encryption-key');
 *
 * // Create an agent with conversation history
 * const agent = await hub.createAgentWithMCPTools('user123', 'key', model, history);
 * const response = await agent.generate('Hello!');
 *
 * // Manage server configurations
 * await hub.saveServerToKV('github', 'https://api.github.com');
 * const servers = await hub.loadServersFromKV();
 * ```
 *
 * @since 1.0.0
 */
export class McpServerHub {
	private serverConfig: ServerConfigManager;
	private userAuth: UserAuthManager;

	constructor(private kv: KVNamespace) {
		this.serverConfig = new ServerConfigManager(kv);
		this.userAuth = new UserAuthManager(kv);
	}

	/**
	 * Loads all configured MCP servers from KV storage.
	 *
	 * @returns Promise resolving to object mapping server names to URLs
	 * @example
	 * ```typescript
	 * const servers = await hub.loadServersFromKV();
	 * // Returns: { github: 'https://api.github.com', slack: 'https://slack.com/api' }
	 * ```
	 */
	async loadServersFromKV(): Promise<Record<string, string>> {
		return await this.serverConfig.loadServers();
	}

	/**
	 * Saves a new MCP server configuration to KV storage.
	 *
	 * @param serverName - Name of the server (will be normalized to lowercase)
	 * @param serverUrl - URL of the MCP server (will be normalized to lowercase)
	 * @returns Promise that resolves when server is saved
	 * @example
	 * ```typescript
	 * await hub.saveServerToKV('github', 'https://api.github.com');
	 * ```
	 */
	async saveServerToKV(serverName: string, serverUrl: string): Promise<void> {
		await this.serverConfig.addServer(serverName, serverUrl);
	}

	/**
	 * Removes an MCP server configuration from KV storage.
	 *
	 * @param serverName - Name of the server to remove
	 * @returns Promise that resolves when server is removed
	 * @example
	 * ```typescript
	 * await hub.deleteServerFromKV('github');
	 * ```
	 */
	async deleteServerFromKV(serverName: string): Promise<void> {
		await this.serverConfig.removeServer(serverName);
	}

	/**
	 * Lists available MCP tools for a specific user across all configured servers.
	 *
	 * @param userId - User ID to check authentication for
	 * @param encryptionKey - Optional encryption key for decrypting user API keys
	 * @returns Promise resolving to array of available tool names
	 * @throws {Error} When MCP client creation or tool retrieval fails
	 * @example
	 * ```typescript
	 * const tools = await hub.listAvailTools('user123', 'encryption-key');
	 * // Returns: ['github_search', 'slack_send_message', 'notion_create_page']
	 * ```
	 */
	async listAvailTools(userId: string, encryptionKey?: string): Promise<string[]> {
		// Get all globally configured servers
		const globalServers = await this.loadServersFromKV();
		const servers: Record<string, MCPServerConfig> = {};

		// Build server configurations with user's API keys
		for (const [serverName, serverUrl] of Object.entries(globalServers)) {
			let apiKey: string | undefined;

			// Try to get user's API key for this server
			if (encryptionKey) {
				const encryptedApiKey = await this.userAuth.getApiKey(userId, serverName);
				if (encryptedApiKey) {
					apiKey = decryptApiKey(encryptedApiKey, encryptionKey);
				}
			}

			servers[serverName] = {
				url: new URL(serverUrl),
				requestInit: apiKey
					? {
							headers: {
								Authorization: `Bearer ${apiKey}`,
							},
						}
					: undefined,
			};
		}

		const mcpClient = new MCPClient({
			id: `tools-${userId}`,
			servers,
		});

		const tools = await mcpClient.getTools();
		await mcpClient.disconnect();
		return Object.keys(tools);
	}

	/**
	 * Creates a fresh Agent with access to all available MCP tools for a specific user.
	 *
	 * @param userId - User ID for personalization and authentication
	 * @param encryptionKey - Optional encryption key for decrypting user API keys
	 * @param model - Optional LLM model configuration (uses OpenAI gpt-4o-mini by default)
	 * @param conversationHistory - Optional array of previous messages for context (currently not used by Agent constructor)
	 * @returns Promise resolving to configured Agent instance
	 * @throws {Error} When MCP client creation or agent initialization fails
	 * @example
	 * ```typescript
	 * const agent = await hub.createAgentWithMCPTools('user123', 'key', model, history);
	 * const response = await agent.generate('Hello!');
	 * ```
	 */
	async createAgentWithMCPTools(
		userId: string,
		encryptionKey?: string,
		model?: unknown
	): Promise<Agent> {
		// Get all globally configured servers
		const globalServers = await this.loadServersFromKV();
		const servers: Record<string, MCPServerConfig> = {};

		// Build server configurations with user's API keys
		for (const [serverName, serverUrl] of Object.entries(globalServers)) {
			let apiKey: string | undefined;

			// Try to get user's API key for this server
			if (encryptionKey) {
				const encryptedApiKey = await this.userAuth.getApiKey(userId, serverName);
				if (encryptedApiKey) {
					apiKey = decryptApiKey(encryptedApiKey, encryptionKey);
				}
			}

			servers[serverName] = {
				url: new URL(serverUrl),
				requestInit: apiKey
					? {
							headers: {
								Authorization: `Bearer ${apiKey}`,
							},
						}
					: undefined,
				timeout: 20000,
			};
		}

		const mcpClient = new MCPClient({
			id: `agent-${userId}-${Date.now()}`, // Unique ID per request
			servers,
			timeout: 30000,
		});

		// Create fresh agent with MCP tools
		const agent = new Agent({
			name: `Slack Agent for ${userId}`,
			instructions:
				'You are a helpful assistant with access to various tools through MCP servers. Help users accomplish their tasks using the available tools.',
			model: model ?? this.getDefaultOpenAIModel(),
			tools: await mcpClient.getTools(),
			// TODO: Pass conversationHistory to Agent constructor when Mastra supports it
			// For now, conversation context is managed separately via KV storage
		});

		await mcpClient.disconnect();
		return agent;
	}

	/**
	 * Save conversation history to KV storage using Slack thread ID
	 *
	 * @param threadId - Slack thread ID (message.thread_ts ?? message.ts)
	 * @param messages - Array of conversation messages
	 */
	async saveConversationHistory(
		threadId: string,
		messages: Array<{ role: string; content: string }>
	): Promise<void> {
		const key = `conversation:${threadId}`;
		await this.kv.put(
			key,
			JSON.stringify({
				messages,
				lastUpdated: Date.now(),
				messageCount: messages.length,
			})
		);
	}

	/**
	 * Load conversation history from KV storage using Slack thread ID
	 *
	 * @param threadId - Slack thread ID (message.thread_ts ?? message.ts)
	 * @returns Array of conversation messages or empty array if not found
	 */
	async loadConversationHistory(
		threadId: string
	): Promise<Array<{ role: string; content: string }>> {
		const key = `conversation:${threadId}`;
		const data = await this.kv.get(key);

		if (!data) return [];

		try {
			const parsed = JSON.parse(data) as { messages?: Array<{ role: string; content: string }> };
			return parsed.messages ?? [];
		} catch {
			return [];
		}
	}

	/**
	 * Add a message to conversation history using Slack thread ID
	 *
	 * @param threadId - Slack thread ID (message.thread_ts ?? message.ts)
	 * @param role - Message role (user, assistant, system)
	 * @param content - Message content
	 */
	async addMessageToHistory(threadId: string, role: string, content: string): Promise<void> {
		const messages = await this.loadConversationHistory(threadId);
		messages.push({ role, content });

		// Keep only last 20 messages to prevent KV size issues
		if (messages.length > 20) {
			messages.splice(0, messages.length - 20);
		}

		await this.saveConversationHistory(threadId, messages);
	}

	/**
	 * Default OpenAI model configuration for agents
	 */
	private getDefaultOpenAIModel(): string {
		// Use simple string format - Mastra picks up OPENAI_API_KEY from environment
		return 'openai/gpt-4o-mini';
	}

	/**
	 * TODO: update this JSDoc using best practices
	 *
	 * Check if a user has access to a specific server
	 * Returns true if the server exists globally and either:
	 * 1. The server doesn't require authentication, OR
	 * 2. The user has provided authentication for the server
	 */
	async userHasAccessToServer(
		userId: string,
		serverName: string,
		encryptionKey?: string
	): Promise<boolean> {
		// Check if server exists globally
		const globalServers = await this.loadServersFromKV();
		if (!globalServers[serverName]) {
			return false;
		}

		// If no encryption key provided, assume server doesn't need auth
		if (!encryptionKey) {
			return true;
		}

		// Check if user has API key for this server
		const hasApiKey = await this.userAuth.hasApiKey(userId, serverName);
		return hasApiKey; // Return actual auth status
	}

	/**
	 * Get all servers that a user has access to
	 */
	async getAccessibleServersForUser(
		userId: string,
		encryptionKey?: string
	): Promise<Array<{ name: string; url: string; hasAuth: boolean }>> {
		const globalServers = await this.loadServersFromKV();
		const accessibleServers = [];

		for (const [serverName, serverUrl] of Object.entries(globalServers)) {
			const hasAuth = encryptionKey ? await this.userAuth.hasApiKey(userId, serverName) : false;
			accessibleServers.push({
				name: serverName,
				url: serverUrl,
				hasAuth,
			});
		}

		return accessibleServers;
	}

	/**
	 * Clean up resources (no-op for stateless design)
	 * Kept for API compatibility but not needed in Cloudflare Workers
	 */
	async disconnect(): Promise<void> {
		// No-op: stateless design means no persistent connections to clean up
		// MCP clients are already disconnected after each operation
	}
}
