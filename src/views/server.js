import { McpServerHub } from '../utils/mcp.js';
import { storeUserApiKey } from '../utils/storage.js';
import { encrypt } from '../utils/crypto.js';

/**
 * Register server management Slack views
 * @param {any} app - Slack app instance
 * @param {import('./types').Env} env - Environment variables
 */
export function registerServerViews(app, env) {
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

	app.view('remove_server', async obj => {
		const { payload: body, context } = obj;
		const client = context.client;
		const userId = body?.user?.id;
		const selectedServer =
			body.view?.state?.values?.server_select_input?.server_select_value?.selected_option?.value;

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
