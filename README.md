# Snack

A lightweight MCP client toolkit for Slack, running on Cloudflare Workers.

## Getting Started

First, configure a few environment-specific settings:

### 1. Update wrangler.jsonc
Replace the placeholder values in `wrangler.jsonc`:
- `"name": "snack"` → You can leave this, or change the name and make it your own
- `"ENCRYPTION_KEY": "<CREATE-A-STRONG-ENCRYPTION-KEY>"` → Pick a good one


Once you've done this, run:
```bash
bunx wrangler deploy
```
This will give you an initial setup in Cloudflare.

### 2. Create KV Namespaces
You'll need to create your own KV namespace.  
(KV is Cloudflare's key value store. We only support KV currently)  

**Note:** Please use 'SNACK-KV' as the value, unless you change it in /api.

```bash
# Create production KV namespace
npx wrangler kv namespace create SNACK-KV

# Copy the returned namespace IDs and update your `wrangler.jsonc` file.
# Set the encryption key you picked in step 1
```bash
npx wrangler secret put ENCRYPTION_KEY
```

### 3. Configure OpenAI API Key
Set up your OpenAI API key.  
You can get an OpenAI API key from [OpenAI's platform](https://platform.openai.com/api-keys).

1. Add your new key to a .env file (use .env-example as a template).
2. Add to Cloudflare using wrangler:
```bash
wrangler secret put OPENAI_API_KEY
```
When prompted, enter your OpenAI API key. This will securely store your API key in Cloudflare Workers.

### 4. Init Your Slack App
You'll need to create a new Slack app and update the configuration:

1. Install Slack CLI:
```bash
# Mac
curl -fsSL https://downloads.slack-edge.com/slack-cli/install.sh | bash

# Windows
irm https://downloads.slack-edge.com/slack-cli/install-windows.ps1 | iex
```

2. Login to Slack:
```bash
slack login
```

3. Initialize your app:
```bash
slack init
```

4. Update configuration:
- Replace `"project_id": "your-slack-project-id"` in `.slack/config.json`
- Update `manifest.json` with your app's display name

## Running Locally

`bun` is a strong favorite, although `npm`/`pnpm` should work great too.

### 1. Install Dependencies
```bash
bun i
```

### 2. Development
```bash
# Run Cloudflare Worker locally
bun run dev

# Run Slack app locally (in another terminal)
bun run dev:all
```

### 3. Test the Chat
After setting up the OpenAI API key, you can test the chat endpoint:

```bash
# Start the development server
bun run dev

# In another terminal, test the chat endpoint
curl -X POST http://localhost:8787/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "threadId": "test123", "userId": "user123"}'
```

## Deployment

TBD

## Endpoint Overview

- `POST /llm/chat` - Chat with the AI agent
- `GET /mcp/servers` - List configured MCP servers
- `POST /mcp/servers` - Add a new MCP server
- `DELETE /mcp/servers/:name` - Remove an MCP server
- `GET /mcp/tools` - List available MCP tools for a user

## Running Tests

```bash
bun test
```

## Architecture

Snack defaults to Cloudflare Workers and KV.  
We're using @slack/bolt SDK to connect to Slack.

- **Cloudflare Workers**: Serverless runtime for the API
- **Slack/Bolt**: Slack app framework
- **Mastra**: MCP client and agent framework
- **KV Storage**: Key value store from Cloudflare

## Security
TBD  
- **AES-GCM Encryption** - Industry standard authenticated encryption for API keys
- **Environment-based encryption key** - Stored as Cloudflare Workers secrets
- **User isolation** - Each user's API keys are stored separately
- **No plaintext storage** - All sensitive data is encrypted at rest

## How to Contribute

TBD

### Project Structure

```˛
snack/
├── api/                    # Cloudflare Worker API
│   ├── endpoints.ts       # Hono API routes
│   ├── utils/             # Core utilities
│   │   ├── mcp.ts         # MCP server management
│   │   ├── storage.ts    # KV storage operations
│   │   ├── auth.ts        # User authentication
│   │   └── crypto.ts      # Encryption utilities
│   └── index.ts           # Worker entry point
├── actions/               # Slack app handlers
│   ├── launch.js         # Message handling
│   ├── servers.js        # Server management
│   ├── tools.js          # Tool listing
│   └── auth.js           # Authentication flows
└── package.json          # Dependencies
```