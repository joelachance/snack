import { encrypt } from '../utils/crypto.js';
import { OAUTH_CONFIGS } from '../../configs/index.ts';
import {
	getOAuthState,
	storeEncryptedOAuthToken,
	loadServers,
	saveServer,
	deleteOAuthState,
} from '../utils/storage.js';

/**
 * Processes OAuth callback, exchanges code for token, stores credentials, and renders success page
 * @param {Request} request - Incoming OAuth callback request
 * @param {import('../types').Env} env - Environment variables
 * @returns {Response} HTML success page or error response
 */
export async function handleOAuthCallback(request, env) {
	const url = new URL(request.url);
	const { code, state, error } = Object.fromEntries(url.searchParams);

	if (error) return new Response(`OAuth error: ${error}`, { status: 400 });
	if (!code || !state) return new Response('Missing code or state parameter', { status: 400 });

	try {
		const stateData = await getOAuthState(state, env);
		if (!stateData) return new Response('Invalid or expired state', { status: 400 });

		const { userId, service } = stateData;
		const config = OAUTH_CONFIGS[service];

		// Exchange code for token
		const tokenResponse = await fetch(config.tokenUrl, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				client_id: config.clientId,
				client_secret: env[`${service.toUpperCase()}_CLIENT_SECRET`],
				code,
				redirect_uri: config.redirectUri,
				grant_type: 'authorization_code',
			}),
		});

		if (!tokenResponse.ok) {
			throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
		}

		const tokenData = await tokenResponse.json();
		tokenData.issued_at = Date.now();

		const encryptedToken = encrypt(JSON.stringify(tokenData), env);
		await storeEncryptedOAuthToken(userId, service, encryptedToken, env);

		const serverUrl = config.serverUrl || `https://mcp.${service}.dev/mcp`;
		const servers = await loadServers(env);
		servers[service] = serverUrl;
		await saveServer(service, serverUrl, env);
		await deleteOAuthState(state, env);

		return new Response(`
			<!DOCTYPE html>
			<html>
			<head>
				<title>Authentication Complete</title>
				<style>
					body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
					.success { color: #28a745; }
				</style>
			</head>
			<body>
				<h1 class="success">Authentication Complete</h1>
				<p>You have successfully authenticated with ${service}.</p>
				<p>You can now close this window and return to Slack.</p>
				<script>
					setTimeout(() => window.close(), 3000);
				</script>
			</body>
			</html>
		`,
			{
				headers: { 'Content-Type': 'text/html' },
			}
		);
	} catch (error) {
		return new Response(`OAuth callback error: ${error.message}`, { status: 500 });
	}
}
