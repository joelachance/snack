// Tools Listing Feature
export const toolsActions = app => {
	/**
	 * Lists available MCP tools for a user
	 * @param {string} userId The Slack user ID
	 * @returns {Promise<Array>} Array of tool names
	 */
	const listTools = async (userId) => {
		// Fallback to hardcoded URL if env var is missing
		const apiUrl = process.env.API_URL || 'http://localhost:8787';
		const url = `${apiUrl}/mcp/tools?id=${userId}`;
		
		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				},
			});
			
			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}
			
			const data = await response.json();
			return data;
		} catch (error) {
			console.error(`Error fetching tools:`, error);
			throw error;
		}
	};

	// Actions for tools listing
	app.action('show_tools', async ({ ack, respond, body }) => {
		await ack();
		const userId = body?.user?.id;

		try {
			const tools = await listTools(userId);

			// Check if tools is an array
			if (!Array.isArray(tools)) {
				console.error('Tools response is not an array:', tools);
				await respond({
					text: 'Error: Invalid response from server. Please try again.',
					replace_original: true,
				});
				return;
			}

			if (tools.length === 0) {
				await respond({
					text: 'No tools available. Make sure you have configured MCP servers with valid authentication.',
					replace_original: true,
				});
				return;
			}

			// Format tools for display
			const toolList = tools.map(tool => `• ${tool}`).join('\n');

			await respond({
				text: `*Available MCP Tools:*\n\n${toolList}`,
				replace_original: true,
			});
		} catch (error) {
			console.error('Error listing tools:', error);
			await respond({
				text: `Error listing tools: ${error.message}`,
				replace_original: true,
			});
		}
	});

	// Future: Add more tool-related actions and views here
	// app.action('list_user_tools', ...)
	// app.action('execute_tool', ...)
	// app.view('tool_execution_modal', ...)
};
