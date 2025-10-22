import { authModalView } from '../slack-blocks.js';

/**
 * Register authentication-related Slack actions
 * @param {any} app - Slack app instance
 * @param {import('./types').Env} env - Environment variables
 */
export function registerAuthActions(app, _env) {
	app.action('open_auth_modal', async obj => {
		const { payload: body, context } = obj;
		const client = context.client;

		// Capture thread context for later use
		const channel = body?.channel?.id;
		const threadTs = body?.message?.thread_ts || body?.message?.ts;

		await client.views.open({
			trigger_id: body.trigger_id,
			view: authModalView,
			// Pass thread context through private metadata
			private_metadata: JSON.stringify({ channel, threadTs }),
		});
	});
}
