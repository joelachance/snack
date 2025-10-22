# Snack

A Slack app with MCP integration running on Cloudflare Workers.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file with your Slack credentials:

```
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_BOT_TOKEN=xoxb-your_bot_token
SLACK_APP_TOKEN=xapp-your_app_token
OPENAI_API_KEY=your_openai_api_key
ENCRYPTION_KEY=your_encryption_key
```

### 3. Initialize KV Store

Create your own KV namespace:

```bash
# Create production KV namespace
npx wrangler kv namespace create SNACK-KV

# Copy the returned namespace ID and update wrangler.jsonc
# Replace the "id" field in the kv_namespaces section
```

**Note:** The `wrangler.jsonc` file contains a placeholder KV namespace ID. You must replace it with your own namespace ID after creating it.

### 4. Generate TypeScript Types

Generate Cloudflare Workers types:

```bash
npm run update-types
```

### 5. Run Locally

```bash
npm run dev
```

### 6. Deploy to Cloudflare

First, set up your secrets:

```bash
# Set up required secrets
wrangler secret put SLACK_SIGNING_SECRET
wrangler secret put SLACK_BOT_TOKEN
wrangler secret put SLACK_APP_TOKEN
wrangler secret put OPENAI_API_KEY
wrangler secret put ENCRYPTION_KEY
```

Then deploy:

```bash
npm run deploy
```

## Setup Slack App

1. Create a Slack app at [api.slack.com](https://api.slack.com/apps)
2. Set the Event Request URL to: `https://your-worker.your-subdomain.workers.dev/slack/events`
3. Set the Interactive Components Request URL to: `https://your-worker.your-subdomain.workers.dev/slack/events`
4. Subscribe to `message.channels` and `message.groups` events
5. Add the bot to your workspace

## OAuth Setup

### Sentry OAuth

1. **Create OAuth App in Sentry**:
   - Go to Settings → Developer Settings → Auth → OAuth Applications
   - Create new app with redirect URI: `https://your-worker.your-subdomain.workers.dev/oauth/callback`
   - Select scopes: `project:read` and `event:read`

2. **Set Environment Variables**:
   ```bash
   wrangler secret put SENTRY_CLIENT_ID
   wrangler secret put SENTRY_CLIENT_SECRET
   wrangler secret put SENTRY_REDIRECT_URI
   ```

### GitHub OAuth (Optional)

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GITHUB_REDIRECT_URI
```

**Important**: For local development, you'll need to expose your local server to the internet using a tool like ngrok:

```bash
# Install ngrok if you haven't already
npm install -g ngrok

# In one terminal, start your dev server
npm run dev

# In another terminal, expose localhost:1337
ngrok http 1337
```

Then use the ngrok URL (e.g., `https://abc123.ngrok.io/slack/events`) for both the Event Request URL and Interactive Components Request URL in your Slack app settings.

## Troubleshooting

### Buttons Not Working

If the Slack buttons are not responding:

1. **Check Interactive Components URL**: Ensure your Slack app has the Interactive Components Request URL set to your worker's `/slack/events` endpoint
2. **Verify Environment Variables**: Make sure all required environment variables are set, including `ENCRYPTION_KEY`
3. **Check Logs**: Look at the wrangler dev console output for any error messages
4. **Test with ngrok**: For local development, use ngrok to expose your local server to the internet

### Missing Logs

If you're not seeing logs in the console:

1. **Check wrangler dev**: Make sure `wrangler dev` is running and you can see the output
2. **Verify endpoint**: Test your endpoint with `curl http://localhost:1337/slack/events`
3. **Check Slack app logs**: Look at your Slack app's event logs in the Slack API dashboard

## Project Structure

```
src/
├── launch.js      # Message handling
├── servers.js     # Server management
├── tools.js       # Tool listing
├── auth.js        # Authentication
├── mcp.ts         # MCP integration
└── utils/         # Utilities
```

## Commands

- `npm run dev` - Start development server
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm test` - Run tests
