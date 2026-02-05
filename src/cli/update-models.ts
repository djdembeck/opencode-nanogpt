import { Command } from "commander";
import { ConfigManager } from "../config-manager.js";
import { BackupManager } from "../backup.js";
import { ensureNanogptProvider } from "../providers/nanogpt.js";
import { validateAfterWrite } from "../validation.js";
import { updateModelsFromApi, NanogptApiError } from "../api/nanogpt.js";
import { access, readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

interface AuthConfig {
  nanogpt?:
    | string
    | {
        type: string;
        key: string;
      };
}

/**
 * Resolves the API key from multiple sources in priority order:
 * 1. Command line option (--api-key)
 * 2. Auth file (~/.local/share/opencode/auth.json)
 * 3. Environment variable (NANOGPT_API_KEY)
 */
async function resolveApiKey(
  apiKeyOption: string | undefined,
): Promise<string | undefined> {
  if (apiKeyOption) {
    return apiKeyOption;
  }

  const authFilePath = join(
    homedir(),
    ".local",
    "share",
    "opencode",
    "auth.json",
  );
  try {
    await access(authFilePath);
    const authContent = await readFile(authFilePath, "utf-8");
    const authConfig: AuthConfig = JSON.parse(authContent);

    if (authConfig.nanogpt) {
      if (typeof authConfig.nanogpt === "string") {
        return authConfig.nanogpt;
      }
      if (typeof authConfig.nanogpt === "object" && authConfig.nanogpt.key) {
        return authConfig.nanogpt.key;
      }
    }
  } catch {
    // Continue to next source
  }

  return process.env.NANOGPT_API_KEY;
}

/**
 * Formats an API error into a user-friendly error message.
 */
function formatApiError(error: unknown): string {
  if (error instanceof NanogptApiError) {
    switch (error.code) {
      case "AUTH_ERROR":
        return "Authentication failed: Invalid API key. Please check your API key and try again.";
      case "RATE_LIMIT":
        return "Rate limit exceeded: Too many requests. Please wait a moment and try again.";
      case "SERVER_ERROR":
        return "NanoGPT API server error. Please try again later.";
      case "TIMEOUT":
        return "Request timeout: API did not respond in time. Please check your network connection.";
      case "NETWORK_ERROR":
        return "Network error: Unable to connect to NanoGPT API. Please check your internet connection.";
      case "INVALID_RESPONSE":
        return "Invalid response from NanoGPT API. The API may have changed or be temporarily unavailable.";
      default:
        return `API request failed: ${error.message}`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred while fetching models.";
}

export const updateModelsCommand = new Command("update-models")
  .description("Update models from NanoGPT API")
  .option("-f, --force", "Force update even if no changes detected")
  .action(async (options) => {
    const program = updateModelsCommand.parent;
    if (!program) {
      console.error("Error: Unable to access parent command");
      process.exit(1);
    }

    const opts = program.opts();
    const configPath = opts.config as string;
    const apiKeyOption = opts.apiKey as string | undefined;

    const configManager = new ConfigManager();
    const backupManager = new BackupManager();

    try {
      try {
        await access(configPath);
      } catch {
        console.error(`Error: Config file not found at ${configPath}`);
        console.error(
          'Run "nanogpt-config init" first to create a configuration file.',
        );
        process.exit(1);
      }

      console.log("Creating backup...");
      await backupManager.createBackup(configPath);

      console.log("Ensuring nanogpt provider...");
      await ensureNanogptProvider(configManager, configPath);

      console.log("Resolving API key...");
      const apiKey = await resolveApiKey(apiKeyOption);

      if (!apiKey) {
        console.error("\nError: NanoGPT API key not found.");
        console.error(
          "\nPlease provide an API key using one of the following methods:",
        );
        console.error("  1. Command line option: --api-key <your-api-key>");
        console.error("  2. Auth file: ~/.local/share/opencode/auth.json");
        console.error("  3. Environment variable: NANOGPT_API_KEY");
        console.error("\nTo get your API key, visit: https://nano-gpt.com/api");
        process.exit(1);
      }

      console.log("Fetching models from NanoGPT API...");
      await updateModelsFromApi(configManager, configPath, apiKey);

      console.log("Validating configuration...");
      await validateAfterWrite(configManager, configPath);

      console.log("\n✓ Models updated successfully from NanoGPT API!");
      console.log(`  Config file: ${configPath}`);
      console.log(
        "\nTo view available models, check your config file or use OpenCode.",
      );
    } catch (error) {
      const errorMessage = formatApiError(error);
      console.error(`\nError updating models: ${errorMessage}`);
      process.exit(1);
    }
  });
