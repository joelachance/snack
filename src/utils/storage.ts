/**
 * Cloudflare KV Storage Operations
 * 
 * Key patterns:
 * - `auth:{userId}:{serviceName}` - User API keys (encrypted)
 * - `oauth:state:{state}` - OAuth flow state (10min TTL)
 * - `oauth:token:{userId}:{service}` - OAuth tokens (encrypted)
 * - `servers:config` - MCP server configurations
 * - `conversation:{threadId}` - Slack conversation history
 */

interface Env {
	'SNACK-KV': KVNamespace;
}

interface KVNamespace {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
	delete(key: string): Promise<void>;
}

// ============================================================================
// AUTHENTICATION DATA FUNCTIONS
// ============================================================================

/**
 * Store authentication data in Cloudflare KV
 * @param authData authentication data
 * @param env environment variables
 */
export async function storeAuth(
	authData: { userId: string; serviceName: string; apiKey: string | null; createdAt: string },
	env: Env
): Promise<void> {
	const key = `auth:${authData.userId}:${authData.serviceName}`;
	await env['SNACK-KV'].put(key, JSON.stringify(authData));
}

/**
 * Store encrypted user API key
 * @param userId user ID
 * @param serviceName service name
 * @param encryptedApiKey encrypted API key
 * @param env environment variables
 */
export async function storeUserApiKey(
	userId: string,
	serviceName: string,
	encryptedApiKey: string,
	env: Env
): Promise<void> {
	const key = `auth:${userId}:${serviceName}`;
	await env['SNACK-KV'].put(key, JSON.stringify({ apiKey: encryptedApiKey }));
}


/**
 * Get user API key from KV storage
 * @param userId user ID
 * @param serviceName service name
 * @param env environment variables
 * @returns encrypted API key or null if not found
 */
export async function getUserApiKey(userId: string, serviceName: string, env: Env): Promise<string | null> {
	const key = `auth:${userId}:${serviceName}`;
	const value = await env['SNACK-KV'].get(key);
	if (!value) return null;
	try {
		const authData = JSON.parse(value) as { apiKey: string | null; userId: string; serviceName: string; createdAt: string };
		return authData.apiKey;
	} catch {
		// If it's not JSON, treat it as a direct encrypted API key (legacy format)
		return value;
	}
}

// ============================================================================
// OAUTH FUNCTIONS
// ============================================================================

/**
 * Store OAuth state for verification
 * @param state OAuth state string
 * @param stateData state data
 * @param env environment variables
 */
export async function storeOAuthState(
	state: string,
	stateData: { userId: string; service: string; timestamp: number },
	env: Env
): Promise<void> {
	const key = `oauth:state:${state}`;
	await env['SNACK-KV'].put(key, JSON.stringify(stateData), { expirationTtl: 600 }); // 10 minutes
}

/**
 * Get OAuth state for verification
 * @param state OAuth state string
 * @param env environment variables
 * @returns state data or null if not found/expired
 */
export async function getOAuthState(state: string, env: Env): Promise<{ userId: string; service: string; timestamp: number } | null> {
	const key = `oauth:state:${state}`;
	const value = await env['SNACK-KV'].get(key);
	if (!value) return null;
	try {
		return JSON.parse(value) as { userId: string; service: string; timestamp: number };
	} catch {
		return null;
	}
}

/**
 * Delete OAuth state after successful verification
 * @param state OAuth state string
 * @param env environment variables
 */
export async function deleteOAuthState(state: string, env: Env): Promise<void> {
	const key = `oauth:state:${state}`;
	await env['SNACK-KV'].delete(key);
}

/**
 * Store encrypted OAuth token
 * @param userId user ID
 * @param service service name
 * @param encryptedToken encrypted token data
 * @param env environment variables
 */
export async function storeOAuthToken(
	userId: string,
	service: string,
	encryptedToken: string,
	env: Env
): Promise<void> {
	const key = `oauth:token:${userId}:${service}`;
	await env['SNACK-KV'].put(key, encryptedToken);
}

/**
 * Get encrypted OAuth token
 * @param userId user ID
 * @param service service name
 * @param env environment variables
 * @returns encrypted token or null if not found
 */
export async function getOAuthToken(userId: string, service: string, env: Env): Promise<string | null> {
	const key = `oauth:token:${userId}:${service}`;
	return await env['SNACK-KV'].get(key);
}

// ============================================================================
// SERVER CONFIGURATION FUNCTIONS
// ============================================================================

/**
 * Load all server configurations from KV
 * @param env environment variables
 * @returns server configurations mapping
 */
export async function loadServers(env: Env): Promise<Record<string, string>> {
	const value = await env['SNACK-KV'].get('servers:config');
	if (!value) return {};
	try {
		return JSON.parse(value) as Record<string, string>;
	} catch {
		return {};
	}
}

/**
 * Save server configuration to KV
 * @param serverName server name
 * @param serverUrl server URL
 * @param env environment variables
 */
export async function saveServer(serverName: string, serverUrl: string, env: Env): Promise<void> {
	const servers = await loadServers(env);
	servers[serverName.toLowerCase()] = serverUrl;
	await env['SNACK-KV'].put('servers:config', JSON.stringify(servers));
}

/**
 * Remove server configuration from KV
 * @param serverName server name to remove
 * @param env environment variables
 */
export async function removeServer(serverName: string, env: Env): Promise<void> {
	const servers = await loadServers(env);
	delete servers[serverName.toLowerCase()];
	await env['SNACK-KV'].put('servers:config', JSON.stringify(servers));
}

// ============================================================================
// CONVERSATION HISTORY FUNCTIONS
// ============================================================================

/**
 * Save conversation history to KV storage
 * @param threadId Slack thread ID
 * @param messages conversation messages
 * @param env environment variables
 */
export async function saveConversationHistory(
	threadId: string,
	messages: Array<{ role: string; content: string }>,
	env: Env
): Promise<void> {
	const key = `conversation:${threadId}`;
	await env['SNACK-KV'].put(
		key,
		JSON.stringify({
			messages,
			lastUpdated: Date.now(),
			messageCount: messages.length,
		})
	);
}

/**
 * Load conversation history from KV storage
 * @param threadId Slack thread ID
 * @param env environment variables
 * @returns conversation messages or empty array if not found
 */
export async function loadConversationHistory(
	threadId: string,
	env: Env
): Promise<Array<{ role: string; content: string }>> {
	const key = `conversation:${threadId}`;
	const data = await env['SNACK-KV'].get(key);

	if (!data) return [];

	try {
		const parsed = JSON.parse(data) as { messages?: Array<{ role: string; content: string }> };
		return parsed.messages ?? [];
	} catch {
		return [];
	}
}

/**
 * Add a message to conversation history
 * @param threadId Slack thread ID
 * @param role message role (user, assistant, system)
 * @param content message content
 * @param env environment variables
 */
export async function addMessageToHistory(
	threadId: string,
	role: string,
	content: string,
	env: Env
): Promise<void> {
	const messages = await loadConversationHistory(threadId, env);
	messages.push({ role, content });

	// Keep only last 20 messages to prevent KV size issues
	if (messages.length > 20) {
		messages.splice(0, messages.length - 20);
	}

	await saveConversationHistory(threadId, messages, env);
}
