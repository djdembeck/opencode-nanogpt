#!/usr/bin/env python3
"""
JSONC Update Models - Surgical editing for OpenCode configuration files.

This module provides functions to locate and update the models section
within a provider.nanogpt structure in JSONC (JSON with Comments) files.
"""

import re
from typing import Optional, Tuple


def skip_comment_or_string(content: str, i: int) -> int:
    """
    Skip over comments and strings to avoid false matches.

    Args:
        content: The content string to process
        i: Current index position

    Returns:
        New index position after skipping comment/string
    """
    if i >= len(content):
        return i

    if content[i:i + 2] == '//':
        end = content.find('\n', i)
        return len(content) if end == -1 else end + 1

    if content[i:i + 2] == '/*':
        end = content.find('*/', i + 2)
        return len(content) if end == -1 else end + 2

    if content[i] == '"':
        i += 1
        while i < len(content):
            if content[i] == '\\' and i + 1 < len(content):
                i += 2
            elif content[i] == '"':
                return i + 1
            else:
                i += 1
        return i

    if content[i] == "'":
        i += 1
        while i < len(content):
            if content[i] == '\\' and i + 1 < len(content):
                i += 2
            elif content[i] == "'":
                return i + 1
            else:
                i += 1
        return i

    return i


def find_key_position(content: str, key: str, start: int = 0) -> int:
    """
    Find the position of a JSON key (e.g., "provider") in content.
    Skips comments and strings to avoid false matches.

    Args:
        content: The content string to search
        key: The key to find (without quotes)
        start: Starting position for search

    Returns:
        Index position of the key, or -1 if not found
    """
    key_pattern = f'"{key}"'
    i = start

    while i < len(content):
        new_i = skip_comment_or_string(content, i)
        if new_i != i:
            i = new_i
            continue

        if content[i:i + len(key_pattern)] == key_pattern:
            return i

        i += 1

    return -1


def find_object_start(content: str, key_pos: int) -> int:
    """
    Find the opening brace of an object after a key position.

    Args:
        content: The content string
        key_pos: Position of the key

    Returns:
        Position of the opening brace '{', or -1 if not found
    """
    i = key_pos

    while i < len(content):
        new_i = skip_comment_or_string(content, i)
        if new_i != i:
            i = new_i
            continue

        if content[i] == '{':
            return i
        if content[i] == '[':
            return -1

        i += 1

    return -1


def find_object_end(content: str, start: int) -> int:
    """
    Find the matching closing brace for an opening brace.
    Handles nested objects.

    Args:
        content: The content string
        start: Position of the opening brace

    Returns:
        Position of the matching closing brace '}'
    """
    brace_count = 1
    i = start + 1

    while i < len(content) and brace_count > 0:
        new_i = skip_comment_or_string(content, i)
        if new_i != i:
            i = new_i
            continue

        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                return i

        i += 1

    return i


def find_models_section(content: str) -> Optional[Tuple[int, int]]:
    """
    Find the models section within provider.nanogpt in JSONC content.

    This function locates the "provider" object first, then searches for
    a "nanogpt" key inside that provider object, and finally locates the
    "models" key inside the nanogpt object.

    Args:
        content: The JSONC content to search

    Returns:
        Tuple of (models_start, models_end) positions, or None if not found
    """
    provider_pos = find_key_position(content, "provider")
    if provider_pos == -1:
        return None

    provider_object_start = find_object_start(content, provider_pos)
    if provider_object_start == -1:
        return None

    nanogpt_pos = find_key_position(content, "nanogpt", provider_object_start + 1)
    if nanogpt_pos == -1:
        return None

    provider_object_end = find_object_end(content, provider_object_start)
    if nanogpt_pos >= provider_object_end:
        return None

    nanogpt_object_start = find_object_start(content, nanogpt_pos)
    if nanogpt_object_start == -1:
        return None

    models_pos = find_key_position(content, "models", nanogpt_object_start + 1)
    if models_pos == -1:
        return None

    nanogpt_object_end = find_object_end(content, nanogpt_object_start)
    if models_pos >= nanogpt_object_end:
        return None

    models_object_start = find_object_start(content, models_pos)
    if models_object_start == -1:
        return None

    models_object_end = find_object_end(content, models_object_start)

    return (models_object_start, models_object_end)


def update_models_section(content: str, new_models: str) -> str:
    """
    Replace the models section with new content.

    Args:
        content: Original JSONC content
        new_models: New models JSON content (should be a valid JSON object)

    Returns:
        Updated content with new models section
    """
    result = find_models_section(content)
    if result is None:
        raise ValueError("Could not find models section in provider.nanogpt")

    models_start, models_end = result
    return content[:models_start + 1] + new_models + content[models_end:]


if __name__ == "__main__":
    example_config = '''
{
  "model": "zai-org/glm-4.7",
  "disabled_providers": ["opencode"],
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
          "limit": {
            "context": 200000,
            "output": 65535
          }
        }
      }
    }
  },
  "mcp": {
    "nanogpt": {
      "type": "local",
      "command": ["bunx", "@nanogpt/mcp@latest", "--scope", "user"],
      "enabled": true
    }
  }
}
'''

    result = find_models_section(example_config)
    if result:
        start, end = result
        print(f"Found models section at positions {start} to {end}")
        print(f"Content: {example_config[start:end + 1]}")
    else:
        print("Models section not found")
