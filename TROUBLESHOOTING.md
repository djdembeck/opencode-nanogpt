# Troubleshooting Guide

## Model Selection Issues

### "Big Pickle" or Wrong Default Model

The setup script automatically disables the OpenCode Zen provider to show only NanoGPT models. If you see "Big Pickle" or another unexpected model, check your config.

**Solution:**

1. Verify `disabled_providers` is set:

    ```bash
    cat ~/.config/opencode/opencode.json | jq '.disabled_providers'
    ```

    Should show: `["opencode"]`

2. Check your config file:

    ```bash
    cat ~/.config/opencode/opencode.json
    ```

3. Verify the model and disabled_providers are set:

    ```json
    {
      "model": "zai-org/glm-4.7",
      "disabled_providers": ["opencode"],
      "provider": {
        "nanogpt": {
          ...
        }
      }
    }
    ```

4. If the config exists but models aren't showing:

    - Restart OpenCode completely
    - Check that the NanoGPT provider is configured
    - Verify models are listed in the config under `provider.nanogpt.models`

5. Manually select the model:
    - In OpenCode, press `Cmd+'` (Mac) or `Ctrl+'` (Linux)
    - Type `/model`
    - Select `zai-org/glm-4.7` or `zai-org/glm-4.7:thinking`

### Models Not Fetched from API

If you see the warning "Could not fetch models from API, will use defaults", check:

1. **Network Connection**:

    ```bash
    curl -I https://nano-gpt.com/api/v1/models
    ```

2. **API Key Authentication**:

    ```bash
    # Test with your API key
    curl -H "Authorization: Bearer YOUR_API_KEY" \
         "https://nano-gpt.com/api/v1/models?detailed=true"
    ```

3. **Script Permissions**:

    ```bash
    chmod +x setup-nanogpt-opencode.sh
    ```

4. **Re-run Setup**:
    ```bash
    ./setup-nanogpt-opencode.sh
    ```

## Model Format

### Understanding Model IDs

OpenCode uses a provider-based system:

-   **Config Format**: Models are stored under `provider.nanogpt.models`
-   **Selection Format**: When selecting a model, use just the model ID: `zai-org/glm-4.7`
-   **Not Required**: You don't need to prefix with `nanogpt/`

### Example Config Structure

```json
{
    "model": "zai-org/glm-4.7",
    "provider": {
        "nanogpt": {
            "name": "NanoGPT",
            "npm": "@ai-sdk/openai-compatible",
            "options": {
                "baseURL": "https://nano-gpt.com/api/v1"
            },
            "models": {
                "zai-org/glm-4.7": {
                    "name": "GLM 4.7",
                    "api": {
                        "id": "zai-org/glm-4.7",
                        "url": "https://nano-gpt.com/api/v1",
                        "npm": "@ai-sdk/openai-compatible"
                    },
                    "limit": {
                        "context": 200000,
                        "output": 65535
                    }
                },
                "zai-org/glm-4.7:thinking": {
                    "name": "GLM 4.7 (Thinking)",
                    "api": {
                        "id": "zai-org/glm-4.7:thinking",
                        "url": "https://nano-gpt.com/api/v1thinking",
                        "npm": "@ai-sdk/openai-compatible"
                    },
                    "capabilities": {
                        "reasoning": true,
                        "interleaved": {
                            "field": "reasoning_content"
                        }
                    }
                }
            }
        }
    }
}
```

## Config File Not Loading

If OpenCode isn't loading your config:

1. **Check File Location**:

    ```bash
    ls -la ~/.config/opencode/opencode.json
    ```

2. **Check File Permissions**:

    ```bash
    chmod 600 ~/.config/opencode/opencode.json
    ```

3. **Validate JSON**:

    ```bash
    cat ~/.config/opencode/opencode.json | python3 -m json.tool
    ```

4. **Check for Multiple Config Files**:
   OpenCode may check multiple locations:
    - `~/.config/opencode/opencode.json` (preferred)
    - `~/opencode.json`
    - `$(pwd)/opencode.json` (project-specific)

## Auth Issues

### API Key Not Working

1. **Verify Key Format**:

    ```bash
    cat ~/.local/share/opencode/auth.json
    ```

    Should look like:

    ```json
    {
        "nanogpt": "your-api-key-here"
    }
    ```

