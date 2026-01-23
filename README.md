# NanoGPT OpenCode Setup

Automated setup scripts for configuring [OpenCode](https://opencode.ai) with [NanoGPT](https://nano-gpt.com) integration, featuring automatic model updates, reasoning model support, and built-in MCP server.

## Features

-   ✅ **CLI Login** - Easy browser-based authentication
-   ✅ **Auto Model Loading** - All models automatically fetched from NanoGPT API
-   ✅ **Reasoning Models** - Models with reasoning capabilities use v1thinking endpoint
-   ✅ **Interleaved Thinking** - Reasoning models support interleaved thinking with `reasoning_content` field
-   ✅ **Built-in MCP** - NanoGPT MCP server pre-configured
-   ✅ **Auto Updates** - Script to keep models up-to-date (can be added to .zshrc)
-   ✅ **Default Models** - Pre-configured with GLM 4.7 models

## Requirements

-   OpenCode installed (or will guide you through installation)
-   NanoGPT account (get API key from [nano-gpt.com/api](https://nano-gpt.com/api))
-   Python 3 (for JSON processing) or Node.js
-   curl (for API requests)

## Quick Start

### 1. Run Setup Script

```bash
cd /home/djdembeck/projects/github/setup-opencode-nanogpt
chmod +x setup-nanogpt-opencode.sh
./setup-nanogpt-opencode.sh
```

The script will:

1. Check if OpenCode is installed
2. Create necessary config directories
3. Authenticate via browser or API key
4. Fetch all available models from NanoGPT API
5. Configure OpenCode with:
    - Default model: `nanogpt/zai-org/glm-4.7`
    - Thinking model: `nanogpt/zai-org/glm-4.7:thinking`
    - All other available models
    - Built-in NanoGPT MCP server

### 2. Start Using OpenCode

```bash
opencode
```

Use the `/model` command to switch between models.

## Model Auto-Update

The setup script automatically configures model auto-updates in your shell configuration files. Models will fetch and sync with NanoGPT's latest offerings whenever you open a new terminal.

### Supported Shells

Auto-update is automatically added to:

- Zsh: `~/.zshrc`
- Bash: `~/.bashrc` and `~/.bash_profile`
- POSIX shells: `~/.profile`
- Fish shell: `~/.config/fish/config.fish`

### Manual Updates

To manually update models without waiting for a new shell session:

```bash
./update-nanogpt-models.sh
```

### Disable Auto-Update

Remove the following lines from your shell config if you want to disable automatic updates:

```bash
# Auto-update NanoGPT models from API (added by setup-nanogpt-opencode.sh)
source "/path/to/update-nanogpt-models.sh" 2>/dev/null || true
```

Or create a cron job for periodic updates:

```bash
# Update models daily at 6 AM
0 6 * * * /home/djdembeck/projects/github/setup-opencode-nanogpt/update-nanogpt-models.sh
```

## Configuration Details

### Config Files

-   **Auth**: `~/.local/share/opencode/auth.json`

    -   Stores NanoGPT API key securely
    -   Permissions: 600 (read/write for owner only)

-   **Config**: `~/.config/opencode/opencode.json`
    -   Contains provider and model configuration
    -   Includes MCP server settings
    -   Disables OpenCode Zen provider (shows only NanoGPT models)
    -   Permissions: 600 (read/write for owner only)

### Default Models

After setup, you'll have access to all NanoGPT models, with these defaults:

-   **Primary Model**: `zai-org/glm-4.7`

    -   GLM 4.7 base model
    -   200K context, 65K output
    -   Standard inference endpoint

-   **Thinking Model**: `zai-org/glm-4.7:thinking`
    -   GLM 4.7 with reasoning capabilities
    -   Uses v1thinking endpoint
    -   Interleaved thinking enabled with `reasoning_content` field
    -   200K context, 65K output

**Note**: Models are automatically configured with the `nanogpt` provider, so you reference them directly by their model ID (e.g., `zai-org/glm-4.7`) without needing to prefix `nanogpt/`.

### Reasoning Models

Models that support reasoning (like `zai-org/glm-4.7:thinking`) are automatically configured with:

-   **API Endpoint**: `https://nano-gpt.com/api/v1thinking`
-   **Interleaved Thinking**: Enabled via `reasoning_content` field
-   **Capabilities**: Marked with `reasoning: true`

This allows the model to show its thinking process inline with the response.

### MCP Server

The setup automatically configures the built-in NanoGPT MCP (Model Context Protocol) server, which gives OpenCode access to powerful tools:

```json
{
    "mcp": {
        "nanogpt": {
            "type": "local",
            "command": ["npx", "@nanogpt/mcp@latest", "--scope", "user"],
            "environment": {
                "NANOGPT_API_KEY": "your_api_key"
            },
            "enabled": true
        }
    }
}
```

#### Available MCP Tools

Once configured, you can ask OpenCode to use these tools:

-   **`nanogpt_chat`** - Send messages to any AI model available on NanoGPT
-   **`nanogpt_web_search`** - Search the web for current information
-   **`nanogpt_scrape_urls`** - Extract content from web pages
-   **`nanogpt_youtube_transcribe`** - Get transcripts from YouTube videos
-   **`nanogpt_image_generate`** - Generate images using DALL-E, Flux, Midjourney, etc.
-   **`nanogpt_get_balance`** - Check your NanoGPT account balance
-   **`nanogpt_list_text_models`** - List available text/chat models
-   **`nanogpt_list_image_models`** - List available image generation models

#### Using MCP Tools

Simply ask OpenCode in natural language:

```
Search the web for the latest AI news
```

```
Get the transcript from this YouTube video: https://youtube.com/watch?v=...
```

```
Generate an image of a futuristic city at sunset
```

Learn more at: [https://docs.nano-gpt.com/integrations/mcp](https://docs.nano-gpt.com/integrations/mcp)

## Switching Models

### In OpenCode UI

Use the command palette:

```
/model
```

Then select from the list of available models.

### Via Config File

Edit `~/.config/opencode/opencode.json`:

```json
{
    "model": "zai-org/glm-4.7:thinking",
    "disabled_providers": ["opencode"]
}
```

**Note**: The provider (`nanogpt`) is automatically applied, so you only need the model ID. The `disabled_providers` setting hides OpenCode Zen models (Big Pickle, Grok Code Fast).

## Available Models

All models from NanoGPT are automatically loaded. View the full list at:

-   [https://nano-gpt.com/models/text](https://nano-gpt.com/models/text)

Popular models include:

-   Claude (Anthropic) models
-   GPT (OpenAI) models
-   Gemini (Google) models
-   GLM (Zhipu AI) models
-   DeepSeek models
-   And many more...

## Troubleshooting

### OpenCode Not Found

Install OpenCode using one of these methods:

```bash
# Install script
curl -fsSL https://opencode.ai/install | bash

# npm (global)
npm i -g opencode-ai@latest

# Homebrew (macOS/Linux)
brew install anomalyco/tap/opencode
```

### Authentication Failed

1. Check your network connection
2. Verify your API key at [nano-gpt.com/api](https://nano-gpt.com/api)
3. Try manual API key entry instead of browser login

### Models Not Loading

1. Run the update script manually:

    ```bash
    ./update-nanogpt-models.sh
    ```

2. Check if your API key is valid:

    ```bash
    cat ~/.local/share/opencode/auth.json
    ```

3. Verify network access to nano-gpt.com

### MCP Server Not Working

1. Ensure npx is available:

    ```bash
    which npx
    ```

2. Install Node.js if missing:

    ```bash
    # Ubuntu/Debian
    sudo apt install nodejs npm

    # macOS
    brew install node
    ```

3. Check MCP server status in OpenCode logs

## Advanced Configuration

### Custom Base URL

Set a custom NanoGPT base URL:

```bash
export NANOGPT_BASE_URL=https://your-custom-url.com
./setup-nanogpt-opencode.sh
```

### Adding Custom Models

Edit `~/.config/opencode/opencode.json` and add models to the `models` section:

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
                    },
                    "api": {
                        "id": "your-custom-model",
                        "url": "https://nano-gpt.com/api/v1",
                        "npm": "@ai-sdk/openai-compatible"
                    }
                }
            }
        }
    }
}
```

### Disabling MCP Server

Edit `~/.config/opencode/opencode.json`:

```json
{
    "mcp": {
        "nanogpt": {
            "enabled": false
        }
    }
}
```

## Project Structure

```
setup-opencode-nanogpt/
├── setup-nanogpt-opencode.sh    # Main setup script
├── update-nanogpt-models.sh     # Model auto-update script
├── README.md                     # This file
├── opencode/                     # OpenCode source (reference)
├── nanocode/                     # NanoCode fork (reference)
└── opencode_nanogpt.sh          # Legacy script (deprecated)
```

## What's Different from Original OpenCode?

This setup is based on the NanoCode fork with these key features:

1. **Automatic Model Discovery**: Models are fetched from NanoGPT API instead of hardcoded
2. **Reasoning Support**: Models with reasoning capabilities automatically use v1thinking endpoint
3. **Interleaved Thinking**: Reasoning models show thinking process inline
4. **Built-in MCP**: NanoGPT MCP server is pre-configured
5. **Auto-Updates**: Includes script to keep models current

## Credits

-   [OpenCode](https://opencode.ai) - Original project by Anomaly
-   [NanoCode](https://github.com/nanogpt-community/nanocode) - Fork with NanoGPT integration
-   [NanoGPT](https://nano-gpt.com) - AI provider platform

## License

See LICENSE file in respective source directories.

## Support

-   OpenCode: [https://github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)
-   NanoGPT: [https://nano-gpt.com](https://nano-gpt.com)
-   NanoCode: [https://github.com/nanogpt-community/nanocode](https://github.com/nanogpt-community/nanocode)
