/**
 * Entrypoint when you '@' the Slack bot
 * @param {*} app
 */
export const launchActions = app => {
	app.event('message', async args => {
		const { message, context, say } = args;

		if ('text' in message && message.text) {
			// Essentially the help screen. If the user only @s the bot, you get these tools
			// Check if message is just a mention (with or without spaces)
			const mentionPattern = new RegExp(`^<@${context.botUserId}>\\s*$`);
			const noMessage = mentionPattern.test(message.text);
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
		 * @param {string} userId the user ID
		 * @returns
		 */
		async function callModel(message, threadId, userId) {
			const response = await fetch(`${process.env.API_URL}/llm/chat`, {
				method: 'POST',
				body: JSON.stringify({ message, threadId, userId }),
			});
			return response.json();
		}

		if ('text' in message && message.text) {
			// Essentially the help screen. If the user only @s the bot, you get these tools
			// Check if message is just a mention (with or without spaces)
			const mentionPattern = new RegExp(`^<@${context.botUserId}>\\s*$`);
			const noMessage = mentionPattern.test(message.text);
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

			// If the user mentions the bot and provides a message, we want to call mastra
			// This automatically creates a thread if one doesn't exist, or continues existing thread
			const mentioned = message.text.includes(`${context.botUserId}`);
			if (mentioned) {
				// Clean the message by removing the bot user ID
				const cleanMessage = message.text
					.replace(new RegExp(`<@${context.botUserId}>`, 'g'), '')
					.trim();

				// Skip if the message is empty after cleaning (just @ mention with no text)
				if (!cleanMessage) {
					console.log('[DEBUG] Empty message after cleaning, skipping chat call');
					return;
				}

				// Use Slack's thread ID for conversation continuity
				// message.thread_ts = existing thread, message.ts = new thread
				const threadId = message.thread_ts ?? message.ts;
				const userId = args.body?.user?.id;
				
				const response = await callModel(cleanMessage, threadId, userId);

				await say({
					text: response.reply || response,
					thread_ts: threadId, // Reply in same thread for conversation continuity
				});
			}
		}
	});
};
