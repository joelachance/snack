import app from './endpoints';

/**
 * Cloudflare Worker Entrypoint
 * Learn more at https://developers.cloudflare.com/workers/
 *
 * This file serves as the bridge between Cloudflare Workers runtime and our Hono API.
 * It's the main entry point that Wrangler uses to deploy and run our application.
 *
 * ## Environment Variables (env):
 * - `snack-kv`: KV namespace for storing server configs and encrypted API keys
 * - `ENCRYPTION_KEY`: Secret key for encrypting/decrypting user API keys
 *
 * ## Related Files:
 * - `./endpoints.ts`: Contains all API route handlers
 * - `./mcp.ts`: MCP server management and Mastra integration
 * - `./crypto.ts`: Encryption utilities for API keys
 * - `wrangler.jsonc`: Cloudflare Worker configuration
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		return app.fetch(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
