import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rmdir, unlink, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { z } from "zod";
import {
  ModelConfigSchema,
  NanogptProviderSchema,
  McpServerSchema,
  OpenCodeConfigSchema,
  validateConfig,
  validateBeforeWrite,
  validateAfterWrite,
  safeValidateConfig,
  OpenCodeConfig,
  ModelConfig,
  NanogptProvider,
  McpServerConfig,
} from "./validation";
import { ConfigManager } from "./config-manager";

describe("Validation", () => {
  const configManager = new ConfigManager();
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `validation-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rmdir(testDir, { recursive: true });
    } catch {
    }
  });

  describe("ModelConfigSchema", () => {
    test("should validate valid model config", () => {
      const validModel = {
        id: "zai-org/glm-4.7",
        name: "GLM 4.7",
        limit: {
          context: 200000,
          output: 65000,
        },
      };

      const result = ModelConfigSchema.parse(validModel);
      expect(result.id).toBe("zai-org/glm-4.7");
      expect(result.name).toBe("GLM 4.7");
      expect(result.limit.context).toBe(200000);
    });

    test("should validate model with all optional fields", () => {
      const fullModel = {
        id: "zai-org/glm-4.7:thinking",
        name: "GLM 4.7 Thinking",
        limit: {
          context: 200000,
          output: 65000,
        },
        temperature: true,
        tool_call: true,
        reasoning: true,
        interleaved: { field: "reasoning_content" },
        modalities: {
          input: ["text", "image"],
          output: ["text"],
        },
        cost: {
          input: 0.001,
          output: 0.002,
        },
        release_date: "2024-01-15",
      };

      const result = ModelConfigSchema.parse(fullModel);
      expect(result.reasoning).toBe(true);
      expect(result.interleaved?.field).toBe("reasoning_content");
      expect(result.cost?.input).toBe(0.001);
    });

    test("should throw for missing required id", () => {
      const invalidModel = {
        name: "Test Model",
        limit: {
          context: 1000,
          output: 1000,
        },
      };

      expect(() => ModelConfigSchema.parse(invalidModel)).toThrow(z.ZodError);
    });

    test("should throw for missing required name", () => {
      const invalidModel = {
        id: "test-model",
        limit: {
          context: 1000,
          output: 1000,
        },
      };

      expect(() => ModelConfigSchema.parse(invalidModel)).toThrow(z.ZodError);
    });

    test("should throw for invalid limit.context (negative)", () => {
      const invalidModel = {
        id: "test-model",
        name: "Test Model",
        limit: {
          context: -100,
          output: 1000,
        },
      };

      expect(() => ModelConfigSchema.parse(invalidModel)).toThrow(z.ZodError);
    });

    test("should throw for invalid limit.context (zero)", () => {
      const invalidModel = {
        id: "test-model",
        name: "Test Model",
        limit: {
          context: 0,
          output: 1000,
        },
      };

      expect(() => ModelConfigSchema.parse(invalidModel)).toThrow(z.ZodError);
    });

    test("should throw for non-integer context limit", () => {
      const invalidModel = {
        id: "test-model",
        name: "Test Model",
        limit: {
          context: 1000.5,
          output: 1000,
        },
      };

      expect(() => ModelConfigSchema.parse(invalidModel)).toThrow(z.ZodError);
    });
  });

  describe("NanogptProviderSchema", () => {
    test("should validate valid nanogpt provider config", () => {
      const validProvider = {
        npm: "@ai-sdk/openai-compatible",
        name: "NanoGPT",
        options: {
          baseURL: "https://nano-gpt.com/api/v1",
        },
        models: {
          "zai-org/glm-4.7": {
            id: "zai-org/glm-4.7",
            name: "GLM 4.7",
            limit: {
              context: 200000,
              output: 65000,
            },
          },
        },
      };

      const result = NanogptProviderSchema.parse(validProvider);
      expect(result.npm).toBe("@ai-sdk/openai-compatible");
      expect(result.options.baseURL).toBe("https://nano-gpt.com/api/v1");
      expect(result.models["zai-org/glm-4.7"].name).toBe("GLM 4.7");
    });

    test("should validate provider with multiple models", () => {
      const providerWithMultipleModels = {
        npm: "@ai-sdk/openai-compatible",
        name: "NanoGPT",
        options: {
          baseURL: "https://nano-gpt.com/api/v1",
        },
        models: {
          "model-1": {
            id: "model-1",
            name: "Model 1",
            limit: { context: 1000, output: 1000 },
          },
          "model-2": {
            id: "model-2",
            name: "Model 2",
            limit: { context: 2000, output: 2000 },
          },
        },
      };

      const result = NanogptProviderSchema.parse(providerWithMultipleModels);
      expect(Object.keys(result.models)).toHaveLength(2);
    });

    test("should throw for invalid baseURL", () => {
      const invalidProvider = {
        npm: "@ai-sdk/openai-compatible",
        name: "NanoGPT",
        options: {
          baseURL: "not-a-url",
        },
        models: {},
      };

      expect(() => NanogptProviderSchema.parse(invalidProvider)).toThrow(z.ZodError);
    });

    test("should throw for missing npm field", () => {
      const invalidProvider = {
        name: "NanoGPT",
        options: {
          baseURL: "https://nano-gpt.com/api/v1",
        },
        models: {},
      };

      expect(() => NanogptProviderSchema.parse(invalidProvider)).toThrow(z.ZodError);
    });
  });

  describe("McpServerSchema", () => {
    test("should validate valid MCP server config", () => {
      const validMcp = {
        type: "local" as const,
        command: ["npx", "@nanogpt/mcp@latest", "--scope", "user"],
        environment: {
          NANOGPT_API_KEY: "{env:NANOGPT_MCP_API_KEY}",
        },
        enabled: true,
      };

      const result = McpServerSchema.parse(validMcp);
      expect(result.type).toBe("local");
      expect(result.command).toEqual(["npx", "@nanogpt/mcp@latest", "--scope", "user"]);
      expect(result.environment.NANOGPT_API_KEY).toBe("{env:NANOGPT_MCP_API_KEY}");
    });

    test("should throw for non-local type", () => {
      const invalidMcp = {
        type: "remote",
        command: ["npx", "test"],
        environment: {},
        enabled: true,
      };

      expect(() => McpServerSchema.parse(invalidMcp)).toThrow(z.ZodError);
    });

    test("should throw for non-array command", () => {
      const invalidMcp = {
        type: "local",
        command: "npx @nanogpt/mcp",
        environment: {},
        enabled: true,
      };

      expect(() => McpServerSchema.parse(invalidMcp)).toThrow(z.ZodError);
    });

    test("should throw for non-object environment", () => {
      const invalidMcp = {
        type: "local",
        command: ["npx", "test"],
        environment: "NANOGPT_API_KEY=value",
        enabled: true,
      };

      expect(() => McpServerSchema.parse(invalidMcp)).toThrow(z.ZodError);
    });
  });

  describe("OpenCodeConfigSchema", () => {
    test("should validate minimal valid config", () => {
      const minimalConfig = {
        provider: {},
      };

      const result = OpenCodeConfigSchema.parse(minimalConfig);
      expect(result.provider).toEqual({});
    });

    test("should validate full config with all fields", () => {
      const fullConfig = {
        $schema: "https://opencode.ai/config.json",
        model: "nanogpt/zai-org/glm-4.7",
        small_model: "nanogpt/zai-org/glm-4.7",
        disabled_providers: ["opencode"],
        provider: {
          nanogpt: {
            npm: "@ai-sdk/openai-compatible",
            name: "NanoGPT",
            options: {
              baseURL: "https://nano-gpt.com/api/v1",
            },
            models: {
              "zai-org/glm-4.7": {
                id: "zai-org/glm-4.7",
                name: "GLM 4.7",
                limit: {
                  context: 200000,
                  output: 65000,
                },
              },
            },
          },
        },
        mcp: {
          nanogpt: {
            type: "local",
            command: ["npx", "@nanogpt/mcp@latest", "--scope", "user"],
            environment: {
              NANOGPT_API_KEY: "{env:NANOGPT_MCP_API_KEY}",
            },
            enabled: true,
          },
        },
      };

      const result = OpenCodeConfigSchema.parse(fullConfig);
      expect(result.$schema).toBe("https://opencode.ai/config.json");
      expect(result.model).toBe("nanogpt/zai-org/glm-4.7");
      expect(result.provider.nanogpt?.name).toBe("NanoGPT");
      expect(result.mcp?.nanogpt.enabled).toBe(true);
    });

    test("should allow extra top-level properties (passthrough)", () => {
      const configWithExtra = {
        customField: "custom value",
        anotherField: 123,
        provider: {},
      };

      const result = OpenCodeConfigSchema.parse(configWithExtra);
      expect(result.customField).toBe("custom value");
      expect(result.anotherField).toBe(123);
    });

    test("should allow extra provider properties (passthrough)", () => {
      const configWithExtraProvider = {
        provider: {
          nanogpt: {
            npm: "@ai-sdk/openai-compatible",
            name: "NanoGPT",
            options: {
              baseURL: "https://nano-gpt.com/api/v1",
            },
            models: {},
          },
          otherProvider: {
            someField: "value",
          },
        },
      };

      const result = OpenCodeConfigSchema.parse(configWithExtraProvider);
      expect(result.provider.otherProvider).toEqual({ someField: "value" });
    });

    test("should validate config with other providers", () => {
      const configWithOtherProviders = {
        provider: {
          openai: {
            apiKey: "test-key",
          },
          nanogpt: {
            npm: "@ai-sdk/openai-compatible",
            name: "NanoGPT",
            options: {
              baseURL: "https://nano-gpt.com/api/v1",
            },
            models: {},
          },
        },
      };

      const result = OpenCodeConfigSchema.parse(configWithOtherProviders);
      expect(result.provider.openai).toEqual({ apiKey: "test-key" });
      expect(result.provider.nanogpt).toBeDefined();
    });

    test("should throw for invalid disabled_providers type", () => {
      const invalidConfig = {
        disabled_providers: "opencode",
        provider: {},
      };

      expect(() => OpenCodeConfigSchema.parse(invalidConfig)).toThrow(z.ZodError);
    });
  });

  describe("validateConfig function", () => {
    test("should return parsed config for valid input", () => {
      const validConfig = {
        provider: {
          nanogpt: {
            npm: "@ai-sdk/openai-compatible",
            name: "NanoGPT",
            options: {
              baseURL: "https://nano-gpt.com/api/v1",
            },
            models: {},
          },
        },
      };

      const result = validateConfig(validConfig);
      expect(result.provider.nanogpt?.name).toBe("NanoGPT");
    });

    test("should throw ZodError for invalid config", () => {
      const invalidConfig = {
        provider: "not an object",
      };

      expect(() => validateConfig(invalidConfig)).toThrow(z.ZodError);
    });

    test("should include descriptive error message", () => {
      const invalidConfig = {
        provider: {
          nanogpt: {
            npm: "@ai-sdk/openai-compatible",
            name: "NanoGPT",
            options: {
              baseURL: "not-a-url",
            },
            models: {},
          },
        },
      };

      try {
        validateConfig(invalidConfig);
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(z.ZodError);
        if (error instanceof z.ZodError) {
          expect(error.issues[0].message.toLowerCase()).toContain("invalid url");
        }
      }
    });
  });

  describe("safeValidateConfig function", () => {
    test("should return success true and data for valid config", () => {
      const validConfig = {
        provider: {},
      };

      const result = safeValidateConfig(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.provider).toEqual({});
      }
    });

    test("should return success false and error for invalid config", () => {
      const invalidConfig = {
        provider: "invalid",
      };

      const result = safeValidateConfig(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(z.ZodError);
      }
    });

    test("should not throw for invalid config", () => {
      const invalidConfig = {
        provider: {
          nanogpt: {
            options: {
              baseURL: "invalid-url",
            },
          },
        },
      };

      expect(() => safeValidateConfig(invalidConfig)).not.toThrow();
    });
  });

  describe("validateBeforeWrite function", () => {
    test("should validate existing valid config file", async () => {
      const filePath = join(testDir, "valid-config.json");
      const validConfig = {
        $schema: "https://opencode.ai/config.json",
        provider: {
          nanogpt: {
            npm: "@ai-sdk/openai-compatible",
            name: "NanoGPT",
            options: {
              baseURL: "https://nano-gpt.com/api/v1",
            },
            models: {
              "test-model": {
                id: "test-model",
                name: "Test Model",
                limit: {
                  context: 1000,
                  output: 1000,
                },
              },
            },
          },
        },
      };

      await writeFile(filePath, JSON.stringify(validConfig, null, 2), "utf-8");

      await validateBeforeWrite(configManager, filePath);
    });

    test("should throw for config file with invalid content", async () => {
      const filePath = join(testDir, "invalid-config.json");
      const invalidConfig = {
        provider: {
          nanogpt: {
            options: {
              baseURL: "not-a-url",
            },
          },
        },
      };

      await writeFile(filePath, JSON.stringify(invalidConfig, null, 2), "utf-8");

      await expect(validateBeforeWrite(configManager, filePath)).rejects.toThrow();
    });

    test("should throw for malformed JSON file", async () => {
      const filePath = join(testDir, "malformed.json");
      await writeFile(filePath, "{ invalid json", "utf-8");

      await expect(validateBeforeWrite(configManager, filePath)).rejects.toThrow(/JSONC parse error/);
    });

    test("should throw for non-existent file", async () => {
      const filePath = join(testDir, "nonexistent.json");

      await expect(validateBeforeWrite(configManager, filePath)).rejects.toThrow();
    });

    test("should validate JSONC file with comments", async () => {
      const filePath = join(testDir, "config.jsonc");
      const content = `{
        // Configuration file
        "$schema": "https://opencode.ai/config.json",
        "provider": {
          "nanogpt": {
            "npm": "@ai-sdk/openai-compatible",
            "name": "NanoGPT",
            "options": {
              "baseURL": "https://nano-gpt.com/api/v1"
            },
            "models": {}
          }
        }
      }`;

      await writeFile(filePath, content, "utf-8");

      await validateBeforeWrite(configManager, filePath);
    });
  });

  describe("validateAfterWrite function", () => {
    test("should validate config after successful write", async () => {
      const filePath = join(testDir, "post-write-config.json");
      const validConfig = {
        provider: {
          nanogpt: {
            npm: "@ai-sdk/openai-compatible",
            name: "NanoGPT",
            options: {
              baseURL: "https://nano-gpt.com/api/v1",
            },
            models: {},
          },
        },
      };

      await writeFile(filePath, JSON.stringify(validConfig, null, 2), "utf-8");

      await validateAfterWrite(configManager, filePath);
    });

    test("should detect validation errors after corrupted write", async () => {
      const filePath = join(testDir, "corrupted-config.json");
      const invalidConfig = {
        provider: {
          nanogpt: {
            name: "NanoGPT",
          },
        },
      };

      await writeFile(filePath, JSON.stringify(invalidConfig, null, 2), "utf-8");

      await expect(validateAfterWrite(configManager, filePath)).rejects.toThrow(z.ZodError);
    });
  });

  describe("Type exports", () => {
    test("OpenCodeConfig type should be defined", () => {
      const config: OpenCodeConfig = {
        provider: {},
      };
      expect(config).toBeDefined();
    });

    test("ModelConfig type should be defined", () => {
      const model: ModelConfig = {
        id: "test",
        name: "Test",
        limit: { context: 1000, output: 1000 },
      };
      expect(model).toBeDefined();
    });

    test("NanogptProvider type should be defined", () => {
      const provider: NanogptProvider = {
        npm: "@ai-sdk/openai-compatible",
        name: "NanoGPT",
        options: { baseURL: "https://nano-gpt.com/api/v1" },
        models: {},
      };
      expect(provider).toBeDefined();
    });

    test("McpServerConfig type should be defined", () => {
      const mcp: McpServerConfig = {
        type: "local",
        command: ["npx", "test"],
        environment: {},
        enabled: true,
      };
      expect(mcp).toBeDefined();
    });
  });

  describe("Edge cases", () => {
    test("should handle empty models object", () => {
      const provider = {
        npm: "@ai-sdk/openai-compatible",
        name: "NanoGPT",
        options: {
          baseURL: "https://nano-gpt.com/api/v1",
        },
        models: {},
      };

      const result = NanogptProviderSchema.parse(provider);
      expect(result.models).toEqual({});
    });

    test("should handle empty mcp object", () => {
      const config = {
        provider: {},
        mcp: {},
      };

      const result = OpenCodeConfigSchema.parse(config);
      expect(result.mcp).toEqual({});
    });

    test("should handle empty environment object", () => {
      const mcp = {
        type: "local",
        command: ["npx", "test"],
        environment: {},
        enabled: true,
      };

      const result = McpServerSchema.parse(mcp);
      expect(result.environment).toEqual({});
    });

    test("should validate config with complex nested structure", () => {
      const complexConfig = {
        $schema: "https://opencode.ai/config.json",
        model: "nanogpt/zai-org/glm-4.7:thinking",
        disabled_providers: ["opencode", "anthropic"],
        provider: {
          nanogpt: {
            npm: "@ai-sdk/openai-compatible",
            name: "NanoGPT",
            options: {
              baseURL: "https://nano-gpt.com/api/v1",
            },
            models: {
              "zai-org/glm-4.7": {
                id: "zai-org/glm-4.7",
                name: "GLM 4.7",
                limit: {
                  context: 200000,
                  output: 65000,
                },
                temperature: true,
                tool_call: true,
              },
              "zai-org/glm-4.7:thinking": {
                id: "zai-org/glm-4.7:thinking",
                name: "GLM 4.7 Thinking",
                limit: {
                  context: 200000,
                  output: 65000,
                },
                reasoning: true,
                interleaved: {
                  field: "reasoning_content",
                },
              },
            },
          },
          openai: {
            apiKey: "test-key",
          },
        },
        mcp: {
          nanogpt: {
            type: "local",
            command: ["npx", "@nanogpt/mcp@latest", "--scope", "user"],
            environment: {
              NANOGPT_API_KEY: "{env:NANOGPT_MCP_API_KEY}",
            },
            enabled: true,
          },
          other: {
            type: "local",
            command: ["cmd"],
            environment: {},
            enabled: false,
          },
        },
        customField: "value",
      };

      const result = validateConfig(complexConfig);
      expect(result.provider.nanogpt?.models["zai-org/glm-4.7:thinking"].reasoning).toBe(true);
      expect(result.provider.openai).toEqual({ apiKey: "test-key" });
      expect(result.mcp?.other.enabled).toBe(false);
      expect(result.customField).toBe("value");
    });
  });
});
