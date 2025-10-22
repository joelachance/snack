import { SlackApp } from 'slack-cloudflare-workers';
import { registerLaunchActions } from './src/launch.js';
import { registerServerActions } from './src/servers.js';
import { registerToolsActions } from './src/tools.js';
import { registerAuthActions } from './src/auth.js';
import { registerOAuthActions } from './src/oauth.js';
import { encrypt } from './src/utils/crypto.js';
import { OAUTH_CONFIGS } from './configs/index.ts';
import { getOAuthState, storeOAuthToken, loadServers, saveServer, deleteOAuthState } from './src/utils/storage.js';

// Handle OAuth callback
async function handleOAuthCallback(request, env) {
	const url = new URL(request.url);
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');

	if (error) {
		return new Response(`OAuth error: ${error}`, { status: 400 });
	}

	if (!code || !state) {
		return new Response('Missing code or state parameter', { status: 400 });
	}

	try {
		// Verify state
		const stateData = await getOAuthState(state, env);
		if (!stateData) {
			return new Response('Invalid or expired state', { status: 400 });
		}

		const { userId, service } = stateData;
		const config = OAUTH_CONFIGS[service];

		// Exchange code for token
		const tokenResponse = await fetch(config.tokenUrl, {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				client_id: config.clientId,
				client_secret: env[`${service.toUpperCase()}_CLIENT_SECRET`],
				code: code,
				redirect_uri: config.redirectUri,
				grant_type: 'authorization_code',
			}),
		});

		if (!tokenResponse.ok) {
			throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
		}

		const tokenData = await tokenResponse.json();
		console.log(`OAuth token response for ${service}: received successfully`);
		
		// Add issued_at timestamp for proper expiration calculation
		tokenData.issued_at = Date.now();
		
		// Store encrypted token
		const encryptedToken = encrypt(JSON.stringify(tokenData), env);
		await storeOAuthToken(userId, service, encryptedToken, env);

		// Add server to global servers list if not already present
		const serverUrl = config.serverUrl || `https://mcp.${service}.dev/mcp`;
		
		// Load existing servers and add the new one
		const servers = await loadServers(env);
		servers[service] = serverUrl;
		
		// Save updated config
		await saveServer(service, serverUrl, env);

		// Clean up state
		await deleteOAuthState(state, env);

		// Return success page
		return new Response(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>OAuth Success</title>
				<style>
					body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
					.success { color: #28a745; }
				</style>
			</head>
			<body>
				<h1 class="success">✅ Authentication Successful!</h1>
				<p>You have successfully authenticated with ${service}.</p>
				<p>You can now close this window and return to Slack.</p>
				<script>
					// Auto-close after 3 seconds
					setTimeout(() => window.close(), 3000);
				</script>
			</body>
			</html>
		`, {
			headers: { 'Content-Type': 'text/html' },
		});

	} catch (error) {
		console.error('OAuth callback error:', error);
		return new Response(`OAuth callback error: ${error.message}`, { status: 500 });
	}
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// Handle Slack events
		if (url.pathname === '/slack/events') {
			// Log the incoming request for debugging
			if (request.method === 'POST') {
				const clonedRequest = request.clone();
				const rawBody = await clonedRequest.text();
				console.log('Incoming Slack request body:', rawBody);
				
				// Handle URL-encoded payload (for modal submissions)
				if (rawBody.startsWith('payload=')) {
					try {
						const decodedPayload = decodeURIComponent(rawBody.substring(8)); // Remove 'payload='
						const body = JSON.parse(decodedPayload);
						console.log('Parsed URL-encoded Slack request:', {
							type: body.type,
							callback_id: body.view?.callback_id,
							payload: JSON.stringify(body, null, 2)
						});
					} catch (error) {
						console.log('Error parsing URL-encoded payload:', error);
					}
				} else {
					// Handle JSON payload (for regular events)
					try {
						const body = JSON.parse(rawBody);
						console.log('Parsed Slack request:', {
							type: body.type,
							event: body.event?.type,
							action: body.actions?.[0]?.action_id,
							payload: JSON.stringify(body, null, 2)
						});
						
						if (body.type === 'url_verification') {
							return new Response(body.challenge, {
								status: 200,
								headers: { 'Content-Type': 'text/plain' },
							});
						}
					} catch (error) {
						console.log('Error parsing request body:', error);
						// Not JSON or not a challenge request, continue with normal processing
					}
				}
			}

			const app = new SlackApp({ env });

			// Register all action handlers
			registerLaunchActions(app, env);
			registerServerActions(app, env);
			registerToolsActions(app, env);
			registerAuthActions(app, env);
			registerOAuthActions(app, env);

			return await app.run(request, ctx);
		}

		// Handle OAuth callback
		if (url.pathname === '/oauth/callback') {
			return await handleOAuthCallback(request, env);
		}

		// Default response for other routes
		return new Response('Snack Worker - Slack app with direct Mastra integration', {
			status: 200,
			headers: { 'Content-Type': 'text/plain' },
		});
	},
};
