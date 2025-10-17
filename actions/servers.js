/**
 * This file is organized by action. Each action has a helper function, a Slack action, and a Slack view.
 * @param {*} app Slack app
 */
export const serverActions = app => {
	/**
	 * Lists all MCP servers configured for the workspace
	 * @param {string} userId The Slack user ID
	 * @returns {Promise<Array>} Array of server objects
	 */
	const listServers = async () => {
		const response = await fetch(`${process.env.API_URL}/mcp/servers`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		});
		return response.json();
	};

	// Action to list all servers
	app.action('list_servers', async ({ ack, body, client }) => {
		const threadTs = body?.message?.ts;

		try {
			const servers = await listServers();

			if (servers.length === 0) {
				await client.chat.postMessage({
					channel: body?.channel?.id || body?.user?.id,
					text: "No servers configured yet. Use the 'Add Server' button to add one!",
					thread_ts: threadTs,
				});
				return;
			}

			// Format servers for display
			const serverList = servers.map(server => `• *${server.server}*: ${server.url}`).join('\n');

			await client.chat.postMessage({
				channel: body?.channel?.id || body?.user?.id,
				text: `📋 *Configured MCP Servers:*\n\n${serverList}`,
				thread_ts: threadTs,
			});
		} catch (error) {
			console.error('Error listing servers:', error);
			await client.chat.postMessage({
				channel: body?.channel?.id || body?.user?.id,
				text: `Error listing servers: ${error.message}`,
				thread_ts: threadTs,
			});
		}
		await ack();
	});

	/**
	 * Adds an MCP server to the workspace, and authenticates for the user who is adding the server
	 * @param {Object} data Input data from Slack user
	 * @returns
	 */
	const addServer = async data => {
		const response = await fetch(`${process.env.API_URL}/mcp/servers`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		});
		return response.json();
	};

	// Actions for server management
	app.action('open_server_modal', async ({ ack, body, client }) => {
		await client.views.open({
			trigger_id: body.trigger_id,
			view: {
				type: 'modal',
				callback_id: 'add_server',
				title: {
					type: 'plain_text',
					text: 'Add Server',
				},
				blocks: [
					{
						type: 'input',
						block_id: 'server_input',
						element: {
							type: 'plain_text_input',
							action_id: 'server_value',
							placeholder: {
								type: 'plain_text',
								text: 'Enter the server name.',
							},
						},
						label: {
							type: 'plain_text',
							text: 'Server Name',
						},
					},
					{
						type: 'input',
						block_id: 'url_input',
						element: {
							type: 'plain_text_input',
							action_id: 'url_value',
							placeholder: {
								type: 'plain_text',
								text: 'Enter the server URL.',
							},
						},
						label: {
							type: 'plain_text',
							text: 'Server URL',
						},
					},
					{
						type: 'input',
						block_id: 'auth_input',
						element: {
							type: 'plain_text_input',
							action_id: 'auth_value',
							placeholder: {
								type: 'plain_text',
								text: 'Enter your API key.',
							},
						},
						label: {
							type: 'plain_text',
							text: 'Credentials',
						},
					},
				],
				submit: {
					type: 'plain_text',
					text: 'Submit',
				},
			},
		});

		await ack();
	});

	// Views for server management
	app.view('add_server', async ({ ack, body, view, client }) => {
		await ack();
		const userId = body?.user?.id;
		const serverName = view?.state?.values?.server_input?.server_value?.value;
		const serverUrl = view?.state?.values?.url_input?.url_value?.value;
		const apiKey = view?.state?.values?.auth_input?.auth_value?.value;

		// Get the thread timestamp from the original message
		const threadTs = body?.message?.ts;

		try {
			await addServer({
				userId,
				serverName,
				serverUrl,
				apiKey,
			});

			await client.chat.postMessage({
				channel: body?.channel?.id || body?.user?.id,
				text: `Server "${serverUrl}" configured successfully!`,
				thread_ts: threadTs,
			});
		} catch (error) {
			console.error('Error adding server:', error);
			await client.chat.postMessage({
				channel: body?.channel?.id || body?.user?.id,
				text: `Error adding server: ${error.message}`,
				thread_ts: threadTs,
			});
		}
	});
};
