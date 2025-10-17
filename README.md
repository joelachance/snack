# Snack



lightweight toolkit exposing agents on slack, running on cloudflare workers.

## Getting Started

First, configure a few environment-specific settings:

### 1. Update wrangler.jsonc
Replace the placeholder values in `wrangler.jsonc`:
- `"name": "snack"` → You can leave this, or change the name and make it your own
- `"ENCRYPTION_KEY": "<CREATE-A-STRONG-ENCRYPTION-KEY>"` → Pick a good one

### 2. Create KV Namespaces
You'll need to create your own KV namespace. KV is Cloudflare's key value store. Currently we only support KV.

```bash
# Create production KV namespace
npx wrangler kv namespace create "snack-kv"

# Copy the returned namespace IDs and update your `wrangler.jsonc` file.
# Set the encryption key you picked in step 1
```bash
npx wrangler secret put ENCRYPTION_KEY
```

### 4. Update Slack Configuration
Replace the project ID in `.slack/config.json`:
- `"project_id": "your-slack-project-id"` → Your Slack app project ID

### 5. Create Your Own Slack App
You'll need to create a new Slack app and update the configuration:
- Run `slack init` to create a new app
- Update `.slack/config.json` with your new project ID
- Update `manifest.json` with your app's display name

## Local Setup

`bun` is a strong favorite, although `npm`/`pnpm` should work great too.
### 1. Install Dependencies
```bash
bun i
```

### 2. Configure OpenAI API Key

Set up your OpenAI API key as a Cloudflare Worker secret.

1. Add to a .env file, using .env-example as a template.
2. Add to Cloudflare using wrangler:
```bash
wrangler secret put OPENAI_API_KEY
```
When prompted, enter your OpenAI API key. This will securely store your API key in Cloudflare Workers.
**Note**: You can get an OpenAI API key from [OpenAI's platform](https://platform.openai.com/api-keys).

### 3. Development
```bash
# Run Cloudflare Worker locally
npm run dev

# Run Slack app locally (in another terminal)
npm run dev:all
```

### 4. Test

```bash
npm test
```

### 5. Deploy

```bash
npm run deploy
```

### 6. Test the Setup

After setting up the OpenAI API key, you can test the chat endpoint:

```bash
# Start the development server
npm run dev

# In another terminal, test the chat endpoint
curl -X POST http://localhost:8787/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "threadId": "test123", "userId": "user123"}'
```

## Usage

Dockerfile and commands to deploy anywhere (CloudFlare out of the box, in this instance).

Add:
CLI to easily add mcp servers (supports which registries? Smithery, official?) - REMOTE ONLY
Since it's lightweight, let's use the smithery/cli to install CLIs. This requires some Smithery setup, and we've added Snack to
their cli as a supported client, because hell yeah we did

BUT-- install needs to call an API to upload the configuration to the hosted Snack instance.
BUT-- it also needs to happen locally.

So it's a cloudflare worker that is an MCP client that you can install in Slack, and has an API to add servers.

## Architecture

### Data Storage

**Global Server Configuration (KV Storage)**

- Server URLs are stored globally and shared across all Slack workspaces
- Key: `servers`
- Value: `{ "github": "https://api.github.com", "slack": "https://slack.com/api" }`
- Anyone can add server URLs, making them available to all users

**User-Specific API Keys (Encrypted KV Storage)**

- Each user's API keys are stored separately and encrypted
- Key format: `{userId}:{serverName}` (e.g., `"user123:github"`)
- Value: AES-GCM encrypted API key
- Encryption uses a 32-byte key derived from `ENCRYPTION_KEY` environment variable
- Each encryption uses a unique random IV for security

**Per-Workspace Configuration**

- Each Slack workspace can have different MCP servers configured
- Server URLs are global, but API keys are per-user
- Users authenticate with their own API keys for each server

### Security Features

- ✅ **AES-GCM Encryption** - Industry standard authenticated encryption for API keys
- ✅ **Random IV** - Each encryption uses a unique initialization vector
- ✅ **Environment-based encryption key** - Stored as Cloudflare Workers secret
- ✅ **User isolation** - Each user's API keys are stored separately
- ✅ **No plaintext storage** - All sensitive data is encrypted at rest

## Setup Cloudflare

### 1. Create KV Namespaces

You need to create two KV namespaces - one for production and one for preview:

```bash
# Create production KV namespace
npx wrangler kv namespace create "your-kv-binding"

# Create preview KV namespace  
npx wrangler kv namespace create "your-kv-binding" --preview
```

**Important**: Replace `"your-kv-binding"` with your desired binding name (this should match the `binding` field in `wrangler.jsonc`).

After creating the namespaces, you'll get output like:
```
✅ Successfully created KV namespace with id "abc123def456ghi789"
```

### 2. Update wrangler.jsonc

Copy the namespace IDs from the output above and update your `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "your-kv-binding",
    "id": "abc123def456ghi789",           // Production namespace ID
    "preview_id": "xyz789uvw456rst123",   // Preview namespace ID
  },
],
```

### 3. Set Encryption Key

Set a strong encryption key (use a 32+ character random string):

```bash
npx wrangler secret put ENCRYPTION_KEY
```

When prompted, enter a strong random string. This key is used to encrypt user API keys.

## Install Slack & Create Slack App

The easiest way to do this is to install the Slack CLI:

(Mac)

```bash
curl -fsSL https://downloads.slack-edge.com/slack-cli/install.sh | bash
```

(Windows)

```bash
irm https://downloads.slack-edge.com/slack-cli/install-windows.ps1 | iex
```

Check this worked by running

```bash
slack version
```

First, login to your Slack:

```bash
slack login
```

Follow the prompts to complete login.

Since we already have an app built in this repo, you'll want to init this pre-existing app:

```bash
slack init
```

? Do you want to add an existing app? (Y/n) N

```bash
slack run
```

'Create a new app' when prompted, chose your team (based on your previous `slack login`).

## Usage

**@mention the bot** to start a conversation. Each @mention creates a new thread automatically. Reply in the same thread to continue the conversation with full chat history.

**Authentication**: Use the "Authentication" button to add API keys for MCP servers. Keys are encrypted and stored per-user.

**Tools**: Available MCP tools depend on servers you've authenticated with. Global servers are available to all users who have valid authentication.

## Contributing

### Project Structure

```
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

### Tools Used

- **Cloudflare Workers**: Serverless runtime for the API
- **Hono**: Lightweight web framework for Workers
- **Slack CLI**: Local development and deployment
- **Wrangler**: Cloudflare Workers CLI
- **Mastra**: MCP client and agent framework
- **KV Storage**: Persistent data storage

### Development

```bash
# Install dependencies
npm install

# Run Cloudflare Worker locally
npm run dev

# Run Slack app locally
npm run dev:all

# Deploy to Cloudflare
npm run deploy
```

### Key Concepts

- **Stateless agents**: Fresh agent per request (Cloudflare Workers friendly)
- **Thread-based conversations**: Slack thread ID maintains chat history
- **Encrypted storage**: User API keys encrypted with AES-GCM
- **Global servers**: MCP servers shared across all users
