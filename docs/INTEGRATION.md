# NanoGPT Config Integration Guide

## Installation

```bash
npm install -g opencode-nanogpt
# or
npx opencode-nanogpt
```

## CLI Usage

### Initialize NanoGPT Provider
```bash
nanogpt-config init --api-key YOUR_API_KEY
```

### Update Models from API
```bash
nanogpt-config update-models --api-key YOUR_API_KEY
```

### Validate Configuration
```bash
nanogpt-config validate
```

### Rollback Changes
```bash
nanogpt-config rollback
```

### Format Configuration
```bash
nanogpt-config format
```

## Library Usage

```typescript
import { ConfigManager } from 'opencode-nanogpt';
import { ensureNanogptProvider, configureMcpEnvironment } from 'opencode-nanogpt/providers';

const configManager = new ConfigManager();
await ensureNanogptProvider(configManager, '~/.config/opencode/opencode.json');
await configureMcpEnvironment(configManager, '~/.config/opencode/opencode.json', 'api-key');
```

## Migration from Bash Scripts

### Old Way
```bash
./setup-nanogpt-opencode.sh
```

### New Way
```bash
nanogpt-config init --api-key YOUR_API_KEY
```

## Configuration Format

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "nanogpt/zai-org/glm-4.7:thinking",
  "provider": {
    "nanogpt": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "NanoGPT",
      "options": { "baseURL": "https://nano-gpt.com/api/v1" },
      "models": {}
    }
  },
  "mcp": {
    "nanogpt": {
      "type": "local",
      "command": ["npx", "@nanogpt/mcp@latest", "--scope", "user"],
      "environment": { "NANOGPT_API_KEY": "{env:NANOGPT_MCP_API_KEY}" },
      "enabled": true
    }
  }
}
```

## Troubleshooting

### Config file not found
Ensure the config path is correct or use `--config` flag.

### API key errors
Verify your API key at https://nano-gpt.com/api

### Permission denied
Ensure the config file has proper permissions (600).
