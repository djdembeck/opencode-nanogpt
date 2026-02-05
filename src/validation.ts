import { z } from 'zod';
import { ConfigManager } from './config-manager.js';

/**
 * Model configuration schema for individual AI models.
 * Defines the structure for model specifications including limits,
 * capabilities, cost, and optional features.
 */
export const ModelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  limit: z.object({
    context: z.number().int().positive(),
    output: z.number().int().positive()
  }),
  temperature: z.boolean().optional(),
  tool_call: z.boolean().optional(),
  reasoning: z.boolean().optional(),
  interleaved: z.object({ field: z.string() }).optional(),
  modalities: z.object({
    input: z.array(z.string()),
    output: z.array(z.string())
  }).optional(),
  cost: z.object({
    input: z.number(),
    output: z.number()
  }).optional(),
  release_date: z.string().optional()
});

/**
 * Nanogpt provider schema.
 * Defines the structure for the nanogpt provider configuration including
 * npm package, name, API options, and available models.
 */
export const NanogptProviderSchema = z.object({
  npm: z.string(),
  name: z.string(),
  options: z.object({
    baseURL: z.string().url()
  }),
  models: z.object({}).catchall(ModelConfigSchema)
});

/**
 * MCP server schema.
 * Defines the structure for MCP (Model Context Protocol) server configuration.
 * Currently supports only local type servers.
 */
export const McpServerSchema = z.object({
  type: z.literal('local'),
  command: z.array(z.string()),
  environment: z.object({}).catchall(z.string()),
  enabled: z.boolean()
});

/**
 * OpenCode config schema.
 * Top-level schema for the entire OpenCode configuration file.
 * Uses passthrough to allow additional properties that aren't strictly defined.
 */
export const OpenCodeConfigSchema = z.object({
  $schema: z.string().optional(),
  model: z.string().optional(),
  small_model: z.string().optional(),
  disabled_providers: z.array(z.string()).optional(),
  provider: z.object({
    nanogpt: NanogptProviderSchema.optional()
  }).passthrough(),
  mcp: z.object({}).catchall(McpServerSchema).optional()
}).passthrough();

/**
 * Inferred TypeScript types from Zod schemas.
 */
export type OpenCodeConfig = z.infer<typeof OpenCodeConfigSchema>;
export type NanogptProvider = z.infer<typeof NanogptProviderSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type McpServerConfig = z.infer<typeof McpServerSchema>;

/**
 * Validates a configuration object against the OpenCodeConfigSchema.
 *
 * @param config - The configuration object to validate
 * @returns The parsed and typed configuration object
 * @throws {z.ZodError} If validation fails with descriptive error messages
 *
 * @example
 * ```typescript
 * const config = { provider: { nanogpt: { ... } } };
 * const validated = validateConfig(config);
 * ```
 */
export function validateConfig(config: any): OpenCodeConfig {
  return OpenCodeConfigSchema.parse(config);
}

/**
 * Validates a configuration file before writing to it.
 * Reads the file and validates its contents against the schema.
 *
 * @param configManager - ConfigManager instance for reading files
 * @param filePath - Path to the configuration file to validate
 * @throws {Error} If file cannot be read or contains invalid JSON/JSONC
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * await validateBeforeWrite(configManager, '/path/to/config.json');
 * ```
 */
export async function validateBeforeWrite(
  configManager: ConfigManager,
  filePath: string
): Promise<void> {
  const config = await configManager.readConfig(filePath);
  validateConfig(config);
  return;
}

/**
 * Validates a configuration file after writing to confirm success.
 * Reads the file and validates its contents against the schema.
 *
 * @param configManager - ConfigManager instance for reading files
 * @param filePath - Path to the configuration file to validate
 * @throws {Error} If file cannot be read or contains invalid JSON/JSONC
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * ```typescript
 * // After modifying config
 * await validateAfterWrite(configManager, '/path/to/config.json');
 * ```
 */
export async function validateAfterWrite(
  configManager: ConfigManager,
  filePath: string
): Promise<void> {
  const config = await configManager.readConfig(filePath);
  validateConfig(config);
  return;
}

/**
 * Safely validates a configuration object without throwing.
 * Returns an object with success status and either the parsed data or error.
 *
 * @param config - The configuration object to validate
 * @returns Object containing success status and either data or error
 *
 * @example
 * ```typescript
 * const result = safeValidateConfig(possiblyInvalidConfig);
 * if (result.success) {
 *   console.log('Valid config:', result.data);
 * } else {
 *   console.error('Validation errors:', result.error);
 * }
 * ```
 */
export function safeValidateConfig(config: any): { success: true; data: OpenCodeConfig } | { success: false; error: z.ZodError } {
  const result = OpenCodeConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}
