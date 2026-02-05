import { Command } from "commander";
import { ConfigManager } from "../config-manager.js";
import { BackupManager } from "../backup.js";
import {
  ensureNanogptProvider,
  configureMcpEnvironment,
} from "../providers/nanogpt.js";
import { validateAfterWrite } from "../validation.js";
import { access } from "fs/promises";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";

export const initCommand = new Command("init")
  .description("Initialize nanogpt provider with MCP configuration")
  .option("-f, --force", "Overwrite existing nanogpt configuration")
  .action(async (_options) => {
    const program = initCommand.parent;
    if (!program) {
      console.error("Error: Unable to access parent command");
      process.exit(1);
    }

    const opts = program.opts();
    const configPath = opts.config as string;
    const apiKey = opts.apiKey as string | undefined;

    const configManager = new ConfigManager();
    const backupManager = new BackupManager();

    try {
      let configExists = true;
      try {
        await access(configPath);
      } catch {
        configExists = false;
      }

      if (!configExists) {
        console.log(`Creating new config file at ${configPath}`);
        await mkdir(dirname(configPath), { recursive: true });
        await writeFile(configPath, "{}", "utf-8");
      }

      console.log("Creating backup...");
      await backupManager.createBackup(configPath);

      console.log("Initializing nanogpt provider...");
      await ensureNanogptProvider(configManager, configPath);

      if (apiKey) {
        console.log("Configuring MCP environment...");
        await configureMcpEnvironment(configManager, configPath);
        console.log("MCP server configured successfully");
      } else {
        console.log("Note: No API key provided. MCP server not configured.");
        console.log(
          "Run with --api-key <key> to configure MCP, or use environment variable NANOGPT_API_KEY",
        );
      }

      console.log("Validating configuration...");
      await validateAfterWrite(configManager, configPath);

      console.log("\n✓ NanoGPT provider initialized successfully!");
      console.log(`  Config file: ${configPath}`);

      if (!apiKey) {
        console.log("\nTo configure MCP later, run:");
        console.log(`  nanogpt-config init --api-key <your-api-key>`);
      }
    } catch (error) {
      console.error(
        "Error initializing nanogpt provider:",
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });
