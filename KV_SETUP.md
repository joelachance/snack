# Cloudflare KV Setup Instructions

## 1. Create KV Namespace

```bash
# Create production namespace
wrangler kv:namespace create "MCP_CONFIG"

# Create preview namespace
wrangler kv:namespace create "MCP_CONFIG" --preview
```

## 2. Update wrangler.jsonc

Replace the placeholder IDs in wrangler.jsonc with the actual namespace IDs from step 1.

## 3. Set Environment Variables

### Required Secrets

```bash
# Set encryption key (REQUIRED for API key encryption)
# This will prompt you to enter a secure encryption key
npx wrangler secret put ENCRYPTION_KEY

# Set Slack credentials (if using Slack integration)
wrangler secret put SLACK_SIGNING_SECRET
wrangler secret put SLACK_BOT_TOKEN
```

### Encryption Key Requirements

- **Purpose**: Encrypts user API keys before storing in KV
- **Format**: Any secure string (recommend 32+ characters)
- **Security**: This key encrypts sensitive user data - keep it secure!
- **Error**: If missing, you'll get `Cannot read properties of undefined (reading 'words')` from crypto-js

### Verify Secrets

```bash
# List all secrets
npx wrangler secret list
```

## 4. Deploy

```bash
npm run deploy
```

## 5. Configure Slack App

Set your Slack app's Request URL to: `https://your-worker.your-subdomain.workers.dev/slack/events`

## 6. Troubleshooting

### Encryption Key Issues

```bash
# Error: Cannot read properties of undefined (reading 'words')
# Solution: Set the encryption key
npx wrangler secret put ENCRYPTION_KEY

# Error: Encryption key is required
# Solution: Verify the key is set
npx wrangler secret list
```

### KV Access Issues

```bash
# List all keys in your namespace
npx wrangler kv:key list --namespace-id="your-namespace-id"

# Get a specific key
npx wrangler kv:key get "servers" --namespace-id="your-namespace-id"
```
