import {
  configureMcpEnvironment,
  McpServerConfig,
  updateNanogptProvider,
  ensureNanogptProvider,
  removeNanogptProvider,
  NanogptModel,
  NanogptProvider,
} from "./nanogpt";
import { ConfigManager } from "../config-manager";
import { readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";

describe("configureMcpEnvironment", () => {
  let configManager: ConfigManager;
  let testFilePath: string;

  beforeEach(async () => {
    configManager = new ConfigManager();
    testFilePath = join("/tmp", `test-mcp-config-${Date.now()}.json`);
  });

  afterEach(async () => {
    try {
      await unlink(testFilePath);
    } catch {
      // File may not exist, ignore
    }
  });

  it("creates MCP section with correct structure", async () => {
    // Create initial empty config
    await writeFile(testFilePath, "{}");

    const testApiKey = "test-secret-key-123";
    await configureMcpEnvironment(configManager, testFilePath, testApiKey);

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    expect(config.mcp).toBeDefined();
    expect(config.mcp.nanogpt).toBeDefined();

    const mcpConfig = config.mcp.nanogpt as McpServerConfig;
    expect(mcpConfig.type).toBe("local");
    expect(mcpConfig.command).toEqual([
      "bunx",
      "@nanogpt/mcp@latest",
      "--scope",
      "user",
    ]);
    expect(mcpConfig.enabled).toBe(true);
  });

  it("uses {env:NANOGPT_API_KEY} syntax instead of actual API key", async () => {
    await writeFile(testFilePath, "{}");

    const testApiKey = "super-secret-api-key-should-not-appear";
    await configureMcpEnvironment(configManager, testFilePath, testApiKey);

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    const mcpConfig = config.mcp.nanogpt as McpServerConfig;
    expect(mcpConfig.environment.NANOGPT_API_KEY).toBe("{env:NANOGPT_API_KEY}");
    expect(mcpConfig.environment.NANOGPT_API_KEY).not.toBe(testApiKey);
  });

  it("does not modify other MCP servers", async () => {
    const initialConfig = {
      mcp: {
        nanogpt: { type: "local", command: ["old"], enabled: false },
        otherServer: {
          type: "local",
          command: ["npx", "@other/mcp"],
          environment: { OTHER_KEY: "actual-value" },
          enabled: true,
        },
      },
    };
    await writeFile(testFilePath, JSON.stringify(initialConfig, null, 2));

    const testApiKey = "new-api-key";
    await configureMcpEnvironment(configManager, testFilePath, testApiKey);

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    // nanogpt should be updated
    expect(config.mcp.nanogpt.type).toBe("local");
    expect(config.mcp.nanogpt.command).toEqual([
      "bunx",
      "@nanogpt/mcp@latest",
      "--scope",
      "user",
    ]);
    expect(config.mcp.nanogpt.environment.NANOGPT_API_KEY).toBe(
      "{env:NANOGPT_API_KEY}",
    );
    expect(config.mcp.nanogpt.enabled).toBe(true);

    // otherServer should be unchanged
    expect(config.mcp.otherServer).toEqual(initialConfig.mcp.otherServer);
  });

  it("sets command array correctly", async () => {
    await writeFile(testFilePath, "{}");

    await configureMcpEnvironment(configManager, testFilePath, "any-key");

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    const mcpConfig = config.mcp.nanogpt as McpServerConfig;
    expect(mcpConfig.command).toBeInstanceOf(Array);
    expect(mcpConfig.command.length).toBe(4);
    expect(mcpConfig.command[0]).toBe("bunx");
    expect(mcpConfig.command[1]).toBe("@nanogpt/mcp@latest");
    expect(mcpConfig.command[2]).toBe("--scope");
    expect(mcpConfig.command[3]).toBe("user");
  });

  it("sets enabled flag to true", async () => {
    await writeFile(testFilePath, "{}");

    await configureMcpEnvironment(configManager, testFilePath, "any-key");

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    const mcpConfig = config.mcp.nanogpt as McpServerConfig;
    expect(mcpConfig.enabled).toBe(true);
  });

  it("creates MCP section when mcp object exists but nanogpt does not", async () => {
    await writeFile(testFilePath, JSON.stringify({ mcp: {} }));

    await configureMcpEnvironment(configManager, testFilePath, "any-key");

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    expect(config.mcp.nanogpt).toBeDefined();
    expect((config.mcp.nanogpt as McpServerConfig).type).toBe("local");
  });

  it("overwrites existing nanogpt MCP configuration", async () => {
    const initialConfig = {
      mcp: {
        nanogpt: {
          type: "stdio",
          command: ["old-command"],
          environment: { NANOGPT_API_KEY: "old-key" },
          enabled: false,
        },
      },
    };
    await writeFile(testFilePath, JSON.stringify(initialConfig, null, 2));

    await configureMcpEnvironment(configManager, testFilePath, "new-key");

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    const mcpConfig = config.mcp.nanogpt as McpServerConfig;
    expect(mcpConfig.type).toBe("local");
    expect(mcpConfig.command).toEqual([
      "bunx",
      "@nanogpt/mcp@latest",
      "--scope",
      "user",
    ]);
    expect(mcpConfig.environment.NANOGPT_API_KEY).toBe("{env:NANOGPT_API_KEY}");
    expect(mcpConfig.enabled).toBe(true);
  });

  it("handles config with no mcp section", async () => {
    await writeFile(testFilePath, JSON.stringify({ provider: {} }));

    await configureMcpEnvironment(configManager, testFilePath, "any-key");

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    expect(config.mcp).toBeDefined();
    expect(config.mcp.nanogpt).toBeDefined();
  });

  it("preserves other top-level config sections", async () => {
    const initialConfig = {
      provider: { openai: { models: {} } },
      model: "test-model",
      settings: { debug: true },
    };
    await writeFile(testFilePath, JSON.stringify(initialConfig, null, 2));

    await configureMcpEnvironment(configManager, testFilePath, "any-key");

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    expect(config.provider).toEqual(initialConfig.provider);
    expect(config.model).toBe(initialConfig.model);
    expect(config.settings).toEqual(initialConfig.settings);
    expect(config.mcp).toBeDefined();
  });
});

// Helper function for tests
async function writeTestFile(path: string, content: string): Promise<void> {
  await writeFile(path, content, "utf-8");
}

describe("updateNanogptProvider", () => {
  let configManager: ConfigManager;
  let testFilePath: string;

  beforeEach(async () => {
    configManager = new ConfigManager();
    testFilePath = join("/tmp", `test-nanogpt-provider-${Date.now()}.json`);
  });

  afterEach(async () => {
    try {
      await unlink(testFilePath);
    } catch {
      // File may not exist, ignore
    }
  });

  it("should update nanogpt models while preserving other providers", async () => {
    const initialConfig = {
      provider: {
        nanogpt: {
          npm: "@ai-sdk/openai-compatible",
          name: "NanoGPT",
          options: { baseURL: "https://nano-gpt.com/api/v1" },
          models: {
            "old-model": {
              id: "old",
              name: "Old Model",
              limit: { context: 4096, output: 1024 },
            },
          },
        },
        opencode: {
          npm: "@ai-sdk/opencode",
          name: "OpenCode",
          models: {
            "big-pickle": {
              name: "Big Pickle",
              limit: { context: 128000, output: 4096 },
            },
          },
        },
        openai: {
          npm: "@ai-sdk/openai",
          name: "OpenAI",
          models: {
            "gpt-4": { name: "GPT-4", limit: { context: 8192, output: 4096 } },
          },
        },
      },
    };
    await writeTestFile(testFilePath, JSON.stringify(initialConfig, null, 2));

    const newModels: Record<string, NanogptModel> = {
      "zai-org/glm-4.7": {
        id: "zai-org/glm-4.7",
        name: "GLM 4.7",
        limit: { context: 200000, output: 65000 },
        temperature: true,
        tool_call: true,
      },
    };

    await updateNanogptProvider(configManager, testFilePath, newModels);

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    // nanogpt models should be updated
    expect(config.provider.nanogpt.models).toEqual(newModels);

    // nanogpt other properties should be preserved
    expect(config.provider.nanogpt.npm).toBe("@ai-sdk/openai-compatible");
    expect(config.provider.nanogpt.name).toBe("NanoGPT");
    expect(config.provider.nanogpt.options.baseURL).toBe(
      "https://nano-gpt.com/api/v1",
    );

    // Other providers should be untouched
    expect(config.provider.opencode).toEqual(initialConfig.provider.opencode);
    expect(config.provider.openai).toEqual(initialConfig.provider.openai);
  });

  it("should only modify nanogpt section, leaving other sections intact", async () => {
    const initialConfig = {
      model: "nanogpt/zai-org/glm-4.7",
      disabled_providers: ["opencode"],
      provider: {
        nanogpt: {
          npm: "@ai-sdk/openai-compatible",
          name: "NanoGPT",
          options: { baseURL: "https://nano-gpt.com/api/v1" },
          models: {},
        },
        other: { models: {} },
      },
      mcp: { nanogpt: { type: "local", command: ["npx"], enabled: true } },
    };
    await writeTestFile(testFilePath, JSON.stringify(initialConfig, null, 2));

    const newModels: Record<string, NanogptModel> = {
      "test-model": {
        id: "test-model",
        name: "Test Model",
        limit: { context: 1000, output: 500 },
      },
    };

    await updateNanogptProvider(configManager, testFilePath, newModels);

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    // Top-level config should be preserved
    expect(config.model).toBe("nanogpt/zai-org/glm-4.7");
    expect(config.disabled_providers).toEqual(["opencode"]);

    // Other providers should be preserved
    expect(config.provider.other).toEqual(initialConfig.provider.other);

    // MCP section should be preserved
    expect(config.mcp).toEqual(initialConfig.mcp);

    // nanogpt models should be updated
    expect(config.provider.nanogpt.models).toEqual(newModels);
  });

  it("should handle config with comments preserving them after modification", async () => {
    const content = `{
  // Main configuration
  "provider": {
    // NanoGPT provider
    "nanogpt": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "NanoGPT",
      "options": { "baseURL": "https://nano-gpt.com/api/v1" },
      "models": {}
    },
    // Other providers
    "opencode": { "models": {} }
  }
}`;
    await writeTestFile(testFilePath, content);

    const newModels: Record<string, NanogptModel> = {
      "new-model": {
        id: "new-model",
        name: "New Model",
        limit: { context: 4096, output: 1024 },
      },
    };

    await updateNanogptProvider(configManager, testFilePath, newModels);

    const result = await readFile(testFilePath, "utf-8");

    // Comments should be preserved
    expect(result).toContain("// Main configuration");
    expect(result).toContain("// NanoGPT provider");
    expect(result).toContain("// Other providers");

    // New models should be present
    expect(result).toContain('"new-model"');
  });
});

describe("ensureNanogptProvider", () => {
  let configManager: ConfigManager;
  let testFilePath: string;

  beforeEach(async () => {
    configManager = new ConfigManager();
    testFilePath = join("/tmp", `test-ensure-provider-${Date.now()}.json`);
  });

  afterEach(async () => {
    try {
      await unlink(testFilePath);
    } catch {
      // File may not exist, ignore
    }
  });

  it("should create nanogpt provider with default structure", async () => {
    await writeTestFile(
      testFilePath,
      JSON.stringify({ provider: {} }, null, 2),
    );

    await ensureNanogptProvider(configManager, testFilePath);

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    expect(config.provider.nanogpt).toBeDefined();
    expect(config.provider.nanogpt.npm).toBe("@ai-sdk/openai-compatible");
    expect(config.provider.nanogpt.name).toBe("NanoGPT");
    expect(config.provider.nanogpt.options.baseURL).toBe(
      "https://nano-gpt.com/api/v1",
    );
    expect(config.provider.nanogpt.models).toEqual({});
  });

  it("should preserve existing nanogpt configuration", async () => {
    const existingProvider: NanogptProvider = {
      npm: "@ai-sdk/custom",
      name: "Custom NanoGPT",
      options: { baseURL: "https://custom.nano-gpt.com/api/v1" },
      models: {
        "custom-model": {
          id: "custom",
          name: "Custom",
          limit: { context: 1000, output: 500 },
        },
      },
    };
    await writeTestFile(
      testFilePath,
      JSON.stringify({ provider: { nanogpt: existingProvider } }, null, 2),
    );

    await ensureNanogptProvider(configManager, testFilePath);

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    // Existing config should be overwritten with defaults (modifyConfig replaces the entire path)
    expect(config.provider.nanogpt.npm).toBe("@ai-sdk/openai-compatible");
    expect(config.provider.nanogpt.name).toBe("NanoGPT");
    expect(config.provider.nanogpt.options.baseURL).toBe(
      "https://nano-gpt.com/api/v1",
    );
    expect(config.provider.nanogpt.models).toEqual({});
  });

  it("should not modify other providers", async () => {
    const initialConfig = {
      provider: {
        opencode: {
          npm: "@opencode",
          name: "OpenCode",
          options: { baseURL: "https://opencode.ai" },
          models: {},
        },
        openai: {
          npm: "@openai",
          name: "OpenAI",
          options: { baseURL: "https://api.openai.com" },
          models: {},
        },
      },
    };
    await writeTestFile(testFilePath, JSON.stringify(initialConfig, null, 2));

    await ensureNanogptProvider(configManager, testFilePath);

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    // Other providers should be untouched
    expect(config.provider.opencode).toEqual(initialConfig.provider.opencode);
    expect(config.provider.openai).toEqual(initialConfig.provider.openai);

    // nanogpt should be created
    expect(config.provider.nanogpt).toBeDefined();
  });
});

describe("removeNanogptProvider", () => {
  let configManager: ConfigManager;
  let testFilePath: string;

  beforeEach(async () => {
    configManager = new ConfigManager();
    testFilePath = join("/tmp", `test-remove-provider-${Date.now()}.json`);
  });

  afterEach(async () => {
    try {
      await unlink(testFilePath);
    } catch {
      // File may not exist, ignore
    }
  });

  it("should remove nanogpt provider section", async () => {
    const initialConfig = {
      provider: {
        nanogpt: {
          npm: "@ai-sdk/openai-compatible",
          name: "NanoGPT",
          options: { baseURL: "https://nano-gpt.com/api/v1" },
          models: {
            "model-1": {
              id: "model-1",
              name: "Model 1",
              limit: { context: 4096, output: 1024 },
            },
          },
        },
        opencode: { models: {} },
      },
    };
    await writeTestFile(testFilePath, JSON.stringify(initialConfig, null, 2));

    await removeNanogptProvider(configManager, testFilePath);

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    // nanogpt should be removed
    expect(config.provider.nanogpt).toBeUndefined();

    // Other providers should remain
    expect(config.provider.opencode).toBeDefined();
  });

  it("should preserve other providers when removing nanogpt", async () => {
    const initialConfig = {
      provider: {
        nanogpt: {
          npm: "@ai-sdk/openai-compatible",
          name: "NanoGPT",
          options: {},
          models: {},
        },
        opencode: {
          npm: "@opencode",
          name: "OpenCode",
          options: {},
          models: {
            "model-1": {
              name: "Model 1",
              limit: { context: 1000, output: 500 },
            },
          },
        },
        openai: {
          npm: "@openai",
          name: "OpenAI",
          options: {},
          models: {
            "gpt-4": { name: "GPT-4", limit: { context: 8000, output: 4000 } },
          },
        },
      },
    };
    await writeTestFile(testFilePath, JSON.stringify(initialConfig, null, 2));

    await removeNanogptProvider(configManager, testFilePath);

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    // All other providers should be intact
    expect(config.provider.opencode).toEqual(initialConfig.provider.opencode);
    expect(config.provider.openai).toEqual(initialConfig.provider.openai);

    // nanogpt should be gone
    expect(config.provider.nanogpt).toBeUndefined();
  });

  it("should preserve structure when removing nanogpt", async () => {
    const content = `{
  // Provider configuration
  "provider": {
    "nanogpt": {
      "name": "NanoGPT",
      "models": {}
    },
    "opencode": {
      "name": "OpenCode",
      "models": {}
    }
  }
}`;
    await writeTestFile(testFilePath, content);

    await removeNanogptProvider(configManager, testFilePath);

    const result = await readFile(testFilePath, "utf-8");

    // Top-level comments should be preserved
    expect(result).toContain("// Provider configuration");

    // nanogpt should be removed
    expect(result).not.toContain('"nanogpt"');

    // opencode should still be there
    expect(result).toContain('"opencode"');
    expect(result).toContain('"name": "OpenCode"');
  });

  it("should handle removing non-existent nanogpt gracefully", async () => {
    const initialConfig = {
      provider: {
        opencode: { models: {} },
      },
    };
    await writeTestFile(testFilePath, JSON.stringify(initialConfig, null, 2));

    // Should not throw even though nanogpt doesn't exist
    await removeNanogptProvider(configManager, testFilePath);

    const content = await readFile(testFilePath, "utf-8");
    const config = JSON.parse(content);

    // Config should remain unchanged
    expect(config.provider.opencode).toBeDefined();
    expect(config.provider.nanogpt).toBeUndefined();
  });
});
