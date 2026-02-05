import { ConfigManager } from '../config-manager.js';
import { readFile, writeFile } from 'fs/promises';
import { modify, applyEdits } from 'jsonc-parser';

/**
 * MCP Server Configuration for NanoGPT
 */
export interface McpServerConfig {
  type: 'local';
  command: string[];
  environment: Record<string, string>;
  enabled: boolean;
}

/**
 * NanoGPT Model configuration
 */
export interface NanogptModel {
  id: string;
  name: string;
  limit: { context: number; output: number };
  temperature?: boolean;
  tool_call?: boolean;
  reasoning?: boolean;
  interleaved?: { field: string };
  modalities?: { input: string[]; output: string[] };
  cost?: { input: number; output: number };
  release_date?: string;
}

/**
 * NanoGPT Provider configuration
 */
export interface NanogptProvider {
  npm: string;
  name: string;
  options: { baseURL: string };
  models: Record<string, NanogptModel>;
}

/**
 * Configures the MCP (Model Context Protocol) environment for NanoGPT.
 *
 * IMPORTANT: The actual API key is NOT stored in the config file.
 * Instead, the {env:NANOGPT_MCP_API_KEY} interpolation syntax is used,
 * which will be resolved at runtime from the environment variable.
 *
 * @param configManager - ConfigManager instance for surgical config edits
 * @param filePath - Path to the OpenCode configuration file
 * @param apiKey - The NanoGPT API key (NOT stored directly, used to set up env var reference)
 */
export async function configureMcpEnvironment(
  configManager: ConfigManager,
  filePath: string,
  apiKey: string
): Promise<void> {
  const mcpConfig: McpServerConfig = {
    type: 'local',
    command: ['npx', '@nanogpt/mcp@latest', '--scope', 'user'],
    environment: {
      NANOGPT_API_KEY: '{env:NANOGPT_MCP_API_KEY}'
    },
    enabled: true
  };

  await configManager.modifyConfig(filePath, ['mcp', 'nanogpt'], mcpConfig);
}

/**
 * Updates the NanoGPT provider models section while preserving other properties.
 * Uses ConfigManager.modifyConfig for surgical edits that preserve comments and formatting.
 *
 * @param configManager - ConfigManager instance for surgical config edits
 * @param filePath - Path to the OpenCode configuration file
 * @param models - Record of model IDs to model configurations
 */
export async function updateNanogptProvider(
  configManager: ConfigManager,
  filePath: string,
  models: Record<string, NanogptModel>
): Promise<void> {
  await configManager.modifyConfig(filePath, ['provider', 'nanogpt', 'models'], models);
}

/**
 * Ensures the NanoGPT provider section exists with default structure.
 * Creates the section if missing, preserving existing configuration if present.
 *
 * @param configManager - ConfigManager instance for surgical config edits
 * @param filePath - Path to the OpenCode configuration file
 */
export async function ensureNanogptProvider(
  configManager: ConfigManager,
  filePath: string
): Promise<void> {
  // First ensure the provider.nanogpt section exists
  const defaultProvider: Partial<NanogptProvider> = {
    npm: '@ai-sdk/openai-compatible',
    name: 'NanoGPT',
    options: { baseURL: 'https://nano-gpt.com/api/v1' },
    models: {}
  };

  await configManager.modifyConfig(filePath, ['provider', 'nanogpt'], defaultProvider);
}

/**
 * Removes the entire NanoGPT provider section from the configuration.
 * Uses jsonc-parser for surgical removal that preserves comments and formatting.
 * Silently does nothing if nanogpt provider does not exist.
 *
 * @param configManager - ConfigManager instance (unused but kept for API consistency)
 * @param filePath - Path to the OpenCode configuration file
 */
export async function removeNanogptProvider(
  configManager: ConfigManager,
  filePath: string
): Promise<void> {
  const content = await readFile(filePath, 'utf-8');

  // Parse to check if nanogpt exists
  const { parse } = await import('jsonc-parser');
  const config = parse(content);

  // Only remove if nanogpt exists in provider
  if (!config?.provider?.nanogpt) {
    return;
  }

  // Use jsonc-parser modify to set the nanogpt value to undefined (removes it)
  const edits = modify(content, ['provider', 'nanogpt'], undefined, {
    formattingOptions: { tabSize: 2, insertSpaces: true, eol: '\n' },
  });

  const newContent = applyEdits(content, edits);
  await writeFile(filePath, newContent, 'utf-8');
}
