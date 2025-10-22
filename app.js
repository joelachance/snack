import { SlackApp } from 'slack-cloudflare-workers';
import { registerMessageEvents } from './src/messages.js';
import { registerServerActions } from './src/actions/server.js';
import { registerServerViews } from './src/views/server.js';
import { registerToolsActions } from './src/actions/tool.js';
import { registerAuthActions } from './src/actions/auth.js';
import { registerAuthViews } from './src/views/auth.js';
import { registerOAuthActions } from './src/actions/oauth.js';
import { registerOAuthViews } from './src/views/oauth.js';
import { handleOAuthCallback } from './src/views/oauth-callback.js';
import { parseSlackPayload, handleUrlVerification } from './src/utils/slack-payload.js';

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		if (url.pathname === '/slack/events') {
			// Handle URL verification for POST requests
			if (request.method === 'POST') {
				const rawBody = await request.text();
				const payload = parseSlackPayload(rawBody);
				
				// Used to handle initial Slack verification
				if (payload) {
					const verificationResponse = handleUrlVerification(payload);
					if (verificationResponse) {
						return verificationResponse;
					}
				}
			}

			const app = new SlackApp({ env });
			registerMessageEvents(app, env);
			registerServerActions(app, env);
			registerServerViews(app, env);
			registerToolsActions(app, env);
			registerAuthActions(app, env);
			registerAuthViews(app, env);
			registerOAuthActions(app, env);
			registerOAuthViews(app, env);

			return await app.run(request, ctx);
		}

		if (url.pathname === '/oauth/callback') {
			return await handleOAuthCallback(request, env);
		}

		// Default response
		return new Response('Snack Worker - Slack app with direct Mastra integration', {
			status: 200,
			headers: { 'Content-Type': 'text/plain' },
		});
	},
};
