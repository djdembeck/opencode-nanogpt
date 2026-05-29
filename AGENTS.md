# AGENTS.md - AI Assistant Guide for opencode-nanogpt

This document provides guidance for AI agents working on the opencode-nanogpt project. It supplements the existing README.md with development-specific patterns, workflows, and best practices.

## Architecture

See README.md for project structure.

### Key Patterns

Core classes: `ConfigManager` handles JSONC config manipulation; `BackupManager` handles .bak file creation and restores.

Development workflow follows standard Bun/TypeScript patterns - `npm install && npm run build` to build, `bun test` to test. CLI commands are documented in README.

### Publishing to npm

Triggered via GitHub workflow (`.github/workflows/publish.yml`):

1. On tag push (e.g., `v1.0.0`)
2. Runs on Ubuntu latest
3. Installs dependencies
4. Builds TypeScript
5. Publishes to npm

Common tasks: CLI commands use Commander.js - add new commands in `src/cli/` and register in `src/cli/index.ts`.

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