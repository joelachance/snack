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
3. Subscribe to `message.channels` and `message.groups` events
4. Add the bot to your workspace

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
