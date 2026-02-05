#!/bin/bash
set -euo pipefail

# DEPRECATION NOTICE
# This script is deprecated. Please use the opencode-nanogpt Bun package instead.
# Install: bun install -g opencode-nanogpt
# Usage: nanogpt-config init --api-key YOUR_API_KEY
# See: https://github.com/djdembeck/opencode-nanogpt#readme

echo "WARNING: This script is deprecated." >&2
echo "Please use: bun install -g opencode-nanogpt" >&2
echo "Then run: nanogpt-config init --api-key YOUR_API_KEY" >&2
echo "" >&2
read -p "Continue anyway? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

BASE_URL="${NANOGPT_BASE_URL:-https://nano-gpt.com}"
BASE_URL="${BASE_URL%/}"
API_URL="${BASE_URL}/api"
API_V1_URL="${BASE_URL}/api/v1"
MODELS_URL="${BASE_URL}/models/text"

# JSON parsing helper functions
json_get() {
    local key="$1"

    if command -v python3 &> /dev/null; then
        JSON_KEY="$key" python3 - << 'EOF'
import json
import os
import sys

key = os.environ.get("JSON_KEY", "")
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}

val = data.get(key, "")
if isinstance(val, (dict, list)) or val is None:
    val = ""
print(val)
EOF
        return $?
    fi

    if command -v python &> /dev/null; then
        JSON_KEY="$key" python - << 'EOF'
import json
import os
import sys

key = os.environ.get("JSON_KEY", "")
try:
    data = json.load(sys.stdin)
except Exception:
    data = {}

val = data.get(key, "")
if isinstance(val, (dict, list)) or val is None:
    val = ""
print(val)
EOF
        return $?
    fi

    if command -v node &> /dev/null; then
        JSON_KEY="$key" node - << 'EOF'
const fs = require("fs");
const key = process.env.JSON_KEY || "";
let data = {};
try {
  const raw = fs.readFileSync(0, "utf8");
  data = raw ? JSON.parse(raw) : {};
} catch (_) {
  data = {};
}
let val = data[key];
if (val === undefined || val === null || typeof val === "object") {
  val = "";
}
process.stdout.write(String(val));
EOF
        return $?
    fi

    return 1
}

json_get_fallback() {
    local key="$1"
    local raw

    raw=$(sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]*)\".*/\\1/p")
    if [ -n "$raw" ]; then
        printf '%s' "$raw"
        return 0
    fi

    raw=$(sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*([0-9]+).*/\\1/p")
    if [ -n "$raw" ]; then
        printf '%s' "$raw"
        return 0
    fi

    return 1
}

json_extract() {
    local body="$1"
    local key="$2"
    local val

    val=$(printf '%s' "$body" | json_get "$key" || true)
    if [ -z "$val" ]; then
        val=$(printf '%s' "$body" | json_get_fallback "$key" || true)
    fi
    printf '%s' "$val"
}

open_url() {
    local url="$1"
    if command -v open &> /dev/null; then
        open "$url" >/dev/null 2>&1 || true
    elif command -v xdg-open &> /dev/null; then
        xdg-open "$url" >/dev/null 2>&1 || true
    fi
}