2. **Test API Key Directly**:

    ```bash
    curl -H "Authorization: Bearer YOUR_API_KEY" \
         "https://nano-gpt.com/api/v1/models"
    ```

3. **Re-authenticate**:
    ```bash
    ./setup-nanogpt-opencode.sh
    ```
    Choose option 1 for browser login or option 2 to paste a new key.

## MCP Server Issues

### MCP Server Not Starting

1. **Check Node.js/npx**:

    ```bash
    which npx
    npx --version
    ```

2. **Test MCP Command**:

    ```bash
    npx @nanogpt/mcp@latest --help
    ```

3. **Check MCP Config**:

    ```bash
    cat ~/.config/opencode/opencode.json | grep -A 10 '"mcp"'
    ```

4. **Verify API Key in MCP Environment**:

    ```bash
    # Check if API key is set in MCP config
    cat ~/.config/opencode/opencode.json | jq '.mcp.nanogpt.environment'
    ```

5. **Manually Install MCP**:
    ```bash
    npm install -g @nanogpt/mcp@latest
    ```

### MCP Tools Not Working

1. **Check MCP Server Status**:

    ```bash
    # In OpenCode, check logs for MCP connection status
    # Look for "mcp server connected" or errors
    ```

2. **Verify API Key**:

    ```bash
    # Ensure your API key is valid
    cat ~/.local/share/opencode/auth.json
    ```

3. **Test MCP Directly**:

    ```bash
    # Test the MCP server directly
    NANOGPT_API_KEY="your_key" npx @nanogpt/mcp@latest
    ```

4. **Check MCP Server Logs**:
    - MCP servers run as child processes
    - Look for errors in OpenCode's debug logs
    - Enable debug logging if needed

### "Missing required env var: NANOGPT_API_KEY"

The MCP server needs your API key. Make sure the environment variable is set in the config:

```json
{
    "mcp": {
        "nanogpt": {
            "environment": {
                "NANOGPT_API_KEY": "your_key_here"
            }
        }
    }
}
```

Re-run the setup script to fix this automatically.

## Auto-Update Issues

### Models Not Updating Automatically

The setup script adds auto-update to shell config files. If models aren't updating:

1. **Check if the source line was added**:

    ```bash
    grep "update-nanogpt-models" ~/.zshrc ~/.bashrc ~/.profile 2>/dev/null
    ```

2. **Manually add it if missing**:

    ```bash
    # For Zsh
    echo 'source "/path/to/update-nanogpt-models.sh" 2>/dev/null || true' >> ~/.zshrc
    
    # For Bash
    echo 'source "/path/to/update-nanogpt-models.sh" 2>/dev/null || true' >> ~/.bashrc
    ```

3. **Reload shell config**:

    ```bash
    source ~/.zshrc
    # or
    source ~/.bashrc
    ```

4. **Test manual update**:

    ```bash
    ./update-nanogpt-models.sh
    ```

If all else fails, do a clean reinstall:

```bash
# Backup existing config (optional)
cp ~/.config/opencode/opencode.json ~/opencode-backup.json
cp ~/.local/share/opencode/auth.json ~/opencode-auth-backup.json

# Remove existing config
rm -rf ~/.config/opencode
rm -rf ~/.local/share/opencode

# Re-run setup
./setup-nanogpt-opencode.sh
```

## Getting Help

If problems persist:

1. **Check Logs**:

    - OpenCode logs location varies by installation method
    - Look for error messages related to provider or model loading

2. **Test Components Individually**:

    - Test API: `curl https://nano-gpt.com/api/v1/models`
    - Test Auth: Check auth.json file
    - Test Config: Validate JSON syntax

3. **Minimal Config Test**:
   Create a minimal config to isolate issues:
    ```json
    {
        "model": "zai-org/glm-4.7",
        "provider": {
            "nanogpt": {
                "npm": "@ai-sdk/openai-compatible",
                "name": "NanoGPT",
                "options": {
                    "baseURL": "https://nano-gpt.com/api/v1"
                },
                "models": {
                    "zai-org/glm-4.7": {
                        "name": "GLM 4.7",
                        "limit": {
                            "context": 200000,
                            "output": 65535
                        }
                    }
                }
            }
        }
    }
    ```
