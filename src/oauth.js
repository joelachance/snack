import { oauthModalView } from './slack-blocks.js';
import { encrypt, decrypt } from './utils/crypto.js';
import { OAUTH_CONFIGS } from '../configs/index.js';
import { storeOAuthState, getOAuthToken as getOAuthTokenFromStorage, storeOAuthToken } from './utils/storage.js';

/**
 * Register OAuth-related Slack actions
 * @param {any} app - Slack app instance
 * @param {import('./types').Env} env - Environment variables
 */
export function registerOAuthActions(app, env) {
	// Open OAuth modal
	app.action('open_oauth_modal', async obj => {
		const { payload: body, context } = obj;
		const client = context.client;
		
		// Capture thread context for later use
		const channel = body?.channel?.id;
		const threadTs = body?.message?.thread_ts || body?.message?.ts;

		await client.views.open({
			trigger_id: body.trigger_id,
			view: oauthModalView,
			// Pass thread context through private metadata
			private_metadata: JSON.stringify({ channel, threadTs }),
		});
	});

	// Handle OAuth setup form submission
	app.view('oauth_setup', async obj => {
		const { payload: body, context } = obj;
		const client = context.client;
		const view = body;
		const userId = body?.user?.id;
		
		// Extract thread context from private metadata
		let channel = userId; // fallback to DM
		let threadTs = undefined;
		
		try {
			const metadata = JSON.parse(view?.private_metadata || '{}');
			if (metadata.channel && metadata.threadTs) {
				channel = metadata.channel;
				threadTs = metadata.threadTs;
			}
		} catch (e) {
			console.log('Could not parse private metadata, falling back to DM');
		}
		
		// Debug logging
		console.log('OAuth setup form data:', {
			userId,
			selectedServicePath: body.view?.state?.values?.oauth_service_input?.oauth_service_value?.selected_option?.value
		});
		
		const selectedService = body.view?.state?.values?.oauth_service_input?.oauth_service_value?.selected_option?.value;

		if (!selectedService) {
			console.log('No service selected, showing error');
			await client.chat.postMessage({
				channel: channel,
				thread_ts: threadTs,
				text: 'Error: Please select a service to authenticate with.',
			});
			return;
		}
		
		console.log('Selected service:', selectedService);

		const config = OAUTH_CONFIGS[selectedService];
		if (!config) {
			await client.chat.postMessage({
				channel: channel,
				thread_ts: threadTs,
				text: `Error: OAuth configuration not found for service "${selectedService}".`,
			});
			return;
		}

		try {
			// Generate state parameter for security
			const state = `${userId}-${selectedService}-${Date.now()}`;
			
			// Store state in KV for verification later
			await storeOAuthState(state, {
				userId,
				service: selectedService,
				timestamp: Date.now(),
			}, env);

			// Build OAuth URL
			const authUrl = new URL(config.authUrl);
			authUrl.searchParams.set('client_id', config.clientId);
			authUrl.searchParams.set('redirect_uri', config.redirectUri);
			authUrl.searchParams.set('scope', config.scope);
			authUrl.searchParams.set('state', state);
			authUrl.searchParams.set('response_type', 'code');

			// Send message with link that opens in browser
			await client.chat.postMessage({
				channel: channel,
				thread_ts: threadTs,
				text: `🔐 *OAuth Authentication Required*\n\nTo authenticate with ${selectedService}, please click the link below to open your browser:\n\n<${authUrl.toString()}|Click here to authenticate with ${selectedService}>\n\n*Note:* This link will expire in 10 minutes for security.`,
			});

		} catch (error) {
			console.error('Error starting OAuth flow:', error);
			await client.chat.postMessage({
				channel: channel,
				thread_ts: threadTs,
				text: `Error starting OAuth flow: ${error.message}`,
			});
		}
	});

	// Note: OAuth callback is handled in app.js, not here
	// This function is kept for future use but the actual callback handling
	// is done in the main app.js file
}

// Helper function to get OAuth token for a user and service
export async function getOAuthToken(userId, service, env) {
	try {
		console.log(`Getting OAuth token for user ${userId}, service ${service}`);
		const encryptedToken = await getOAuthTokenFromStorage(userId, service, env);
		if (!encryptedToken) {
			console.log(`No encrypted token found for ${service}`);
			return null;
		}

		const decryptedData = decrypt(encryptedToken, env);
		console.log(`Token decrypted successfully for ${service}`);
		
		const tokenData = JSON.parse(decryptedData);
		
		// Check if token is expired and refresh if needed
		if (tokenData.issued_at && tokenData.expires_in) {
			const expirationTime = tokenData.issued_at + (tokenData.expires_in * 1000);
			if (Date.now() >= expirationTime) {
				console.log(`Token for ${service} is expired, attempting refresh`);
				return await refreshOAuthToken(userId, service, tokenData, env);
			}
		} else if (tokenData.expires_at && Date.now() >= tokenData.expires_at * 1000) {
			console.log(`Token for ${service} is expired (expires_at), attempting refresh`);
			return await refreshOAuthToken(userId, service, tokenData, env);
		}

		console.log(`Returning access token for ${service}: token present`);
		
		// Handle different possible field names for access token
		const accessToken = tokenData.access_token || tokenData.accessToken || tokenData.token;
		if (!accessToken) {
			console.error(`No access token found in token data for ${service}. Available fields:`, Object.keys(tokenData));
			return null;
		}
		
		return accessToken;
	} catch (error) {
		console.error(`Error getting OAuth token for ${service}:`, error);
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
		const { encrypt } = await import('./utils/crypto.js');
		const encryptedToken = encrypt(JSON.stringify(newTokenData), env);
		await storeOAuthToken(userId, service, encryptedToken, env);

		return newTokenData.access_token;
	} catch (error) {
		console.error(`Error refreshing OAuth token for ${service}:`, error);
		return null;
	}
}
