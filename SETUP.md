# Environment Setup Instructions

## Required Environment Variables

### 1. OpenAI API Key

You need to set up your OpenAI API key as a Cloudflare Worker secret:

```bash
# Set the OpenAI API key as a secret in Cloudflare Workers
wrangler secret put OPENAI_API_KEY
```

When prompted, enter your OpenAI API key.

### 2. Encryption Key (Already Configured)

The encryption key is already configured in `wrangler.jsonc`:

- Current value: "joe" (you may want to change this to a more secure random string)

## Testing the Setup

After setting up the OpenAI API key, you can test the chat endpoint:

```bash
# Start the development server
npm run dev

# In another terminal, test the chat endpoint
curl -X POST http://localhost:8787/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "threadId": "test123", "userId": "user123"}'
```

## Model Configuration

The system is now configured to use:

- **Provider**: OpenAI
- **Model**: gpt-4o-mini
- **API Key**: Retrieved from Cloudflare Workers secrets

You can change the model by modifying the `provider` and `name` fields in `api/endpoints.ts` line 246-249.
