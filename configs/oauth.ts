export const OAUTH_CONFIGS = {
	sentry: {
		clientId: process.env.SENTRY_CLIENT_ID || 'MISSING_SENTRY_CLIENT_ID',
		redirectUri: process.env.SENTRY_REDIRECT_URI || 'MISSING_SENTRY_REDIRECT_URI',
		authUrl: 'https://sentry.io/oauth/authorize/',
		tokenUrl: 'https://sentry.io/oauth/token/',
		scope: 'project:read event:read',
		serverUrl: 'https://mcp.sentry.dev/mcp',
	},
	github: {
		clientId: process.env.GITHUB_CLIENT_ID || 'MISSING_GITHUB_CLIENT_ID',
		redirectUri: process.env.GITHUB_REDIRECT_URI || 'MISSING_GITHUB_REDIRECT_URI',
		authUrl: 'https://github.com/login/oauth/authorize',
		tokenUrl: 'https://github.com/login/oauth/access_token',
		scope: 'repo read:user',
		serverUrl: 'https://api.githubcopilot.com/mcp/',
	},
};
