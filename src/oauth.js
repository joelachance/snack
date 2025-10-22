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
		} catch (e) {}
		
		// Extract selected service with safe property access
		const selectedService = body?.view?.state?.values?.oauth_service_input?.oauth_service_value?.selected_option?.value;

		if (!selectedService) {
			await client.chat.postMessage({
				channel: channel,
				thread_ts: threadTs,
				text: 'Error: Please select a service to authenticate with.',
			});
			return;
		}

		// Validate selected service against allowed values
		const allowedServices = Object.keys(OAUTH_CONFIGS);
		if (!allowedServices.includes(selectedService)) {
			await client.chat.postMessage({
				channel: channel,
				thread_ts: threadTs,
				text: `Error: Invalid service "${selectedService}". Allowed services: ${allowedServices.join(', ')}`,
			});
			return;
		}

		const config = OAUTH_CONFIGS[selectedService];

		try {
			// Generate cryptographically secure random state
			const state = crypto.getRandomValues(new Uint8Array(32))
				.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
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
				text: `*OAuth Authentication Required*\n\nTo authenticate with ${selectedService}, please click the link below to open your browser:\n\n<${authUrl.toString()}|Click here to authenticate with ${selectedService}>\n\n*Note:* This link will expire in 10 minutes for security.`,
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

	// **NOTE**: OAuth callback is handled in app.js, not here
	// This function is kept for future use but the actual callback handling
	// is done in the main app.js file
}

// Helper function to get OAuth token for a user and service
export async function getOAuthToken(userId, service, env) {
	try {
		const encryptedToken = await getOAuthTokenFromStorage(userId, service, env);
		if (!encryptedToken) {
			return null;
		}

		const decryptedData = decrypt(encryptedToken, env);
		const tokenData = JSON.parse(decryptedData);
		
		// Check if token is expired and refresh if needed
		if (tokenData.issued_at && tokenData.expires_in) {
			const expirationTime = tokenData.issued_at + (tokenData.expires_in * 1000);
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
		await storeOAuthToken(userId, service, encryptedToken, env);

		return newTokenData.access_token;
	} catch (error) {
		return null;
	}
}
