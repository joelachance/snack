import { McpServerHub } from './mcp.js';

/**
 * Register tools-related Slack actions
 * @param {any} app - Slack app instance
 * @param {import('./types').Env} env - Environment variables
 */
export function registerToolsActions(app, env) {
	app.action('show_tools', async obj => {
		console.log('show_tools action triggered:', { userId: obj.payload?.user?.id, channel: obj.payload?.channel?.id });
		const { payload: body, context } = obj;
		const userId = body?.user?.id;
		const channel = body?.channel?.id;
		const threadTs = body?.message?.thread_ts || body?.message?.ts;

		if (!userId) {
			console.error('show_tools: Missing userId');
			return;
		}

		try {
			const mcpClient = new McpServerHub(env);
			const tools = await mcpClient.listAvailTools(userId, env.ENCRYPTION_KEY, env);

			if (tools.length === 0) {
				if (context.client) {
					await context.client.chat.postMessage({
						channel: channel,
						thread_ts: threadTs,
						text: 'No tools available. Make sure you have configured MCP servers with valid authentication.',
					});
				}
				return;
			}

			// Format tools for display
			const toolList = tools.map(tool => `• ${tool}`).join('\n');

			// Send tools list in the thread
			if (context.client) {
				await context.client.chat.postMessage({
					channel: channel,
					thread_ts: threadTs,
					text: `*Available MCP Tools:*\n\n${toolList}`,
				});
			}
		} catch (error) {
			console.error('Error listing tools:', error);
			if (context.client) {
				await context.client.chat.postMessage({
					channel: channel,
					thread_ts: threadTs,
					text: 'An error occurred while retrieving tools. Please try again or contact support.',
				});
			}
		}
	});
}
