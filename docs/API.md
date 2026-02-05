# API Reference

## ConfigManager

### Methods

#### `readConfig(filePath: string): Promise<any>`
Reads and parses a JSON/JSONC configuration file.

#### `writeConfig(filePath: string, content: string): Promise<void>`
Writes content to a file atomically using write-then-rename pattern.

#### `modifyConfig(filePath: string, path: string[], value: any): Promise<void>`
Surgically modifies a value at the specified path in a config file.

## BackupManager

### Methods

#### `createBackup(filePath: string): Promise<string>`
Creates a .bak file preserving permissions.

#### `restoreFromBackup(filePath: string): Promise<void>`
Restores file from .bak backup.

#### `listBackups(filePath: string): Promise<string[]>`
Lists all backup files for a given file.

## Provider Functions

### `updateNanogptProvider(configManager, filePath, models)`
Updates only the provider.nanogpt.models section.

### `ensureNanogptProvider(configManager, filePath)`
Creates nanogpt provider section if missing.

### `configureMcpEnvironment(configManager, filePath, apiKey)`
Configures MCP environment with {env:...} interpolation.

## Validation

### `validateConfig(config: any): OpenCodeConfig`
Validates config against Zod schema.

### `validateBeforeWrite(configManager, filePath)`
Validates file before modification.

### `validateAfterWrite(configManager, filePath)`
Validates file after modification.
