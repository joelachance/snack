/**
 * Entrypoint when you '@' the Slack bot
 * @param {*} app
 */
export const launchActions = app => {
	app.event('message', async args => {
		const { message, context, say } = args;

		if ('text' in message && message.text) {
			// Essentially the help screen. If the user only @s the bot, you get these tools
			const noMessage = message.text === `${context.botUserId}`;
			if (noMessage) {
				await say({
					text: 'whutup?',
					thread_ts: message.ts, // Reply in a thread
					blocks: [
						{
							type: 'section',
							text: {
								type: 'mrkdwn',
								text: 'whutup?',
							},
						},
						{
							type: 'actions',
							elements: [
								{
									type: 'button',
									text: {
										type: 'plain_text',
										text: 'Add Server',
									},
									action_id: 'open_server_modal',
									value: 'server',
								},
								{
									type: 'button',
									text: {
										type: 'plain_text',
										text: 'List Servers',
									},
									action_id: 'list_servers',
									value: 'list',
								},
								{
									type: 'button',
									text: {
										type: 'plain_text',
										text: 'Show Tools',
									},
									action_id: 'show_tools',
									value: 'tools',
								},
								{
									type: 'button',
									text: {
										type: 'plain_text',
										text: 'Authentication',
									},
									action_id: 'open_auth_modal',
									value: 'auth',
								},
							],
						},
					],
				});
			}
		}

		/**
		 * Main entry to chat w model + tools
		 * @param {string} message the user prompt
		 * @param {string} threadId id of thread
		 * @returns
		 */
		async function callModel(message, threadId) {
			const response = await fetch(`${process.env.API_URL}/llm/chat`, {
				method: 'POST',
				body: JSON.stringify({ message, threadId }),
			});
			return response.json();
		}

		// If the user mentions the bot and provides a message, we want to call mastra
		// This automatically creates a thread if one doesn't exist, or continues existing thread
		const mentioned = message.text.includes(`${context.botUserId}`);
		if (mentioned) {
			// Clean the message by removing the bot user ID
			const cleanMessage = message.text
				.replace(new RegExp(`<@${context.botUserId}>`, 'g'), '')
				.trim();

			// Use Slack's thread ID for conversation continuity
			// message.thread_ts = existing thread, message.ts = new thread
			const threadId = message.thread_ts ?? message.ts;
			const response = await callModel(cleanMessage, threadId);

			await say({
				text: response,
				thread_ts: threadId, // Reply in same thread for conversation continuity
			});
		}
	});
};