device_login() {
    local client_name="$1"
    local start_payload
    local response http_code body

    start_payload=$(printf '{"client_name":"%s"}' "$client_name")
    response=$(curl -sS -X POST "${API_URL}/cli-login/start" \
        -H "Content-Type: application/json" \
        -d "$start_payload" \
        -w '\n%{http_code}' || true)

    http_code=$(printf '%s' "$response" | tail -n1)
    body=$(printf '%s' "$response" | sed '$d')

    if [ -z "$http_code" ]; then
        echo -e "${RED}✗ Failed to reach ${API_URL}. Check your network.${NC}"
        return 1
    fi

    if [ "$http_code" != "200" ]; then
        echo -e "${RED}✗ Failed to start CLI login (HTTP ${http_code}).${NC}"
        return 1
    fi

    local device_code user_code verify_url interval expires_in
    device_code=$(json_extract "$body" "device_code")
    user_code=$(json_extract "$body" "user_code")
    verify_url=$(json_extract "$body" "verification_uri_complete")
    interval=$(json_extract "$body" "interval")
    expires_in=$(json_extract "$body" "expires_in")

    if [ -z "$device_code" ] || [ -z "$verify_url" ]; then
        echo -e "${RED}✗ Unable to parse CLI login response.${NC}"
        return 1
    fi

    if [ -z "$interval" ]; then
        interval="2"
    fi
    if [ -z "$expires_in" ]; then
        expires_in="600"
    fi

    echo ""
    echo -e "${BLUE}Authenticate via browser${NC}"
    echo "Open this URL and approve:"
    echo -e "  ${YELLOW}${verify_url}${NC}"
    if [ -n "$user_code" ]; then
        echo "Code: ${user_code}"
    fi
    echo ""
    open_url "$verify_url"

    local deadline
    deadline=$(( $(date +%s) + expires_in ))

    while true; do
        if [ "$(date +%s)" -gt "$deadline" ]; then
            echo -e "${RED}✗ Login request expired. Please retry.${NC}"
            return 1
        fi

        response=$(curl -sS -X POST "${API_URL}/cli-login/poll" \
            -H "Content-Type: application/json" \
            -d "{\"device_code\":\"${device_code}\"}" \
            -w '\n%{http_code}' || true)

        http_code=$(printf '%s' "$response" | tail -n1)
        body=$(printf '%s' "$response" | sed '$d')

        local status key error_msg
        status=$(json_extract "$body" "status")
        error_msg=$(json_extract "$body" "error")

        if [ -z "$http_code" ]; then
            echo -e "${RED}✗ Failed to reach ${API_URL}. Check your network.${NC}"
            return 1
        fi

        if [ "$http_code" = "200" ] && [ "$status" = "approved" ]; then
            key=$(json_extract "$body" "key")
            if [ -n "$key" ]; then
                API_KEY="$key"
                return 0
            fi
            echo -e "${RED}✗ Login approved, but no API key returned.${NC}"
            return 1
        fi

        if [ "$http_code" = "202" ] || [ "$status" = "authorization_pending" ]; then
            sleep "$interval"
            continue
        fi

        if [ "$http_code" = "410" ] || [ "$status" = "expired" ]; then
            echo -e "${RED}✗ Login request expired. Please retry.${NC}"
            return 1
        fi

        if [ "$http_code" = "409" ] || [ "$status" = "consumed" ]; then
            echo -e "${RED}✗ Login request already consumed. Please retry.${NC}"
            return 1
        fi

        if [ -n "$error_msg" ]; then
            echo -e "${RED}✗ Login failed: ${error_msg}.${NC}"
        else
            echo -e "${RED}✗ Login failed (HTTP ${http_code}).${NC}"
        fi
        return 1
    done
}

fetch_nanogpt_models() {
    local api_key="$1"
    if [ -n "$api_key" ]; then
        curl -sS "${API_V1_URL}/models?detailed=true" \
            -H "Authorization: Bearer ${api_key}" \
            2>/dev/null || true
    else
        curl -sS "${API_V1_URL}/models?detailed=true" \
            2>/dev/null || true
    fi
}

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║         NanoGPT + OpenCode Setup (NanoCode Edition)         ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if OpenCode is installed
if ! command -v opencode &> /dev/null; then
    echo -e "${YELLOW}⚠ OpenCode is not installed.${NC}"
    echo ""
    echo "To install OpenCode, run one of:"
    echo "  curl -fsSL https://opencode.ai/install | bash"
    echo "  bun install -g opencode-ai@latest"
    echo "  brew install anomalyco/tap/opencode"
    echo ""
    read -p "Do you want to continue with configuration anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Setup cancelled.${NC}"
        exit 1
    fi
