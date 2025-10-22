import { encrypt, decrypt } from './crypto.js';
import { OAUTH_CONFIGS } from '../../configs/index.js';
import { getEncryptedOAuthToken, storeEncryptedOAuthToken } from './storage.js';

// Helper function to get OAuth token for a user and service
export async function getOAuthToken(userId, service, env) {
	try {
		const encryptedToken = await getEncryptedOAuthToken(userId, service, env);
		if (!encryptedToken) {
			return null;
		}

		const decryptedData = decrypt(encryptedToken, env);
		const tokenData = JSON.parse(decryptedData);

		// Check if token is expired and refresh if needed
		if (tokenData.issued_at && tokenData.expires_in) {
			const expirationTime = tokenData.issued_at + tokenData.expires_in * 1000;
			if (Date.now() >= expirationTime) {
				return await refreshOAuthToken(userId, service, tokenData, env);
			}
		} else if (tokenData.expires_at && Date.now() >= tokenData.expires_at * 1000) {
			return await refreshOAuthToken(userId, service, tokenData, env);
		}

		// Handle different possible field names for access token
		const accessToken = tokenData.access_token || tokenData.accessToken || tokenData.token;
		if (!accessToken) {
			return null;
		}

		return accessToken;
	} catch (error) {
		return null;
	}
}

// Helper function to refresh OAuth token
async function refreshOAuthToken(userId, service, tokenData, env) {
	const config = OAUTH_CONFIGS[service];
	if (!config || !config.refreshUrl || !tokenData.refresh_token) {
		return null; // Can't refresh
	}

	try {
		const refreshResponse = await fetch(config.refreshUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				client_id: config.clientId,
				client_secret: env[`${service.toUpperCase()}_CLIENT_SECRET`],
				refresh_token: tokenData.refresh_token,
				grant_type: 'refresh_token',
			}),
		});

		if (!refreshResponse.ok) {
			throw new Error(`Token refresh failed: ${refreshResponse.statusText}`);
		}

		const newTokenData = await refreshResponse.json();

		// Add issued_at timestamp for proper expiration calculation
		newTokenData.issued_at = Date.now();

		// Store new token
		const encryptedToken = encrypt(JSON.stringify(newTokenData), env);
		await storeEncryptedOAuthToken(userId, service, encryptedToken, env);

		return newTokenData.access_token;
	} catch (error) {
		return null;
	}
}
