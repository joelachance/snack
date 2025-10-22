import { oauthModalView } from '../slack-blocks.js';

/**
 * Register OAuth-related Slack actions
 * @param {any} app - Slack app instance
 * @param {import('./types').Env} env - Environment variables
 */
export function registerOAuthActions(app, _env) {
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
}
