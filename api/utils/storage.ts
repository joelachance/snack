/**
 * Manages MCP server configurations using Cloudflare KV storage.
 *
 * Handles CRUD operations for server configurations, storing them as JSON
 * in KV with the key `servers:config`. Server names and URLs are normalized
 * to lowercase for consistency.
 *
 * @example
 * ```typescript
 * const serverConfig = new ServerConfigManager(kv);
 * await serverConfig.addServer('github', 'https://api.github.com');
 * const servers = await serverConfig.loadServers();
 * ```
 */
export class ServerConfigManager {
	constructor(private _kv: KVNamespace) {}

	/**
	 * Load all server configurations from KV storage.
	 *
	 * @returns Object mapping server names to URLs
	 */
	async loadServers(): Promise<Record<string, string>> {
		if (!this._kv) return {};

		const value = await this._kv.get('servers:config');
		if (!value) return {};

		try {
			return JSON.parse(value) as Record<string, string>;
		} catch {
			return {};
		}
	}

	/**
	 * Add a server to the configuration.
	 *
	 * @param serverName - The server name (will be normalized to lowercase)
	 * @param serverUrl - The server URL (will be normalized to lowercase)
	 */
	async addServer(serverName: string, serverUrl: string): Promise<void> {
		const servers = await this.loadServers();
		servers[serverName.toLowerCase()] = serverUrl.toLowerCase();
		await this.saveServers(servers);
	}

	/**
	 * Remove a server from the configuration.
	 *
	 * @param serverName - The server name to remove
	 */
	async removeServer(serverName: string): Promise<void> {
		const servers = await this.loadServers();
		delete servers[serverName];
		await this.saveServers(servers);
	}

	/**
	 * Save server configurations to KV storage.
	 *
	 * @param servers - Object mapping server names to URLs
	 * @private
	 */
	private async saveServers(servers: Record<string, string>): Promise<void> {
		if (!this._kv) return;

		await this._kv.put('servers:config', JSON.stringify(servers));
	}
}
