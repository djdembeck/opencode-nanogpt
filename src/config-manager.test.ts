import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rmdir, unlink, writeFile, readFile, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { ConfigManager } from "./config-manager";

describe("ConfigManager", () => {
  const configManager = new ConfigManager();
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `config-manager-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rmdir(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("readConfig", () => {
    test("should read and parse valid JSON file", async () => {
      const filePath = join(testDir, "config.json");
      const config = { name: "test", value: 42 };
      await writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");

      const result = await configManager.readConfig(filePath);

      expect(result).toEqual(config);
    });

    test("should read and parse JSON with comments", async () => {
      const filePath = join(testDir, "config.jsonc");
      const content = `{
        // This is a comment
        "name": "test",
        /* Multi-line
           comment */
        "value": 42
      }`;
      await writeFile(filePath, content, "utf-8");

      const result = await configManager.readConfig(filePath);

      expect(result).toEqual({ name: "test", value: 42 });
    });

    test("should read and parse JSON with trailing commas", async () => {
      const filePath = join(testDir, "config.json");
      const content = `{
        "name": "test",
        "value": 42,
      }`;
      await writeFile(filePath, content, "utf-8");

      const result = await configManager.readConfig(filePath);

      expect(result).toEqual({ name: "test", value: 42 });
    });

    test("should throw error when file does not exist", async () => {
      const filePath = join(testDir, "nonexistent.json");

      await expect(configManager.readConfig(filePath)).rejects.toThrow();
    });

    test("should throw error for invalid JSON", async () => {
      const filePath = join(testDir, "invalid.json");
      await writeFile(filePath, "{ invalid json", "utf-8");

      await expect(configManager.readConfig(filePath)).rejects.toThrow(/JSONC parse error/);
    });

    test("should parse nested objects", async () => {
      const filePath = join(testDir, "nested.json");
      const config = {
        level1: {
          level2: {
            level3: "deep value"
          }
        }
      };
      await writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");

      const result = await configManager.readConfig(filePath);

      expect(result.level1.level2.level3).toBe("deep value");
    });

    test("should parse arrays", async () => {
      const filePath = join(testDir, "array.json");
      const config = { items: [1, 2, 3, { name: "test" }] };
      await writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");

      const result = await configManager.readConfig(filePath);

      expect(result.items).toHaveLength(4);
      expect(result.items[3].name).toBe("test");
    });
  });

  describe("writeConfig", () => {
    test("should write content to file", async () => {
      const filePath = join(testDir, "output.json");
      const content = JSON.stringify({ test: true }, null, 2);

      await configManager.writeConfig(filePath, content);

      const result = await readFile(filePath, "utf-8");
      expect(result).toBe(content);
    });

    test("should create parent directories if needed", async () => {
      const filePath = join(testDir, "nested", "deep", "output.json");
      const content = JSON.stringify({ test: true }, null, 2);

      await configManager.writeConfig(filePath, content);

      const result = await readFile(filePath, "utf-8");
      expect(result).toBe(content);
    });

    test("should overwrite existing file", async () => {
      const filePath = join(testDir, "existing.json");
      await writeFile(filePath, "{ \"old\": true }", "utf-8");

      const newContent = JSON.stringify({ new: true }, null, 2);
      await configManager.writeConfig(filePath, newContent);

      const result = await readFile(filePath, "utf-8");
      expect(result).toBe(newContent);
    });

    test("should perform atomic write", async () => {
      const filePath = join(testDir, "atomic.json");
      const content = JSON.stringify({ atomic: true }, null, 2);

      // Write initial content
      await writeFile(filePath, "{ \"initial\": true }", "utf-8");

      // Write new content
      await configManager.writeConfig(filePath, content);

      // File should exist and have new content
      const result = await readFile(filePath, "utf-8");
      expect(result).toBe(content);

      // Temp file should not exist
      const tempPath = filePath + ".tmp";
      await expect(access(tempPath)).rejects.toThrow();
    });
  });

  describe("modifyConfig", () => {
    test("should modify a simple value", async () => {
      const filePath = join(testDir, "modify.json");
      const initialContent = JSON.stringify({ name: "old", value: 42 }, null, 2);
      await writeFile(filePath, initialContent, "utf-8");

      await configManager.modifyConfig(filePath, ["name"], "new");

      const result = await configManager.readConfig(filePath);
      expect(result.name).toBe("new");
      expect(result.value).toBe(42);
    });

    test("should preserve comments and formatting", async () => {
      const filePath = join(testDir, "formatting.jsonc");
      const content = `{
  // Configuration file
  "name": "test",
  /* This is a setting */
  "value": 42
}`;
      await writeFile(filePath, content, "utf-8");

      await configManager.modifyConfig(filePath, ["value"], 100);

      const result = await readFile(filePath, "utf-8");
      expect(result).toContain("// Configuration file");
      expect(result).toContain("/* This is a setting */");
      expect(result).toContain('"value": 100');
    });

    test("should modify nested properties", async () => {
      const filePath = join(testDir, "nested.json");
      const content = JSON.stringify({
        level1: {
          level2: {
            target: "old value",
            other: "unchanged"
          }
        }
      }, null, 2);
      await writeFile(filePath, content, "utf-8");

      await configManager.modifyConfig(filePath, ["level1", "level2", "target"], "new value");

      const result = await configManager.readConfig(filePath);
      expect(result.level1.level2.target).toBe("new value");
      expect(result.level1.level2.other).toBe("unchanged");
    });

    test("should add new property to object", async () => {
      const filePath = join(testDir, "add.json");
      const content = JSON.stringify({ existing: "value" }, null, 2);
      await writeFile(filePath, content, "utf-8");

      await configManager.modifyConfig(filePath, ["newProperty"], "new value");

      const result = await configManager.readConfig(filePath);
      expect(result.existing).toBe("value");
      expect(result.newProperty).toBe("new value");
    });

    test("should modify array elements", async () => {
      const filePath = join(testDir, "array.json");
      const content = JSON.stringify({ items: [1, 2, 3] }, null, 2);
      await writeFile(filePath, content, "utf-8");

      await configManager.modifyConfig(filePath, ["items", 1], 100);

      const result = await configManager.readConfig(filePath);
      expect(result.items).toEqual([1, 100, 3]);
    });

    test("should modify object inside array", async () => {
      const filePath = join(testDir, "array-obj.json");
      const content = JSON.stringify({
        items: [{ name: "first" }, { name: "second" }]
      }, null, 2);
      await writeFile(filePath, content, "utf-8");

      await configManager.modifyConfig(filePath, ["items", 1, "name"], "modified");

      const result = await configManager.readConfig(filePath);
      expect(result.items[1].name).toBe("modified");
      expect(result.items[0].name).toBe("first");
    });

    test("should modify boolean values", async () => {
      const filePath = join(testDir, "bool.json");
      const content = JSON.stringify({ enabled: false }, null, 2);
      await writeFile(filePath, content, "utf-8");

      await configManager.modifyConfig(filePath, ["enabled"], true);

      const result = await configManager.readConfig(filePath);
      expect(result.enabled).toBe(true);
    });

    test("should modify null values", async () => {
      const filePath = join(testDir, "null.json");
      const content = JSON.stringify({ value: null }, null, 2);
      await writeFile(filePath, content, "utf-8");

      await configManager.modifyConfig(filePath, ["value"], "not null");

      const result = await configManager.readConfig(filePath);
      expect(result.value).toBe("not null");
    });

    test("should handle complex nested modifications", async () => {
      const filePath = join(testDir, "complex.json");
      const content = JSON.stringify({
        provider: {
          nanogpt: {
            models: {
              "model-1": { name: "Model 1", limit: 4096 }
            }
          }
        }
      }, null, 2);
      await writeFile(filePath, content, "utf-8");

      await configManager.modifyConfig(filePath, ["provider", "nanogpt", "models", "model-1", "limit"], 8192);

      const result = await configManager.readConfig(filePath);
      expect(result.provider.nanogpt.models["model-1"].limit).toBe(8192);
      expect(result.provider.nanogpt.models["model-1"].name).toBe("Model 1");
    });

    test("should throw error when file does not exist", async () => {
      const filePath = join(testDir, "nonexistent.json");

      await expect(configManager.modifyConfig(filePath, ["key"], "value")).rejects.toThrow();
    });
  });

  describe("integration", () => {
    test("should handle full workflow: read, modify, verify", async () => {
      const filePath = join(testDir, "workflow.json");
      const initialConfig = {
        api: {
          url: "https://example.com",
          key: "secret123"
        },
        settings: {
          enabled: true,
          retries: 3
        }
      };
      await writeFile(filePath, JSON.stringify(initialConfig, null, 2), "utf-8");

      // Read
      const readResult = await configManager.readConfig(filePath);
      expect(readResult.api.key).toBe("secret123");

      // Modify
      await configManager.modifyConfig(filePath, ["settings", "retries"], 5);

      // Verify
      const verifyResult = await configManager.readConfig(filePath);
      expect(verifyResult.settings.retries).toBe(5);
      expect(verifyResult.api.key).toBe("secret123"); // Unchanged
    });

    test("should handle JSONC with multiple modifications", async () => {
      const filePath = join(testDir, "multi.jsonc");
      const content = `{
  // API Configuration
  "api": {
    "url": "https://old.com",
    // API version
    "version": "v1"
  },
  // Feature flags
  "features": ["a", "b", "c"]
}`;
      await writeFile(filePath, content, "utf-8");

      await configManager.modifyConfig(filePath, ["api", "url"], "https://new.com");
      await configManager.modifyConfig(filePath, ["features", 1], "modified");

      const result = await readFile(filePath, "utf-8");
      expect(result).toContain("// API Configuration");
      expect(result).toContain("// API version");
      expect(result).toContain("// Feature flags");
      expect(result).toContain('"url": "https://new.com"');
      expect(result).toContain('"modified"');
    });
  });
});