else
    OPENCODE_VERSION=$(opencode --version 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓ OpenCode is installed: ${OPENCODE_VERSION}${NC}"
fi

# Determine config and auth directories
XDG_DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
XDG_CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"

AUTH_DIR="$XDG_DATA_HOME/opencode"
AUTH_FILE="$AUTH_DIR/auth.json"

CONFIG_DIR="$XDG_CONFIG_HOME/opencode"

# Detect existing config file (prefer .jsonc over .json), or default to .json for new files
if [ -f "$CONFIG_DIR/opencode.jsonc" ]; then
    CONFIG_FILE="$CONFIG_DIR/opencode.jsonc"
elif [ -f "$CONFIG_DIR/opencode.json" ]; then
    CONFIG_FILE="$CONFIG_DIR/opencode.json"
else
    CONFIG_FILE="$CONFIG_DIR/opencode.json"
fi

# Create directories if they don't exist
if [ ! -d "$AUTH_DIR" ]; then
    mkdir -p "$AUTH_DIR"
    echo -e "${GREEN}✓ Created $AUTH_DIR${NC}"
fi

if [ ! -d "$CONFIG_DIR" ]; then
    mkdir -p "$CONFIG_DIR"
    echo -e "${GREEN}✓ Created $CONFIG_DIR${NC}"
fi

API_KEY=""
if [ -f "$AUTH_FILE" ]; then
    if command -v python3 &> /dev/null; then
        API_KEY=$(python3 -c "
import json
try:
    with open('$AUTH_FILE', 'r') as f:
        auth = json.load(f)
    key = auth.get('nanogpt', {}).get('key', '') if isinstance(auth.get('nanogpt'), dict) else auth.get('nanogpt', '')
    print(key)
except:
    pass
" 2>/dev/null)
    fi
fi

if [ -n "$API_KEY" ]; then
    echo ""
    echo -e "${GREEN}✓ Found existing API key in $AUTH_FILE${NC}"
    echo -e "${BLUE}Skipping authentication prompt${NC}"
else
    echo ""
    echo -e "${BLUE}Choose authentication method${NC}"
    echo "  1) Browser login (recommended)"
    echo "  2) Paste API key"
    echo ""
    read -p "Select [1-2] (default 1): " -r AUTH_CHOICE

if [ -z "${AUTH_CHOICE:-}" ] || [ "$AUTH_CHOICE" = "1" ]; then
    if ! device_login "opencode-nanogpt"; then
        echo ""
        read -p "Device login failed. Paste an API key instead? (y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${RED}Setup cancelled.${NC}"
            exit 1
        fi
        AUTH_CHOICE="2"
    fi
fi

if [ "${AUTH_CHOICE:-}" = "2" ] || [ -z "${API_KEY:-}" ]; then
    echo ""
    echo -e "${BLUE}Enter your NanoGPT API key${NC}"
    echo -e "Get your API key at: ${YELLOW}${BASE_URL}/api${NC}"
    echo ""
    read -sp "API Key: " API_KEY
    echo ""

    if [ -z "$API_KEY" ]; then
        echo -e "${RED}✗ API key cannot be empty${NC}"
        exit 1
    fi
fi
fi

echo ""
echo -e "${CYAN}⟳ Fetching models from NanoGPT API...${NC}"

# Fetch models from API
MODELS_JSON=$(fetch_nanogpt_models "$API_KEY" || true)

if [ -z "$MODELS_JSON" ]; then
    echo -e "${YELLOW}⚠ Could not fetch models from API, will use defaults${NC}"
fi

# Update auth.json with the NanoGPT API key
if command -v python3 &> /dev/null; then
    NANOGPT_API_KEY_INPUT="$API_KEY" AUTH_FILE_PATH="$AUTH_FILE" python3 << 'EOF'
import json
import os

auth_file = os.environ.get("AUTH_FILE_PATH")
api_key = os.environ.get("NANOGPT_API_KEY_INPUT", "")

# Load existing auth or create new
try:
    with open(auth_file, "r") as f:
        auth = json.load(f)
except (json.JSONDecodeError, FileNotFoundError):
    auth = {}

# Add NanoGPT credentials with type and key structure
auth["nanogpt"] = {
    "type": "api",
    "key": api_key
}

with open(auth_file, "w") as f:
    json.dump(auth, f, indent=2)
EOF
    echo -e "${GREEN}✓ Updated auth.json with NanoGPT credentials${NC}"
else
    # Fallback: create simple auth.json
    cat > "$AUTH_FILE" << EOF
{
  "nanogpt": {
    "type": "api",
    "key": "${API_KEY}"
  }
}
EOF
    echo -e "${GREEN}✓ Created auth.json${NC}"
fi

# Secure the auth file
chmod 600 "$AUTH_FILE" 2>/dev/null || true

# Update or create opencode.json config with NanoGPT provider and all fetched models
if command -v python3 &> /dev/null; then
    # Write models JSON to temp file to avoid argument list size limits
    TEMP_MODELS_FILE=$(mktemp)
    printf '%s' "$MODELS_JSON" > "$TEMP_MODELS_FILE"

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" \
    NANOGPT_API_V1="$API_V1_URL" \
    CONFIG_FILE_PATH="$CONFIG_FILE" \
    MODELS_FILE_PATH="$TEMP_MODELS_FILE" \
    NANOGPT_API_KEY_FOR_MCP="$API_KEY" \
    python3 << 'EOF'
import json
import os
import sys
import tempfile

script_dir = os.environ.get("SCRIPT_DIR", ".")
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

# Load existing config (handle JSONC with comments and trailing commas) or create new
try:
    with open(config_file, "r") as f:
        content = f.read()
    import re
    content = re.sub(r'(?<!:)(?<!/)(?<!)//.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    content = re.sub(r',(\s*[}\]])', r'\1', content)
    try:
        config = json.loads(content)
    except json.JSONDecodeError:
        try:
            import json5
            config = json5.loads(content)
        except ImportError:
            config = {}
        except Exception:
            config = {}
except (json.JSONDecodeError, FileNotFoundError):
    config = {}

# Add schema reference for validation
config["$schema"] = "https://opencode.ai/config.json"

# Ensure provider section exists
if "provider" not in config:
    config["provider"] = {}

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
    except Exception as e:
        print(f"Warning: Could not parse models JSON: {e}", file=sys.stderr)

# If no models fetched, use defaults
if not models_dict:
    models_dict = {
        "zai-org/glm-4.7": {
            "id": "zai-org/glm-4.7",
            "name": "GLM 4.7",
            "limit": {
                "context": 200000,
                "output": 65535
            },
            "temperature": True,
            "tool_call": True,
            "modalities": {
                "input": ["text"],
                "output": ["text"]
            }
        },
        "zai-org/glm-4.7:thinking": {
            "id": "zai-org/glm-4.7:thinking",
            "name": "GLM 4.7 (Thinking)",
            "limit": {
                "context": 200000,
                "output": 65535
            },
            "reasoning": True,
            "temperature": True,
            "tool_call": True,
            "interleaved": {
                "field": "reasoning_content"
            },
            "modalities": {
                "input": ["text"],
                "output": ["text"]
            }
        }
    }

# Add NanoGPT provider configuration
config["provider"]["nanogpt"] = {
    "npm": "@ai-sdk/openai-compatible",
    "name": "NanoGPT",
    "options": {
        "baseURL": api_v1
    },
    "models": models_dict
}

# Set default models
if "model" not in config:
    config["model"] = "nanogpt/zai-org/glm-4.7:thinking"
if "small_model" not in config:
    config["small_model"] = "nanogpt/openai/gpt-oss-120b"

# Disable OpenCode Zen provider (with Big Pickle and Grok Code Fast models)
config["disabled_providers"] = ["opencode"]

# Add MCP configuration for built-in nanogpt MCP server
api_key_input = os.environ.get("NANOGPT_API_KEY_FOR_MCP", "")
if "mcp" not in config:
    config["mcp"] = {}

if "nanogpt" not in config["mcp"]:
    config["mcp"]["nanogpt"] = {
        "type": "local",
        "command": ["bunx", "@nanogpt/mcp@latest", "--scope", "user"],
        "environment": {
            "NANOGPT_API_KEY": api_key_input
        },
        "enabled": True
    }

# Always update models and write config with standard JSON format
config["provider"]["nanogpt"]["models"] = models_dict
with open(config_file, "w") as f:
    json.dump(config, f, indent=2)
EOF

    # Clean up temp file
    rm -f "$TEMP_MODELS_FILE"
    echo -e "${GREEN}✓ Updated opencode.json with NanoGPT provider and models${NC}"
else
    # Fallback: create basic config file
    cat > "$CONFIG_FILE" << EOF
{
  "$schema": "https://opencode.ai/config.json",
  "model": "nanogpt/zai-org/glm-4.7:thinking",
  "small_model": "nanogpt/mistralai/ministral-14b-instruct-2512",
  "provider": {
    "nanogpt": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "NanoGPT",
      "options": {
        "baseURL": "${API_V1_URL}"
      },
      "models": {
        "zai-org/glm-4.7": {
          "id": "zai-org/glm-4.7",
          "name": "GLM 4.7",
          "limit": {
            "context": 200000,
            "output": 65535
          },
          "temperature": true,
          "tool_call": true,
          "modalities": {
            "input": ["text"],
            "output": ["text"]
          }
        },
        "zai-org/glm-4.7:thinking": {
          "id": "zai-org/glm-4.7:thinking",
          "name": "GLM 4.7 (Thinking)",
          "limit": {
            "context": 200000,
            "output": 65535
          },
          "reasoning": true,
          "temperature": true,
          "tool_call": true,
          "interleaved": {
            "field": "reasoning_content"
          },
          "modalities": {
            "input": ["text"],
            "output": ["text"]
          }
        }
      }
    }
  },
  "mcp": {
    "nanogpt": {
      "type": "local",
      "command": ["bunx", "@nanogpt/mcp@latest", "--scope", "user"],
      "environment": {
        "NANOGPT_API_KEY": "${API_KEY}"
      },
      "enabled": true
    }
  }
}
EOF
    echo -e "${GREEN}✓ Created opencode.json${NC}"
