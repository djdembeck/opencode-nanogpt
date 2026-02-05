#!/bin/bash
# NanoGPT Models Auto-Update Script
# This script fetches the latest models from NanoGPT API and updates OpenCode configuration

# Determine config and auth directories
XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"

AUTH_DIR="$XDG_DATA_HOME/opencode"
AUTH_FILE="$AUTH_DIR/auth.json"

CONFIG_DIR="$XDG_CONFIG_HOME/opencode"

# Detect config file (prefer .jsonc over .json)
if [ -f "$CONFIG_DIR/opencode.jsonc" ]; then
    CONFIG_FILE="$CONFIG_DIR/opencode.jsonc"
elif [ -f "$CONFIG_DIR/opencode.json" ]; then
    CONFIG_FILE="$CONFIG_DIR/opencode.json"
else
    return 0 2>/dev/null || exit 0
fi

# Only run if auth exists
if [ ! -f "$AUTH_FILE" ]; then
    return 0 2>/dev/null || exit 0
fi

BASE_URL="${NANOGPT_BASE_URL:-https://nano-gpt.com}"
BASE_URL="${BASE_URL%/}"
API_V1_URL="${BASE_URL}/api/v1"

# Extract API key from auth.json
API_KEY=""
if command -v python3 &> /dev/null; then
    API_KEY=$(python3 -c "
import json
try:
    with open('$AUTH_FILE', 'r') as f:
        auth = json.load(f)
    nanogpt = auth.get('nanogpt', '')
    if isinstance(nanogpt, dict):
        print(nanogpt.get('key', ''))
    else:
        print(nanogpt)
except:
    pass
" 2>/dev/null)
fi

# If no API key, silently exit
if [ -z "$API_KEY" ]; then
    return 0 2>/dev/null || exit 0
fi

# Fetch models from API (silently)
fetch_nanogpt_models() {
    local api_key="$1"
    curl -sS "${API_V1_URL}/models?detailed=true" \
        -H "Authorization: Bearer ${api_key}" \
        2>/dev/null || true
}

MODELS_JSON=$(fetch_nanogpt_models "$API_KEY")

# If no models fetched, exit silently
if [ -z "$MODELS_JSON" ]; then
    return 0 2>/dev/null || exit 0
fi

# Update config with new models
if command -v python3 &> /dev/null; then
    # Write models JSON to temp file to avoid argument list size limits
    TEMP_MODELS_FILE=$(mktemp)
    printf '%s' "$MODELS_JSON" > "$TEMP_MODELS_FILE"
    
    NANOGPT_API_V1="$API_V1_URL" \
    CONFIG_FILE_PATH="$CONFIG_FILE" \
    MODELS_FILE_PATH="$TEMP_MODELS_FILE" \
    python3 << 'EOF' 2>/dev/null
import json
import os

config_file = os.environ.get("CONFIG_FILE_PATH")
api_v1 = os.environ.get("NANOGPT_API_V1", "https://nano-gpt.com/api/v1")
models_file = os.environ.get("MODELS_FILE_PATH")

# Read models JSON from temp file to avoid argument list size limits
models_json_str = ""
if models_file:
    try:
        with open(models_file, "r") as f:
            models_json_str = f.read()
    except Exception:
        pass

# Load existing config (handle JSONC with comments and trailing commas)
# Also handle JSON5 format (unquoted property names)
try:
    with open(config_file, "r") as f:
        content = f.read()
    import re
    # Strip single-line comments (// ...) but not URLs like http://
    content = re.sub(r'(?<!:)(?<!/)(?<!)//.*$', '', content, flags=re.MULTILINE)
    # Strip multi-line comments (/* ... */)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    # Strip trailing commas before } or ]
    content = re.sub(r',(\s*[}\]])', r'\1', content)
    
    # Try standard JSON first
    try:
        config = json.loads(content)
    except json.JSONDecodeError:
        # Try JSON5 format (unquoted keys)
        try:
            import json5
            config = json5.loads(content)
        except ImportError:
            # No json5 library, can't parse
            exit(0)
        except Exception:
            exit(0)
except (json.JSONDecodeError, FileNotFoundError):
    exit(0)

# Ensure schema reference exists
config["$schema"] = "https://opencode.ai/config.json"

# Check if nanogpt provider exists
if "provider" not in config or "nanogpt" not in config["provider"]:
    exit(0)

# Parse fetched models
models_dict = {}
if models_json_str:
    try:
        models_data = json.loads(models_json_str)
        if "data" in models_data and isinstance(models_data["data"], list):
            for model in models_data["data"]:
                model_id = model.get("id")
                if not model_id:
                    continue
                
                # Handle None values from API
                context_length = model.get("context_length") or 128000
                output_limit = model.get("max_output_tokens") or min(context_length, 128000)

                model_config = {
                    "id": model_id,
                    "name": model.get("name", model_id),
                    "limit": {
                        "context": context_length,
                        "output": output_limit
                    }
                }

                caps = model.get("capabilities", {})
                if caps.get("reasoning") is not None:
                    model_config["reasoning"] = caps["reasoning"]

                model_config["temperature"] = True
                model_config["tool_call"] = True

                if caps.get("reasoning"):
                    model_config["interleaved"] = {"field": "reasoning_content"}
                
                input_modalities = ["text"]
                if caps.get("vision"):
                    input_modalities.append("image")
                
                model_config["modalities"] = {
                    "input": input_modalities,
                    "output": ["text"]
                }
                
                pricing = model.get("pricing", {})
                if pricing.get("prompt") is not None and pricing.get("completion") is not None:
                    model_config["cost"] = {
                        "input": pricing["prompt"],
                        "output": pricing["completion"]
                    }
                
                created = model.get("created")
                if created:
                    from datetime import datetime
                    try:
                        model_config["release_date"] = datetime.fromtimestamp(created).strftime("%Y-%m-%d")
                    except:
                        pass
                
                models_dict[model_id] = model_config
    except Exception:
        exit(0)

# Only update if we have models
if models_dict:
    config["provider"]["nanogpt"]["models"] = models_dict
    
    # Write back to config file
    try:
        with open(config_file, "w") as f:
            json.dump(config, f, indent=2)
    except Exception:
        pass

EOF
    
    rm -f "$TEMP_MODELS_FILE"
fi
