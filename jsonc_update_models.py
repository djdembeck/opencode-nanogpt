#!/usr/bin/env python3
"""
Update models in a JSONC file while preserving comments.
"""

import json
import sys

def find_string_end(content, start_pos):
    """Find the end of a JSON string starting at start_pos (which should be at a quote)."""
    i = start_pos + 1
    while i < len(content):
        if content[i] == '\\':
            i += 2
        elif content[i] == '"':
            return i
        else:
            i += 1
    return -1

def find_models_section(content):
    """
    Find the models section within nanogpt provider.
    Returns (start_pos, end_pos) where start_pos is at the opening brace of models value,
    and end_pos is after the closing brace.
    """
    # Find "nanogpt"
    nanogpt_pos = content.find('"nanogpt"')
    if nanogpt_pos == -1:
        return None
    
    # Find the opening brace after "nanogpt":
    i = nanogpt_pos + len('"nanogpt"')
    while i < len(content) and content[i] not in '{':
        i += 1
    if i >= len(content):
        return None
    
    # Now we're at the opening brace of nanogpt object
    # We need to find "models" within this object
    nanogpt_brace_pos = i
    
    # Search for "models" within nanogpt's braces
    brace_count = 1
    i += 1
    while i < len(content) and brace_count > 0:
        char = content[i]
        
        if char == '"':
            # Skip string
            string_end = find_string_end(content, i)
            if string_end == -1:
                return None
            # Check if this string is "models"
            if content[i:string_end+1] == '"models"':
                # Found "models", now find the colon and opening brace
                j = string_end + 1
                while j < len(content) and content[j] in ' \t\n':
                    j += 1
                if j < len(content) and content[j] == ':':
                    j += 1
                    while j < len(content) and content[j] in ' \t\n':
                        j += 1
                    if j < len(content) and content[j] == '{':
                        # Found it! Now find the end of this object
                        models_start = j
                        models_brace_count = 1
                        j += 1
                        while j < len(content) and models_brace_count > 0:
                            if content[j] == '"':
                                string_end = find_string_end(content, j)
                                if string_end == -1:
                                    return None
                                j = string_end + 1
                            elif content[j] == '{':
                                models_brace_count += 1
                                j += 1
                            elif content[j] == '}':
                                models_brace_count -= 1
                                if models_brace_count == 0:
                                    models_end = j + 1
                                    return (models_start, models_end)
                                j += 1
                            else:
                                j += 1
            i = string_end + 1
        elif char == '{':
            brace_count += 1
            i += 1
        elif char == '}':
            brace_count -= 1
            i += 1
        else:
            i += 1
    
    return None

def update_models_jsonc(config_file, models_dict):
    """Update models section in JSONC file while preserving comments."""
    
    with open(config_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    result = find_models_section(content)
    if not result:
        print("Could not find models section")
        return False
    
    models_start, models_end = result
    
    # Build replacement JSON
    models_json = json.dumps(models_dict, indent=2)
    # Indent to match the file (6 spaces for inside nanogpt)
    models_json_indented = "\n".join("      " + line for line in models_json.split("\n"))
    
    # The models_start position is at the opening brace
    # We want to keep everything up to and including "models": 
    # and replace just the { ... } part
    
    # Find where "models": starts
    models_key_pos = content.rfind('"models"', 0, models_start)
    if models_key_pos == -1:
        print("Could not find models key")
        return False
    
    # Find the colon after "models"
    colon_pos = models_key_pos + len('"models"')
    while colon_pos < models_start and content[colon_pos] in ' \t\n':
        colon_pos += 1
    if colon_pos >= models_start or content[colon_pos] != ':':
        print("Could not find colon after models")
        return False
    
    prefix = content[:colon_pos + 1].rstrip() + " "
    suffix = content[models_end:]
    new_content = prefix + models_json_indented.lstrip() + suffix
    
    if new_content != content:
        with open(config_file, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {config_file}")
    else:
        print("No changes needed")
    
    return True

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <config_file> <models_json>")
        sys.exit(1)
    
    config_file = sys.argv[1]
    models_json_str = sys.argv[2]
    
    models_dict = json.loads(models_json_str)
    success = update_models_jsonc(config_file, models_dict)
    sys.exit(0 if success else 1)