fi

# Secure the config file
chmod 600 "$CONFIG_FILE" 2>/dev/null || true

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete!                           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Your OpenCode is now configured with NanoGPT!"
echo ""
echo -e "Configuration files:"
echo -e "  Auth:   ${BLUE}$AUTH_FILE${NC}"
echo -e "  Config: ${BLUE}$CONFIG_FILE${NC}"
echo ""
echo -e "Default Models:"
echo -e "  Primary:  ${YELLOW}zai-org/glm-4.7${NC}"
echo -e "  Thinking: ${YELLOW}zai-org/glm-4.7:thinking${NC}"
echo ""
echo -e "Features enabled:"
echo -e "  ${GREEN}✓${NC} All models auto-loaded from NanoGPT API"
echo -e "  ${GREEN}✓${NC} Reasoning models configured with interleaved thinking"
echo -e "  ${GREEN}✓${NC} Interleaved thinking enabled for reasoning models"
echo -e "  ${GREEN}✓${NC} Built-in NanoGPT MCP server configured"
echo ""
echo -e "MCP Tools available:"
echo -e "  ${YELLOW}•${NC} nanogpt_chat - Send messages to any NanoGPT model"
echo -e "  ${YELLOW}•${NC} nanogpt_web_search - Search the web"
echo -e "  ${YELLOW}•${NC} nanogpt_scrape_urls - Extract content from web pages"
echo -e "  ${YELLOW}•${NC} nanogpt_youtube_transcribe - Get YouTube transcripts"
echo -e "  ${YELLOW}•${NC} nanogpt_image_generate - Generate images"
echo -e "  ${YELLOW}•${NC} nanogpt_get_balance - Check account balance"
echo ""
echo -e "To get started:"
echo -e "  ${BLUE}opencode${NC}"
echo ""
echo -e "To switch models:"
echo -e "  Use the ${YELLOW}/model${NC} command in OpenCode"
echo ""
echo -e "To update models from NanoGPT API:"
echo -e "  Run: ${CYAN}./update-nanogpt-models.sh${NC}"
echo ""
echo -e "For automatic updates, add a cron job:"
echo -e "  ${CYAN}crontab -e${NC}"
echo -e "  Add: ${CYAN}0 6 * * * $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/update-nanogpt-models.sh${NC}"
echo ""
echo -e "View all models at: ${BLUE}${MODELS_URL}${NC}"
echo ""
