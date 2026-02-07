# AGENTS.md - AI Assistant Guide for opencode-nanogpt

This document provides guidance for AI agents working on the opencode-nanogpt project. It supplements the existing README.md with development-specific patterns, workflows, and best practices.

## Project Overview

**opencode-nanogpt** is a Bun-powered CLI plugin for configuring [OpenCode](https://opencode.ai) with [NanoGPT](https://nano-gpt.com) integration. The project provides automated model updates, reasoning model support, and built-in MCP server configuration.

### Core Purpose

- Surgical editing of OpenCode configuration files (JSONC format)
- Automatic model discovery from NanoGPT API
- MCP server setup and management
- Backup/rollback support for configuration changes

### Technology Stack

- **Language**: TypeScript 5.9
- **Runtime**: Bun 1.3+
- **Package Manager**: npm (published to npmjs.com)
- **Key Dependencies**:
  - `jsonc-parser` - JSON with Comments parsing
  - `commander` - CLI argument parsing
  - `axios` - HTTP client for API calls
  - `zod` - Schema validation

## Architecture

### Directory Structure

```
opencode-nanogpt/
├── src/
│   ├── api/              # NanoGPT API integration
│   │   ├── nanogpt.ts   # API client, model fetching, error handling
│   │   └── nanogpt.test.ts
│   ├── cli/              # CLI command implementations
│   │   ├── index.ts      # CLI entry point (commander setup)
│   │   ├── init.ts       # Initialize nanogpt provider
│   │   ├── update-models.ts  # Update models from API
│   │   ├── validate.ts   # Config validation
│   │   └── rollback.ts   # Restore from backup
│   ├── providers/        # Provider configuration
│   │   └── nanogpt.ts    # NanogptModel types, provider helpers
│   ├── config-manager.ts # Core config editing (jsonc-parser)
│   ├── backup.ts        # Backup/restore with .bak files
│   ├── validation.ts    # Zod schema validation
│   └── *.test.ts        # Unit tests
├── dist/                # Compiled JavaScript (generated)
├── docs/
│   ├── API.md           # API reference documentation
│   └── INTEGRATION.md   # Integration guide
├── scripts/
│   ├── setup-nanogpt-opencode.sh  # Shell setup script
│   └── update-nanogpt-models.sh   # Cron-friendly update script
├── package.json
├── tsconfig.json
└── .github/workflows/
    └── publish.yml      # NPM release workflow
```

### Key Patterns

#### ConfigManager Pattern

The `ConfigManager` class is the core abstraction for config file manipulation:

```typescript
// Located in src/config-manager.ts
export class ConfigManager {
  async readConfig(filePath: string): Promise<any>;
  async writeConfig(filePath: string, content: string): Promise<void>;
  async modifyConfig(
    filePath: string,
    path: string[],
    value: any,
  ): Promise<void>;
}
```

- **Uses `jsonc-parser`**: Preserves comments and formatting
- **Atomic writes**: Write to `.tmp` file, then rename
- **Error handling**: Throws on parse errors or write failures

#### API Integration Pattern

API calls follow a consistent pattern (see `src/api/nanogpt.ts`):

1. HTTP client with timeout (30s default)
2. Bearer token authentication
3. Structured error handling with `NanogptApiError`
4. Response transformation to internal `NanogptModel` types

#### Backup Pattern

BackupManager creates `.bak` files before modifications:

```typescript
// Located in src/backup.ts
export class BackupManager {
  async createBackup(filePath: string): Promise<string>;
  async restoreFromBackup(filePath: string): Promise<void>;
  async listBackups(filePath: string): Promise<string[]>;
}
```

- Preserves file permissions (600)
- Timestamped backup filenames
- Supports rollback to any previous backup

## Development Workflow

### Building the Project

```bash
# Install dependencies
npm install

# Build TypeScript to dist/
npm run build

# Watch mode (during development)
npm run build -- --watch
```

**Important**: The CLI entry point (`nanogpt-config`) points to `dist/cli/index.js` after build.

### Running Tests

```bash
# No test script configured - run directly with bun or ts-node
bun test
# or
npx ts-node src/*.test.ts
```

Test files use Bun's test runner pattern and exist alongside source files with `.test.ts` suffix.

### CLI Commands

The CLI is built with Commander.js. Available commands:

| Command         | Description                 | Options                            |
| --------------- | --------------------------- | ---------------------------------- |
| `init`          | Initialize nanogpt provider | `--api-key`, `--force`, `--config` |
| `update-models` | Fetch models from API       | `--force`, `--api-key`             |
| `validate`      | Validate config file        | `--config`                         |
| `rollback`      | Restore from backup         | `--config`                         |
| `format`        | Format config file          | `--check`                          |

### Publishing to npm

Triggered via GitHub workflow (`.github/workflows/publish.yml`):

1. On tag push (e.g., `v1.0.0`)
2. Runs on Ubuntu latest
3. Installs dependencies
4. Builds TypeScript
5. Publishes to npm

## Common Tasks

### Adding a New CLI Command

1. Create file in `src/cli/<command-name>.ts`
2. Export a Commander Command object
3. Register in `src/cli/index.ts`:

```typescript
import { initCommand } from "./init.js";
import { updateModelsCommand } from "./update-models.js";
// Add your command here
program.addCommand(updateModelsCommand);
```

### Modifying Config Structure

1. Update `NanogptModel` type in `src/providers/nanogpt.ts`
2. Update Zod schema in `src/validation.ts`
3. Update API transformation in `src/api/nanogpt.ts`
4. Add/update tests in corresponding `.test.ts` files
5. Update `docs/API.md` if public API changed

### Handling API Errors

Use the established error codes from `src/api/nanogpt.ts`:

| Code            | HTTP Status | Meaning                  |
| --------------- | ----------- | ------------------------ |
| `AUTH_ERROR`    | 401         | Invalid API key          |
| `RATE_LIMIT`    | 429         | Too many requests        |
| `SERVER_ERROR`  | 5xx         | NanoGPT server issue     |
| `TIMEOUT`       | -           | Request exceeded timeout |
| `NETWORK_ERROR` | -           | Connection failure       |

### Updating MCP Configuration

MCP server settings are configured via `src/cli/init.ts`:

1. API key persisted to `~/.local/share/opencode/auth.json`
2. Config written to `~/.config/opencode/opencode.json`
3. File permissions set to 600

## Configuration Files

### Project Config (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true
  }
}
```

### Package (package.json)

Key fields:

- `main`: `dist/index.js` (entry point)
- `exports`: Named exports for programmatic use
- `bin`: CLI entry point (`nanogpt-config` -> `dist/cli/index.js`)
- `type`: `module` (ES modules)

### User Configuration Paths

| Path                                | Purpose         | Permissions |
| ----------------------------------- | --------------- | ----------- |
| `~/.local/share/opencode/auth.json` | API key storage | 600         |
| `~/.config/opencode/opencode.json`  | Provider config | 600         |

## Testing Guidelines

### Test File Structure

Tests follow the source file pattern:

- `src/module.test.ts` tests `src/module.ts`
- Uses Bun's native test runner
- Parallel test execution supported

### Mock Patterns

When testing API calls, mock at the axios level:

```typescript
// Example pattern
import { stub } from 'bun:test';
stub(axios, 'get').mockResolvedValue({ data: { models: [...] } });
```

### Validation Testing

Test Zod schema validation with both valid and invalid inputs:

```typescript
// Located in src/validation.test.ts
describe('validation', () => {
  it('validates correct config', () => { ... });
  it('rejects invalid model config', () => { ... });
});
```

## Best Practices

### Code Style

- TypeScript strict mode enabled
- Use async/await consistently
- Explicit return types for exported functions
- JSDoc comments for public APIs

### Error Handling

- Always use typed errors (`NanogptApiError`, etc.)
- Clean up resources in finally blocks
- User-facing errors should be descriptive
- Log errors with context for debugging

### Security

- API keys stored in secure locations only
- Files set to 600 permissions
- No secrets in logs or error messages
- Validate all inputs with Zod schemas

### Performance

- API calls have 30s timeouts
- Config writes use atomic operations
- Large model lists handled efficiently

## Troubleshooting

### Build Fails

```bash
# Check TypeScript errors
npm run build 2>&1

# Verify dependencies installed
npm install
```

### CLI Not Found

```bash
# Ensure dist/cli/index.js exists
ls dist/cli/index.js

# Rebuild if needed
npm run build

# Check package.json bin mapping
cat package.json | grep '"nanogpt-config"'
```

### Tests Fail

```bash
# Run with verbose output
bun test --verbose

# Check for type errors
npx tsc --noEmit
```

### Publishing Fails

```bash
# Verify npm login
npm whoami

# Check tag format (must be vX.Y.Z)
git tag -l

# Verify workflow permissions
cat .github/workflows/publish.yml
```

## References

- [README.md](README.md) - Project overview and features
- [QUICKSTART.md](QUICKSTART.md) - Setup guide
- [docs/API.md](docs/API.md) - TypeScript API reference
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Common issues
- NanoGPT API: `https://nano-gpt.com/api/v1/models`
