import { Hono } from 'hono';
import { McpServerHub } from './utils/mcp';
import { encryptApiKey } from './utils/crypto';
import { UserAuthManager } from './utils/auth';

interface Env {
	'snack-kv': KVNamespace;
	ENCRYPTION_KEY: string;
	OPENAI_API_KEY: string;
}

interface ServerInfo {
	server: string;
	url: string;
	hasAccess: boolean;
	hasAuth: boolean;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * Lists all globally configured servers with user access information.
 *
 * @route GET /mcp/servers
 * @param {string} id - User ID to check access for (query parameter)
 * @returns {Promise<Response>} JSON response containing array of server objects with access info
 * @throws {400} When user ID is missing
 * @throws {500} When server listing fails
 * @example
 * GET /mcp/servers?id=user123
 * // Returns: [{ server: "github", url: "https://api.github.com", hasAccess: true, hasAuth: true }]
 */
app.get('/mcp/servers', async c => {
	try {
		const userId = c.req.query('id');
		const client = new McpServerHub(c.env['snack-kv']);
		const servers = await client.loadServersFromKV();
		const serverList: ServerInfo[] = [];

		if (userId) {
			for (const [name, url] of Object.entries(servers)) {
				try {
					const hasAccess = await client.userHasAccessToServer(userId, name, c.env.ENCRYPTION_KEY);

					// Check if user has authentication for this server
					let hasAuth = false;
					if (c.env.ENCRYPTION_KEY) {
						const userAuth = new UserAuthManager(c.env['snack-kv']);
						hasAuth = await userAuth.hasApiKey(userId, name);
					}

					const serverInfo: ServerInfo = {
						server: name,
						url: url,
						hasAccess,
						hasAuth,
					};

					serverList.push(serverInfo);
				} catch (e) {
					console.error(`Error processing server ${name}:`, e);
					// Still include the server even if there's an error checking access
					const serverInfo: ServerInfo = {
						server: name,
						url: url,
						hasAccess: false,
						hasAuth: false,
					};
					serverList.push(serverInfo);
				}
			}
			return c.json(serverList);
		} else {
			console.error('User ID is required to check access to servers');
			return c.json({ error: 'User ID is required to check access to servers' }, 400);
		}
	} catch (err) {
		console.error('Error listing servers:', err);
		return c.json({ error: 'Failed to list servers' }, 500);
	}
});

/**
 * Adds a new MCP server globally and saves the user's API key for authentication.
 *
 * @route POST /mcp/servers
 * @param {Object} body - Request body containing server configuration
 * @param {string} body.userId - User ID adding the server
 * @param {string} body.serverName - Name of the server to add
 * @param {string} body.serverUrl - URL of the MCP server
 * @param {string} body.apiKey - API key for server authentication
 * @returns {Promise<Response>} JSON response with success message
 * @throws {500} When encryption key is missing or server save fails
 * @example
 * POST /mcp/servers
 * // Body: { userId: "user123", serverName: "github", serverUrl: "https://api.github.com", apiKey: "ghp_..." }
 */
app.post('/mcp/servers', async c => {
	try {
		const body = await c.req.json();
		const { userId, serverName, serverUrl, apiKey } = body;

		const client = new McpServerHub(c.env['snack-kv']);
		await client.saveServerToKV(serverName, serverUrl);

		if (!c.env.ENCRYPTION_KEY) {
			console.error('ENCRYPTION_KEY is missing from environment');
			return c.json({ error: 'Encryption key not configured' }, 500);
		}

		try {
			const encryptedApiKey = encryptApiKey(apiKey, c.env.ENCRYPTION_KEY);
			const userAuth = new UserAuthManager(c.env['snack-kv']);
			await userAuth.saveApiKey(userId, serverName, encryptedApiKey);
		} catch (error) {
			console.error('Failed to save to KV:', error);
			throw error;
		}

		return c.json({ message: `${serverName} server configuration saved` });
	} catch (err) {
		console.error(err);
		return c.json({ error: 'Failed to save server configuration' }, 500);
	}
});

/**
 * Removes a server from the global server list.
 *
 * @route DELETE /mcp/servers
 * @param {Object} body - Request body containing server to delete
 * @param {string} body.serverName - Name of the server to delete
 * @returns {Promise<Response>} JSON response with success message
 * @throws {500} When server deletion fails
 * @example
 * DELETE /mcp/servers
 * // Body: { serverName: "github" }
 */
app.delete('/mcp/servers', async c => {
	try {
		const body = await c.req.json();
		const { serverName } = body;
		const client = new McpServerHub(c.env['snack-kv']);
		await client.deleteServerFromKV(serverName);
		return c.json({ message: `${serverName} server configuration deleted` });
	} catch (err) {
		console.error(err);
		return c.json({ error: 'Failed to delete server configuration' }, 500);
	}
});

/**
 * Returns available tools from all servers that the user has access to.
 *
 * @route GET /mcp/tools
 * @param {string} id - User ID to get tools for (query parameter)
 * @returns {Promise<Response>} JSON response containing array of available tool names
 * @throws {400} When user ID is missing
 * @throws {500} When tool listing fails
 * @example
 * GET /mcp/tools?id=user123
 * // Returns: ["get_repos", "create_issue", "get_weather"]
 */
app.get('/mcp/tools', async c => {
	try {
		const userId = c.req.query('id');
		if (!userId) {
			return c.json({ error: 'User ID is required' }, 400);
		}

		const client = new McpServerHub(c.env['snack-kv']);

		// Get toolsets for the user (includes all accessible servers)
		const tools = await client.listAvailTools(userId, c.env.ENCRYPTION_KEY);
		return c.json(tools);
	} catch (err) {
		console.error('Error listing tools:', err);
		return c.json({ error: 'Failed to list tools' }, 500);
	}
});

/**
 * Adds or updates API key authentication for a specific user and server combination.
 *
 * @route POST /mcp/auth/:id
 * @param {string} id - User ID to add auth for (path parameter)
 * @param {Object} body - Request body containing authentication details
 * @param {string} body.serverName - Name of the server to authenticate with
 * @param {string} body.apiKey - API key for server authentication
 * @returns {Promise<Response>} JSON response with success message
 * @throws {400} When required fields are missing
 * @throws {500} When API key save fails
 * @example
 * POST /mcp/auth/user123
 * // Body: { serverName: "github", apiKey: "ghp_..." }
 */
app.post('/mcp/auth/:id', async (c): Promise<Response> => {
	try {
		const userId = c.req.param('id');
		const body = await c.req.json();
		const { serverName, apiKey } = body;

		if (!userId || !serverName || !apiKey) {
			return c.json(
				{ error: 'Missing at least one required field(s): userId, serverName, apiKey' },
				400
			);
		}

		const encryptedApiKey = encryptApiKey(apiKey, c.env.ENCRYPTION_KEY);
		const userAuth = new UserAuthManager(c.env['snack-kv']);
		await userAuth.saveApiKey(userId, serverName, encryptedApiKey);

		return c.json({ message: 'API key saved successfully' }, 200);
	} catch (err) {
		console.error('Error saving auth config:', err);
		return c.json({ error: 'Failed to save API key' }, 500);
	}
});

/**
 * Chat endpoint for LLM conversations with MCP tools
 *
 * ## How the Slack Bot Works:
 * - **@mention the bot** → Creates a new thread automatically
 * - **Reply in thread** → Continues the conversation with full chat history
 * - **Each thread** → Has its own conversation context (stored in KV)
 * - **Chat history** → Automatically maintained per Slack thread ID
 * - **MCP tools** → Available to the agent based on user's authenticated servers
 *
 * @route POST /llm/chat
 * @param {string} message - User message content
 * @param {string} threadId - Slack thread ID (message.thread_ts ?? message.ts)
 * @param {string} userId - User ID for agent personalization (optional)
 * @returns {Promise<Response>} JSON response containing agent's reply
 * @throws {400} When message is missing
 * @throws {500} When chat processing fails
 * @example
 * POST /llm/chat
 * { "message": "Hello", "threadId": "1234567890.123456", "userId": "user123" }
 * // Returns: { "reply": "Hello! How can I help you today?", "threadId": "1234567890.123456" }
 */
app.post('/llm/chat', async c => {
	try {
		const body = await c.req.json();
		const { message, threadId, userId } = body;

		if (!message) {
			return c.json({ error: 'Message is required' }, 400);
		}

		const client = new McpServerHub(c.env['snack-kv']);

		// Load conversation history using Slack's thread ID
		const slackThreadId = threadId ?? 'main';
		const conversationHistory = await client.loadConversationHistory(slackThreadId);

		const agent = await client.createAgentWithMCPTools(
			userId ?? 'anonymous',
			c.env.ENCRYPTION_KEY,
			undefined, // Use default OpenAI model from mcp.ts
			conversationHistory
		);
		const response = await agent.generate(message);

		// Save conversation history using Slack's thread ID
		await client.addMessageToHistory(slackThreadId, 'user', message);
		await client.addMessageToHistory(slackThreadId, 'assistant', response.text);

		return c.json({
			reply: response.text,
			threadId: slackThreadId,
			userId: userId,
		});
	} catch (err) {
		console.error('Error in chat:', err);
		return c.json({ error: 'Failed to process chat message' }, 500);
	}
});

export default app;
