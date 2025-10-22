import { MCPClient } from '@mastra/mcp';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { getOAuthToken } from './oauth.js';
import { OAUTH_SERVICES } from '../../configs/oauth.js';
import {
	loadServers,
	saveServer,
	removeServer,
	saveConversationHistory as saveConversationHistoryToKV,
	loadConversationHistory as loadConversationHistoryFromKV,
	addMessageToHistory as addMessageToHistoryInKV,
} from './storage';
import { findUserApiKey } from './auth';
import type { Env, ConversationMessage, MCPServerConfig } from '../types';

function buildConversationContext(conversationHistory: ConversationMessage[]): string {
	if (!conversationHistory?.length) {
		return '';
	}
	const context = conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');
	return `Previous conversation:\n${context}\n\n`;
}

/**
 * Manages MCP server configurations and creates agents + tools.
 *
 * This class manages MCP servers, handles user authentication, and creates AI agents.
 * It stores conversation history and manages server configurations.
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
	constructor(private env: Env) {}

	/**
	 * @returns Promise { github: 'https://api.github.com', slack: 'https://slack.com/api' }
	 */
	async loadServersFromKV(): Promise<Record<string, string>> {
		return await loadServers(this.env);
	}

	async saveServerToKV(serverName: string, serverUrl: string): Promise<void> {
		await saveServer(serverName, serverUrl, this.env);
	}

	async deleteServerFromKV(serverName: string): Promise<void> {
		await removeServer(serverName, this.env);
	}

	/**
	 * Builds server configurations with user authentication for MCP clients.
	 *
	 * @private
	 * @param userId - User ID for authentication lookup
	 * @param encryptionKey - Optional encryption key for decrypting API keys
	 * @param env - Environment variables for OAuth token lookup
	 * @returns Promise resolving to configured servers object
	 */
	private async buildServerConfigs(
		userId: string,
		encryptionKey?: string,
		env?: Env
	): Promise<Record<string, MCPServerConfig>> {
		const globalServers = await this.loadServersFromKV();
		const servers: Record<string, MCPServerConfig> = {};

		for (const [serverName, serverUrl] of Object.entries(globalServers)) {
			let apiKey: string | undefined;

			if (encryptionKey) {
				// Try OAuth token first for supported services
				if (OAUTH_SERVICES.includes(serverName.toLowerCase())) {
					const oauthToken = await getOAuthToken(userId, serverName, env);
					if (oauthToken) {
						apiKey = oauthToken;
					}
				}

				if (!apiKey) {
					apiKey = await findUserApiKey(userId, serverName, encryptionKey, this.env);
				}
			}

			const serverConfig: MCPServerConfig = {
				url: new URL(serverUrl),
			};

			if (apiKey) {
				// Using `Token` for Sentry
				const authHeader =
					serverName.toLowerCase() === 'sentry' ? `Token ${apiKey}` : `Bearer ${apiKey}`;

				serverConfig.requestInit = {
					headers: { Authorization: authHeader },
				};
			}
			servers[serverName] = serverConfig;
		}
		return servers;
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
	async listAvailTools(userId: string, encryptionKey?: string, env?: any): Promise<string[]> {
		const globalServers = await this.loadServersFromKV();

		if (Object.keys(globalServers).length === 0) {
			return [];
		}

		const servers = await this.buildServerConfigs(userId, encryptionKey, env);

		const mcpClient = new MCPClient({
			id: `tools-${userId}`,
			servers,
		});

		try {
			const tools = await mcpClient.getTools();
			return Object.keys(tools);
		} catch (error) {
			console.error('MCP client error:', error);
			throw error;
		} finally {
			try {
				await mcpClient.disconnect();
			} catch (disconnectError) {
				console.error('Error disconnecting MCP client:', disconnectError);
			}
		}
	}

	/**
	 * Creates a fresh Agent with access to all available MCP tools for a specific user.
	 *
	 * @param userId - User ID for personalization and authentication
	 * @param encryptionKey - Optional encryption key for decrypting user API keys
	 * @param conversationHistory - Optional conversation history for context
	 * @returns Promise resolving to object containing agent and cleanup function
	 * @throws {Error} When MCP client creation or agent initialization fails
	 * @example
	 * ```typescript
	 * const { agent, cleanup } = await hub.createAgentWithMCPTools('user123', 'key', history);
	 * const response = await agent.generate('Hello!');
	 * await cleanup(); // Important: cleanup the MCP client
	 * ```
	 */
	async createAgentWithMCPTools(
		userId: string,
		encryptionKey?: string,
		conversationHistory?: Array<{ role: string; content: string }>,
		env?: Env
	): Promise<{ agent: Agent; cleanup: () => Promise<void> }> {
		const globalServers = await this.loadServersFromKV();

		// If no servers are configured, create agent without MCP tools
		if (Object.keys(globalServers).length === 0) {
			const contextInstructions = buildConversationContext(conversationHistory ?? []);
			const agent = new Agent({
				name: 'MCP Agent',
				instructions: contextInstructions,
				model: openai('gpt-4o-mini'), //TODO: Configure this to use other models
			});

			return {
				agent,
				cleanup: async (): Promise<void> => {
					// No cleanup needed when no MCP client is created
				},
			};
		}

		const servers = await this.buildServerConfigs(userId, encryptionKey, env);

		const mcpClient = new MCPClient({
			id: `agent-${userId}`,
			servers,
			timeout: 30000, //TODO: Check Cloudflare timeouts and make sure they are at least this duration
		});

		try {
			const availableTools = await mcpClient.getTools();
			const contextInstructions = buildConversationContext(conversationHistory ?? []);

			const agent = new Agent({
				name: 'MCP Agent',
				instructions: contextInstructions,
				model: openai('gpt-4o-mini'),
				tools: Object.keys(availableTools).length > 0 ? availableTools : undefined,
			});

			return {
				agent,
				cleanup: async (): Promise<void> => {
					await mcpClient.disconnect();
				},
			};
		} catch (error) {
			console.error('MCP client error in createAgentWithMCPTools:', error);
			try {
				await mcpClient.disconnect();
			} catch (disconnectError) {
				console.error('Error disconnecting MCP client:', disconnectError);
			}
			throw error;
		}
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
		await saveConversationHistoryToKV(threadId, messages, this.env);
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
		return await loadConversationHistoryFromKV(threadId, this.env);
	}

	/**
	 * Add a message to conversation history using Slack thread ID
	 *
	 * @param threadId - Slack thread ID (message.thread_ts ?? message.ts)
	 * @param role - Message role (user, assistant, system)
	 * @param content - Message content
	 */
	async addMessageToHistory(threadId: string, role: string, content: string): Promise<void> {
		await addMessageToHistoryInKV(threadId, role, content, this.env);
	}
}
