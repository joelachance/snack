import { config } from 'dotenv';
import { App } from '@slack/bolt';
import { launchActions } from './actions/launch.js';
import { serverActions } from './actions/servers.js';
import { toolsActions } from './actions/tools.js';
import { authActions } from './actions/auth.js';

// Load environment variables from .env file
config();

/**
 * Main entry for the Slack app
 * The Slack CLI requires the entrypoint to be in an app.js file.
 * All functionality can be found in /features
 *
 * Exposes the following features:
 * 1. Add an MCP Server
 * 2. List MCP tools (across all servers)
 * 3. Authenticate (per user, per server)
 */
const app = new App({
	// TODO:  Add to README and add to .env, or `slack env`
	token: process.env.SLACK_BOT_TOKEN,
	socketMode: true,
	appToken: process.env.SLACK_APP_TOKEN,
});

(async () => {
	launchActions(app);
	serverActions(app);
	toolsActions(app);
	authActions(app);

	await app.start();
	console.log('⚡️ Slack app is running!');
})();
