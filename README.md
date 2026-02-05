# NanoGPT OpenCode Plugin

[![npm version](https://img.shields.io/npm/v/opencode-nanogpt)](https://www.npmjs.com/package/opencode-nanogpt)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

A Bun-powered CLI plugin for configuring [OpenCode](https://opencode.ai) with [NanoGPT](https://nano-gpt.com) integration. Features automatic model updates, reasoning model support, and built-in MCP server configuration.

## Installation

```bash
# Install globally with bun
bun install -g opencode-nanogpt

# Or use without installing
bunx opencode-nanogpt
```

## Quick Start

```bash
# Initialize with your API key
nanogpt-config init --api-key YOUR_API_KEY

# Update models from NanoGPT API
nanogpt-config update-models

# Validate your configuration
nanogpt-config validate
```

## Features

- **Surgical Editing** - Only modifies the nanogpt section, preserves everything else
- **JSONC Support** - Preserves comments and formatting in config files
- **Backup & Rollback** - Automatic backups before changes with rollback support
- **Validation** - Zod schema validation for configuration
- **Type Safety** - Full TypeScript support
- **Auto Model Loading** - All models automatically fetched from NanoGPT API
- **Reasoning Models** - Models with reasoning capabilities configured with interleaved thinking
- **Built-in MCP** - NanoGPT MCP server pre-configured
- **Auto Updates** - Keep models up-to-date via cron

## CLI Commands

### `init` - Initialize Configuration

```bash
nanogpt-config init --api-key YOUR_API_KEY
```

Sets up the NanoGPT provider in your OpenCode configuration with:

- NanoGPT API provider configuration
- MCP server setup
- Default models

### `update-models` - Update Models from API

```bash
# Update models (API key auto-detected from auth file or env)
nanogpt-config update-models

# With explicit API key
nanogpt-config update-models --api-key YOUR_API_KEY

# Force update even if no changes detected
nanogpt-config update-models --force
```

Fetches the latest models from NanoGPT API and updates your configuration.

### `validate` - Validate Configuration

```bash
nanogpt-config validate
```

Validates your OpenCode configuration file against the schema.

### `rollback` - Rollback Changes

```bash
nanogpt-config rollback
```

Restores the configuration from the most recent backup.

### `format` - Format Configuration

```bash
# Format config file
nanogpt-config format

# Check if formatting is needed
nanogpt-config format --check
```

Formats your configuration with proper indentation and structure.

## Model Auto-Update

Use cron for periodic automatic updates:

```bash
# Open crontab editor
crontab -e

# Add line to update models daily at 6 AM
0 6 * * * nanogpt-config update-models

# Or using bunx (always gets latest version)
0 6 * * * bunx opencode-nanogpt update-models
```

Other examples:

```bash
# Update every hour
0 * * * * nanogpt-config update-models

# Update weekly on Sundays at 3 AM
0 3 * * 0 nanogpt-config update-models

# With logging to track updates
0 6 * * * nanogpt-config update-models >> ~/.local/share/opencode/model-updates.log 2>&1
```

## Configuration

### Config Files

- **Auth**: `~/.local/share/opencode/auth.json`
  - Stores NanoGPT API key securely
  - Permissions: 600 (read/write for owner only)

- **Config**: `~/.config/opencode/opencode.json`
  - Contains provider and model configuration
  - Includes MCP server settings
  - Permissions: 600 (read/write for owner only)

### Default Models

After setup, you'll have access to all NanoGPT models, with these defaults:

- **Primary Model**: `zai-org/glm-4.7`
  - GLM 4.7 base model
  - 200K context, 65K output

- **Thinking Model**: `zai-org/glm-4.7:thinking`
  - GLM 4.7 with reasoning capabilities
  - Interleaved thinking enabled
  - 200K context, 65K output

### MCP Server

The plugin automatically configures the NanoGPT MCP (Model Context Protocol) server:

```json
{
  "mcp": {
    "nanogpt": {
      "type": "local",
      "command": ["bunx", "@nanogpt/mcp@latest", "--scope", "user"],
      "environment": {
        "NANOGPT_API_KEY": "your_api_key"
      },
      "enabled": true
    }
  }
}
```

#### Available MCP Tools

- **`nanogpt_chat`** - Send messages to any AI model
- **`nanogpt_web_search`** - Search the web
- **`nanogpt_scrape_urls`** - Extract content from web pages
- **`nanogpt_youtube_transcribe`** - Get YouTube transcripts
- **`nanogpt_image_generate`** - Generate images
- **`nanogpt_get_balance`** - Check account balance
- **`nanogpt_list_text_models`** - List text models
- **`nanogpt_list_image_models`** - List image models

Learn more: [https://docs.nano-gpt.com/integrations/mcp](https://docs.nano-gpt.com/integrations/mcp)

## Switching Models

### In OpenCode UI

Use the command palette:

```
/model
```

### Via Config File

Edit `~/.config/opencode/opencode.json`:

```json
{
  "model": "zai-org/glm-4.7:thinking",
  "disabled_providers": ["opencode"]
}
```

## Troubleshooting

### OpenCode Not Found

```bash
# Install script
curl -fsSL https://opencode.ai/install | bash

# bun (global)
bun install -g opencode-ai@latest

# Homebrew
brew install anomalyco/tap/opencode
```

### Authentication Failed

1. Check your network connection
2. Verify your API key at [nano-gpt.com/api](https://nano-gpt.com/api)
3. Check auth file: `cat ~/.local/share/opencode/auth.json`

### Models Not Loading

1. Run update manually: `nanogpt-config update-models`
2. Check API key is valid
3. Verify network access to nano-gpt.com

### MCP Server Not Working

1. Ensure bunx is available: `which bunx`
2. Install Bun: `curl -fsSL https://bun.sh/install | bash`
3. Check MCP server status in OpenCode logs

## Advanced Configuration

### Custom Base URL

```bash
export NANOGPT_BASE_URL=https://your-custom-url.com
nanogpt-config init --api-key YOUR_API_KEY
```

### Adding Custom Models

Edit `~/.config/opencode/opencode.json`:

```json
{
  "provider": {
    "nanogpt": {
      "models": {
        "your-custom-model": {
          "name": "Your Custom Model",
          "limit": {
            "context": 128000,
            "output": 4096
          }
        }
      }
    }
  }
}
```

## API Reference

See [docs/API.md](docs/API.md) for programmatic usage:

```typescript
import { ConfigManager } from "opencode-nanogpt";
import { updateModelsFromApi } from "opencode-nanogpt/api";

const configManager = new ConfigManager();
await updateModelsFromApi(configManager, configPath, apiKey);
```

## Project Structure

```
opencode-nanogpt/
├── src/
│   ├── cli/           # CLI commands
│   ├── api/           # NanoGPT API integration
│   ├── providers/     # Provider configuration
│   └── *.ts           # Core modules
├── dist/              # Compiled JavaScript
├── docs/              # Documentation
└── package.json
```

## Credits

- [OpenCode](https://opencode.ai) - Original project by Anomaly
- [NanoGPT](https://nano-gpt.com) - AI provider platform

## License

ISC
