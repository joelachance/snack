import { helpMenuBlocks } from './slack-blocks.js';
import { McpServerHub } from './mcp.js';

/**
 * Register launch-related Slack actions
 * @param {any} app - Slack app instance
 * @param {import('./types').Env} env - Environment variables
 */
export function registerLaunchActions(app, env) {
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

				if (!cleanMessage) {
					return;
				}

				const threadId = message.thread_ts ?? message.ts;
				const userId = message.user;

				try {
					const client = new McpServerHub(env);

					// Load conversation history using Slack's thread ID
					const conversationHistory = await client.loadConversationHistory(threadId);

					const { agent, cleanup } = await client.createAgentWithMCPTools(
						userId,
						env.ENCRYPTION_KEY,
						undefined, // Use default OpenAI model
						conversationHistory
					);

					const response = await agent.generate(cleanMessage);
					await cleanup();

					// Save conversation history using Slack's thread ID
					await client.addMessageToHistory(threadId, 'user', cleanMessage);
					await client.addMessageToHistory(threadId, 'assistant', response.text);

					await say({
						text: response.text,
						thread_ts: threadId,
					});
				} catch (error) {
					console.error('Error processing message:', error);
					await say({
						text: `Sorry, I encountered an error: ${error.message}`,
						thread_ts: threadId,
					});
				}
			}
		}
	});
}
