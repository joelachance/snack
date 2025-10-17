/**
 * Manages encrypted API keys for user-server authentication.
 *
 * Stores and retrieves encrypted API keys using Cloudflare KV storage.
 * Keys are stored with the format: `auth:userId:serverName`
 *
 * @example
 * ```typescript
 * const authManager = new UserAuthManager(kv);
 * await authManager.saveApiKey('user123', 'github', encryptedKey);
 * const hasAuth = await authManager.hasApiKey('user123', 'github');
 * ```
 */
export class UserAuthManager {
	constructor(private _kv: KVNamespace) {}

	/**
	 * Save encrypted API key for a user-server combination.
	 *
	 * @param userId - The user ID
	 * @param serverName - The server name
	 * @param encryptedApiKey - The encrypted API key
	 */
	async saveApiKey(userId: string, serverName: string, encryptedApiKey: string): Promise<void> {
		if (!this._kv) return;

		const key = `auth:${userId}:${serverName}`;
		await this._kv.put(key, encryptedApiKey);
	}

	/**
	 * Get encrypted API key for a user-server combination.
	 *
	 * @param userId - The user ID
	 * @param serverName - The server name
	 * @returns The encrypted API key or null if not found
	 */
	async getApiKey(userId: string, serverName: string): Promise<string | null> {
		if (!this._kv) return null;

		const key = `auth:${userId}:${serverName}`;
		return await this._kv.get(key);
	}

	/**
	 * Check if user has an API key for a specific server.
	 *
	 * @param userId - The user ID
	 * @param serverName - The server name
	 * @returns True if user has API key, false otherwise
	 */
	async hasApiKey(userId: string, serverName: string): Promise<boolean> {
		const apiKey = await this.getApiKey(userId, serverName);
		return apiKey !== null;
	}
}
