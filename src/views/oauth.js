import { OAUTH_CONFIGS } from '../../configs/index.js';
import { storeOAuthState } from '../utils/storage.js';

/**
 * Register OAuth-related Slack views
 * @param {any} app - Slack app instance
 * @param {import('./types').Env} env - Environment variables
 */
export function registerOAuthViews(app, env) {
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
			// Ignore parsing errors, use fallback
		}

		// Extract selected service with safe property access
		const selectedService =
			body?.view?.state?.values?.oauth_service_input?.oauth_service_value?.selected_option?.value;

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
			const state = crypto
				.getRandomValues(new Uint8Array(32))
				.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
			await storeOAuthState(
				state,
				{
					userId,
					service: selectedService,
					timestamp: Date.now(),
				},
				env
			);

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
}
