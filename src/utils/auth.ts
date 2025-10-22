/**
 * Authentication and Access Control Utilities
 * 
 * This module provides functions for checking user authentication and server access.
 * It handles both API key and OAuth token authentication.
 */

import { getUserApiKey } from './storage';
import { getOAuthToken } from '../oauth.js';
import { OAUTH_SERVICES } from '../../configs/oauth.js';
import { decrypt } from './crypto';
import type { Env } from '../types';

/**
 * Attempts to find an API key for a user and server using multiple naming variations.
 * @param userId - User ID
 * @param serverName - Server name
 * @param encryptionKey - Encryption key for decrypting stored keys
 * @param env - Environment variables
 * @returns Decrypted API key or undefined if not found
 */
export async function findUserApiKey(
	userId: string, 
	serverName: string, 
	encryptionKey: string, 
	env: Env
): Promise<string | undefined> {
	const possibleNames = [
		serverName,
		serverName.toLowerCase(),
	];
	
	for (const name of possibleNames) {
		const encryptedApiKey = await getUserApiKey(userId, name, env);
		if (encryptedApiKey) {
			return decrypt(encryptedApiKey, { ENCRYPTION_KEY: encryptionKey });
		}
	}
	
	return undefined;
}

/**
 * Check if a user has access to a specific server.
 * 
 * @param userId - User ID to check access for
 * @param serverName - Name of the server to check
 * @param encryptionKey - Optional encryption key for authentication check
 * @param env - Environment variables
 * @param globalServers - Optional pre-loaded server configurations
 * @returns True if server exists and user has authentication (if required)
 */
export async function userHasAccessToServer(
	userId: string,
	serverName: string,
	encryptionKey?: string,
	env?: Env,
	globalServers?: Record<string, string>
): Promise<boolean> {
	// If no global servers provided, we can't check if server exists
	if (!globalServers) {
		return false;
	}

	if (!globalServers[serverName]) {
		return false;
	}

	// If no encryption key provided, assume server doesn't need auth
	if (!encryptionKey || !env) {
		return true;
	}

	const apiKey = await getUserApiKey(userId, serverName, env);
	return apiKey !== null;
}

/**
 * Get servers that a user has access to, optionally filtered by authentication status.
 * 
 * @param userId - User ID to check access for
 * @param encryptionKey - Optional encryption key for authentication check
 * @param env - Environment variables
 * @param globalServers - Server configurations
 * @param requireAuth - If true, only return servers where user has authentication
 * @returns Array of server objects with name, URL, and authentication status
 */
export async function getAccessibleServersForUser(
	userId: string,
	encryptionKey: string | undefined,
	env: Env,
	globalServers: Record<string, string>,
	requireAuth: boolean = false
): Promise<Array<{ name: string; url: string; hasAuth: boolean }>> {
	const accessibleServers = [];

	for (const [serverName, serverUrl] of Object.entries(globalServers)) {
		let hasAuth = false;

		if (encryptionKey) {
			// Check for OAuth token first (for supported services)
			if (OAUTH_SERVICES.includes(serverName.toLowerCase())) {
				const oauthToken = await getOAuthToken(userId, serverName, env);
				if (oauthToken) {
					hasAuth = true;
				}
			}

			// If no OAuth token, check for API key
			if (!hasAuth) {
				const apiKey = await findUserApiKey(userId, serverName, encryptionKey, env);
				hasAuth = apiKey !== undefined;
			}
		} else {
			// If no encryption key provided, assume server doesn't need auth
			hasAuth = true;
		}

		// Only include server if it meets the requirements
		if (!requireAuth || hasAuth) {
			accessibleServers.push({
				name: serverName,
				url: serverUrl,
				hasAuth,
			});
		}
	}

	return accessibleServers;
}

/**
 * Get only servers that a user has authenticated access to.
 * This is a convenience function that calls getAccessibleServersForUser with requireAuth=true.
 * 
 * @param userId - User ID to check access for
 * @param encryptionKey - Optional encryption key for authentication check
 * @param env - Environment variables
 * @param globalServers - Server configurations
 * @returns Array of server objects with name, URL, and authentication status (hasAuth will always be true)
 */
export async function getAuthenticatedServersForUser(
	userId: string,
	encryptionKey: string | undefined,
	env: Env,
	globalServers: Record<string, string>
): Promise<Array<{ name: string; url: string; hasAuth: boolean }>> {
	return getAccessibleServersForUser(userId, encryptionKey, env, globalServers, true);
}
