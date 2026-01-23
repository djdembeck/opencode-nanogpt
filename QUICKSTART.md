# Quick Start Guide

## Setup in 3 Steps

### 1. Clone the repo and run the setup script

```bash
# SSH (recommended)
git clone git@github.com:djdembeck/opencode-nanogpt.git

# HTTPS (fallback)
# git clone https://github.com/djdembeck/opencode-nanogpt.git

cd opencode-nanogpt
chmod +x setup-nanogpt-opencode.sh update-nanogpt-models.sh
./setup-nanogpt-opencode.sh
```

### 2. Authenticate

Choose one:
- **Browser login** (recommended) - Opens browser for OAuth
- **API key** - Paste your key from [nano-gpt.com/api](https://nano-gpt.com/api)

### 3. Start OpenCode

```bash
opencode
```

## Default Configuration

After setup, you'll have:

- **Default Model**: `zai-org/glm-4.7` (standard inference)
- **Thinking Model**: `zai-org/glm-4.7:thinking` (reasoning with interleaved thinking)
- **All NanoGPT Models**: Automatically loaded from API (400+ models)
- **MCP Server**: Built-in NanoGPT MCP with web search, scraping, YouTube, images, etc.
- **Clean Model List**: OpenCode Zen disabled (only shows NanoGPT models)

## Switch Models

In OpenCode, press `Cmd+'` (Mac) or `Ctrl+'` (Linux) and type:
```
/model
```

Or use the default keybind to open model selector.

## Keep Models Updated

### Option 1: Automatic (Default)

The setup script automatically adds auto-update to your shell config files:

- `.zshrc` (Zsh)
- `.bashrc` (Bash)
- `.bash_profile` (macOS Bash)
- `.profile` (POSIX shells)
- `fish/config.fish` (Fish shell)

Models will update automatically when you open a new terminal.

### Option 2: Run Manually

```bash
./update-nanogpt-models.sh
```

## What Makes This Special?

1. **Auto-Discovery**: Models are fetched from NanoGPT API, not hardcoded
2. **Reasoning Models**: Automatically use `v1thinking` endpoint
3. **Interleaved Thinking**: See model's reasoning process inline
4. **MCP Built-in**: NanoGPT MCP server ready with tools for web search, scraping, YouTube, images, etc.

## Using MCP Tools

With the built-in MCP server, you can ask OpenCode to:

- **Search the web**: "Search for the latest AI developments"
- **Scrape websites**: "Get content from https://example.com"
- **YouTube transcripts**: "Get transcript from https://youtube.com/watch?v=..."
- **Generate images**: "Generate an image of a mountain landscape"
- **Check balance**: "What's my NanoGPT balance?"

No additional setup needed—just ask in natural language!

## Reasoning vs. Standard Models

### Standard Model (`zai-org/glm-4.7`)
- Regular inference
- Faster responses
- Endpoint: `https://nano-gpt.com/api/v1`

### Thinking Model (`zai-org/glm-4.7:thinking`)
- Shows reasoning process
- More detailed responses
- Interleaved thinking via `reasoning_content` field
- Endpoint: `https://nano-gpt.com/api/v1thinking`

## Need Help?

See the full [README.md](README.md) for:
- Troubleshooting
- Advanced configuration
- MCP setup details
- Custom model configuration
