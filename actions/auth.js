// Authentication Feature
export const authActions = app => {
	// Actions for authentication
	app.action('open_auth_modal', async ({ ack, body, client }) => {
		await client.views.open({
			trigger_id: body.trigger_id,
			view: {
				type: 'modal',
				callback_id: 'auth_modal',
				title: {
					type: 'plain_text',
					text: 'Authentication Setup',
				},
				blocks: [
					{
						type: 'section',
						text: {
							type: 'mrkdwn',
							text: '*Secure Authentication*\nYour credentials are encrypted and stored securely.',
						},
					},
					{
						type: 'input',
						block_id: 'service_input',
						element: {
							type: 'plain_text_input',
							action_id: 'service_value',
							placeholder: {
								type: 'plain_text',
								text: 'e.g., GitHub, Slack, Notion',
							},
						},
						label: {
							type: 'plain_text',
							text: 'Service Name',
						},
					},
					{
						type: 'input',
						block_id: 'api_key_input',
						element: {
							type: 'plain_text_input',
							action_id: 'api_key_value',
							placeholder: {
								type: 'plain_text',
								text: 'Enter your API key or token',
							},
						},
						label: {
							type: 'plain_text',
							text: 'API Key',
						},
					},
				],
				submit: {
					type: 'plain_text',
					text: 'Save Credentials',
				},
			},
		});

		await ack();
	});

	// Views for authentication
	app.view('auth_modal', async ({ ack, body, view, client }) => {
		await ack();
		const userId = body?.user?.id;
		const serviceName = view?.state?.values?.service_input?.service_value?.value;
		const apiKey = view?.state?.values?.api_key_input?.api_key_value?.value;

		// Store encrypted credentials
		await storeAuth({
			userId,
			serviceName,
			apiKey: apiKey ? await encrypt(apiKey) : null,
			createdAt: new Date().toISOString(),
		});

		await client.chat.postMessage({
			channel: userId,
			text: `Authentication for "${serviceName}" saved successfully!`,
		});
	});

	// Future: Add more auth-related actions and views here
	// app.action('revoke_auth', ...)
	// app.action('list_auth_services', ...)
	// app.view('auth_management_modal', ...)
};
