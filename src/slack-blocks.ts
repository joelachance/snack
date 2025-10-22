export const helpMenuBlocks = [
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
			{
				type: 'button',
				text: {
					type: 'plain_text',
					text: 'Remove Server',
				},
				action_id: 'open_remove_server_modal',
				value: 'remove',
			},
			{
				type: 'button',
				text: {
					type: 'plain_text',
					text: 'OAuth Setup',
				},
				action_id: 'open_oauth_modal',
				value: 'oauth',
			},
		],
	},
];

export const serverModalView = {
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
};

export const removeServerModalView = {
	type: 'modal',
	callback_id: 'remove_server',
	title: {
		type: 'plain_text',
		text: 'Remove Server',
	},
	blocks: [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: '*Remove MCP Server*\nSelect the server you want to remove from your configuration.',
			},
		},
		{
			type: 'input',
			block_id: 'server_select_input',
			element: {
				type: 'static_select',
				action_id: 'server_select_value',
				placeholder: {
					type: 'plain_text',
					text: 'Select a server to remove',
				},
				options: [], // Will be populated dynamically
			},
			label: {
				type: 'plain_text',
				text: 'Server to Remove',
			},
		},
	],
	submit: {
		type: 'plain_text',
		text: 'Remove Server',
	},
};

export const oauthModalView = {
	type: 'modal',
	callback_id: 'oauth_setup',
	title: {
		type: 'plain_text',
		text: 'OAuth Setup',
	},
	blocks: [
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: '*OAuth Authentication*\n\nSelect a service to authenticate with using OAuth. This will open your browser to complete the authorization.',
			},
		},
		{
			type: 'input',
			block_id: 'oauth_service_input',
			element: {
				type: 'static_select',
				action_id: 'oauth_service_value',
				placeholder: {
					type: 'plain_text',
					text: 'Select a service',
				},
				options: [
					{
						text: {
							type: 'plain_text',
							text: 'Sentry',
						},
						value: 'sentry',
					},
					{
						text: {
							type: 'plain_text',
							text: 'GitHub',
						},
						value: 'github',
					},
				],
			},
			label: {
				type: 'plain_text',
				text: 'Service',
			},
		},
	],
	submit: {
		type: 'plain_text',
		text: 'Start OAuth',
	},
};

export const authModalView = {
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
};
