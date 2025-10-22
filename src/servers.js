import { serverModalView, removeServerModalView } from './slack-blocks.js';
import { McpServerHub } from './mcp.js';
import { storeUserApiKey, userHasApiKey } from './utils/storage.js';
import { userHasAccessToServer } from './utils/auth.js';
import { encrypt } from './utils/crypto.js';

/**
 * Register server management Slack actions
 * @param {any} app - Slack app instance
 * @param {import('./types').Env} env - Environment variables
 */
export function registerServerActions(app, env) {
	app.action('list_servers', async obj => {
		const { payload: body, context } = obj;
		const userId = body?.user?.id;
		const channel = body?.channel?.id;
		const threadTs = body?.message?.thread_ts || body?.message?.ts;

		try {
			const mcpClient = new McpServerHub(env);
			const servers = await mcpClient.loadServersFromKV();
			const serverList = [];

			if (userId) {
				for (const [name, url] of Object.entries(servers)) {
					try {
						const hasAuth = await userHasApiKey(userId, name, env);

						serverList.push({
							server: name,
							url: url,
							hasAccess: hasAuth,
							hasAuth,
						});
					} catch (e) {
						console.error(`Error processing server ${name}:`, e);
						serverList.push({
							server: name,
							url: url,
							hasAccess: false,
							hasAuth: false,
						});
					}
				}
			}

			if (serverList.length === 0) {
				if (context.client) {
					await context.client.chat.postMessage({
						channel: channel,
						thread_ts: threadTs,
						text: "No servers configured yet. Use the 'Add Server' button to add one!",
					});
				}
				return;
			}

			// TODO: Format servers for display, make it prettier
			const serverDisplay = serverList
				.map(server => `• *${server.server}*: ${server.url}`)
				.join('\n');

			if (context.client) {
				await context.client.chat.postMessage({
					channel: channel,
					thread_ts: threadTs,
					text: `📋 *Configured MCP Servers:*\n\n${serverDisplay}`,
				});
			}
		} catch (error) {
			console.error('Error listing servers:', error);
			if (context.client) {
				await context.client.chat.postMessage({
					channel: channel,
					thread_ts: threadTs,
					text: 'An error occurred while listing servers. Please try again or contact support.',
				});
			}
		}
	});

	app.action('open_server_modal', async obj => {
		const { payload: body, context } = obj;
		const client = context.client;

		await client.views.open({
			trigger_id: body.trigger_id,
			view: serverModalView,
		});
	});

	app.view('add_server', async obj => {
		const { payload: body, context } = obj;
		const client = context.client;
		const view = body;
		const userId = body?.user?.id;
		const serverName = view?.state?.values?.server_input?.server_value?.value;
		const serverUrl = view?.state?.values?.url_input?.url_value?.value;
		const apiKey = view?.state?.values?.auth_input?.auth_value?.value;

		// Validate required fields
		if (!serverName || !serverUrl || serverName.trim() === '' || serverUrl.trim() === '') {
			await client.chat.postMessage({
				channel: userId,
				text: 'Error: Server name and URL are required fields. Please fill in both fields and try again.',
			});
			return;
		}

		try {
			const mcpClient = new McpServerHub(env);
			await mcpClient.addServerGlobally(serverName, serverUrl);

			// Add user's API key if provided
			if (apiKey) {
				const encryptedApiKey = encrypt(apiKey, env);
				await storeUserApiKey(userId, serverName, encryptedApiKey, env);
			}

			await client.chat.postMessage({
				channel: userId,
				text: `Server "${serverName}" configured successfully!`,
			});
		} catch (error) {
			console.error('Error adding server:', error);
			await client.chat.postMessage({
				channel: userId,
				text: 'An error occurred while adding the server. Please verify your inputs and try again.',
			});
		}
	});

	app.action('open_remove_server_modal', async obj => {
		const { payload: body, context } = obj;
		const client = context.client;

		try {
			const mcpClient = new McpServerHub(env);
			const servers = await mcpClient.loadServersFromKV();

			if (Object.keys(servers).length === 0) {
				await client.chat.postMessage({
					channel: body.user.id,
					text: 'No servers configured to remove.',
				});
				return;
			}

			const serverOptions = Object.entries(servers).map(([name, url]) => ({
				text: {
					type: 'plain_text',
					text: `${name} (${url})`,
				},
				value: name,
			}));

			const modalWithOptions = {
				...removeServerModalView,
				blocks: removeServerModalView.blocks.map(block => {
					if (block.block_id === 'server_select_input') {
						return {
							...block,
							element: {
								...block.element,
								options: serverOptions,
							},
						};
					}
					return block;
				}),
			};

			await client.views.open({
				trigger_id: body.trigger_id,
				view: modalWithOptions,
			});
		} catch (error) {
			console.error('Error opening remove server modal:', error);
			await client.chat.postMessage({
				channel: body.user.id,
				text: 'An error occurred while opening the remove server dialog. Please try again.',
			});
		}
	});

	app.view('remove_server', async obj => {
		const { payload: body, context } = obj;
		const client = context.client;
		const view = body;
		const userId = body?.user?.id;
		const selectedServer = body.view?.state?.values?.server_select_input?.server_select_value?.selected_option?.value;

		if (!selectedServer) {
			await client.chat.postMessage({
				channel: userId,
				text: 'Error: Please select a server to remove.',
			});
			return;
		}

		try {
			const mcpClient = new McpServerHub(env);
			await mcpClient.deleteServerFromKV(selectedServer);

			await client.chat.postMessage({
				channel: userId,
				text: `Server "${selectedServer}" has been removed successfully!`,
			});
		} catch (error) {
			console.error('Error removing server:', error);
			await client.chat.postMessage({
				channel: userId,
				text: 'An error occurred while removing the server. Please try again.',
			});
		}
	});
}
