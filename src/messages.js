import { helpMenuBlocks } from '../slack-blocks.js';
import { McpServerHub } from '../utils/mcp.js';

/**
 * Register message event handlers
 * @param {any} app - Slack app instance
 * @param {import('./types').Env} env - Environment variables
 */
export function registerMessageEvents(app, env) {
	app.event('message', async ({ payload: message, context }) => {
		const say = context.say;

		if (!message || typeof message !== 'object') {
			return;
		}

		if (message && 'text' in message && message.text) {
			// If the message is simply `@arc` then you'll get the help screen
			const mentionPattern = new RegExp(`^<@${context.botUserId}>\\s*$`);
			const noMessage = mentionPattern.test(message.text);
			if (noMessage) {
				await say({
					text: 'help screen [TODO]',
					thread_ts: message.ts,
					blocks: helpMenuBlocks,
				});
			}

			// If message contains text in addition to `@arc` then we'll send it down to Mastra
			const mentioned = message.text.includes(`${context.botUserId}`);
			const isThreadReply = message.thread_ts && message.thread_ts !== message.ts;

			if (mentioned || isThreadReply) {
				const cleanMessage = message.text
					.replace(new RegExp(`<@${context.botUserId}>`, 'g'), '')
					.trim();

				if (cleanMessage) {
					try {
						const mcpClient = new McpServerHub(env);
						const response = await mcpClient.processMessage(cleanMessage, message.user, env);

						await say({
							text: response,
							thread_ts: message.ts,
						});
					} catch (error) {
						console.error('Error processing message:', error);
						await say({
							text: 'Sorry, I encountered an error processing your message. Please try again.',
							thread_ts: message.ts,
						});
					}
				}
			}
		}
	});
}
