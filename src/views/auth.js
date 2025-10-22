import { storeAuth } from '../utils/storage.js';
import { encrypt } from '../utils/crypto.js';

/**
 * Register authentication-related Slack views
 * @param {any} app - Slack app instance
 * @param {import('./types').Env} env - Environment variables
 */
export function registerAuthViews(app, env) {
	app.view('auth_modal', async obj => {
		const { payload: body, context } = obj;
		const client = context.client;
		const view = body;
		const userId = body?.user?.id;
		const serviceName = view?.state?.values?.service_input?.service_value?.value;
		const apiKey = view?.state?.values?.api_key_input?.api_key_value?.value;

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

		try {
			await storeAuth(
				{
					userId,
					serviceName,
					apiKey: apiKey ? encrypt(apiKey, env) : null,
					createdAt: new Date().toISOString(),
				},
				env
			);

			// Reply in thread if we have thread context, otherwise send DM
			await client.chat.postMessage({
				channel: channel,
				thread_ts: threadTs,
				text: `Authentication for "${serviceName}" saved successfully!`,
			});
		} catch (error) {
			console.error('Error storing auth:', error);
			await client.chat.postMessage({
				channel: channel,
				thread_ts: threadTs,
				text: `Error saving authentication: ${error.message}`,
			});
		}
	});
}
