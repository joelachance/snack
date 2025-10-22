import { serverModalView, removeServerModalView } from './slack-blocks.js';
import { McpServerHub } from './mcp.js';

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
						const hasAccess = await mcpClient.userHasAccessToServer(
							userId,
							name,
							env.ENCRYPTION_KEY
						);
						const hasAuth = await mcpClient.userHasApiKey(userId, name);

						serverList.push({
							server: name,
							url: url,
							hasAccess,
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

			// Format servers for display
			const serverDisplay = serverList
				.map(server => `• *${server.server}*: ${server.url}`)
				.join('\n');

			// Send server list in the thread
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

		// Alternative extraction method
		const altServerName = body?.view?.state?.values?.server_input?.server_value?.value;
		const altServerUrl = body?.view?.state?.values?.url_input?.url_value?.value;

		// Debug logging
		console.log('Add server form data:', {
			userId,
			serverName,
			serverUrl,
			hasApiKey: !!apiKey,
			altServerName,
			altServerUrl,
			serverNameType: typeof serverName,
			serverUrlType: typeof serverUrl,
			serverNameLength: serverName?.length,
			serverUrlLength: serverUrl?.length
		});

		// Use alternative extraction if primary fails
		const finalServerName = serverName && serverName !== 'undefined' ? serverName : altServerName;
		const finalServerUrl = serverUrl && serverUrl !== 'undefined' ? serverUrl : altServerUrl;

		// Validate required fields
		if (!finalServerName || !finalServerUrl || finalServerName.trim() === '' || finalServerUrl.trim() === '') {
			console.log('Server validation failed:', {
				finalServerName,
				finalServerUrl,
				altServerName,
				altServerUrl
			});
			await client.chat.postMessage({
				channel: userId,
				text: 'Error: Server name and URL are required fields. Please fill in both fields and try again.',
			});
			return;
		}

		try {
			const mcpClient = new McpServerHub(env);

			// Add server globally
			await mcpClient.addServerGlobally(finalServerName, finalServerUrl);

			// Add user's API key if provided
			if (apiKey) {
				await mcpClient.addUserApiKey(userId, finalServerName, apiKey, env.ENCRYPTION_KEY);
			}

			await client.chat.postMessage({
				channel: userId,
				text: `Server "${finalServerName}" configured successfully!`,
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

			// Create options for the dropdown
			const serverOptions = Object.entries(servers).map(([name, url]) => ({
				text: {
					type: 'plain_text',
					text: `${name} (${url})`,
				},
				value: name,
			}));

			// Create the modal with populated options
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
		
		// Debug logging
		console.log('Remove server form data:', {
			userId,
			selectedServerPath: body.view?.state?.values?.server_select_input?.server_select_value?.selected_option?.value
		});
		
		const selectedServer = body.view?.state?.values?.server_select_input?.server_select_value?.selected_option?.value;

		if (!selectedServer) {
			console.log('No server selected, showing error');
			await client.chat.postMessage({
				channel: userId,
				text: 'Error: Please select a server to remove.',
			});
			return;
		}
		
		console.log('Selected server to remove:', selectedServer);

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
