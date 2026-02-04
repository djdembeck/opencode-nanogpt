import { parse, modify, applyEdits, Edit } from "jsonc-parser";
import { readFile, writeFile, rename, mkdir } from "fs/promises";
import { dirname } from "path";

/**
 * ConfigManager provides surgical config file modification using jsonc-parser.
 * Preserves comments, formatting, and supports JSON/JSONC files.
 */
export class ConfigManager {
  /**
   * Reads and parses a JSON/JSONC configuration file.
   * @param filePath - Path to the configuration file
   * @returns Parsed configuration object
   * @throws Error if file not found or contains invalid JSON
   */
  async readConfig(filePath: string): Promise<any> {
    const content = await readFile(filePath, "utf-8");
    const errors: any[] = [];
    const result = parse(content, errors, {
      disallowComments: false,
      allowTrailingComma: true,
    });
    if (errors.length > 0) {
      throw new Error(`JSONC parse error: ${errors[0].error}`);
    }
    return result;
  }

  /**
   * Writes content to a file atomically using write-then-rename pattern.
   * Creates parent directories if they don't exist.
   * @param filePath - Path to write the file
   * @param content - Content to write
   * @throws Error if write fails (permissions, disk full, etc.)
   */
  async writeConfig(filePath: string, content: string): Promise<void> {
    // Ensure parent directories exist
    const dir = dirname(filePath);
    await mkdir(dir, { recursive: true });

    // Atomic write: write to temp file first, then rename
    const tempPath = filePath + ".tmp";
    await writeFile(tempPath, content, "utf-8");
    await rename(tempPath, filePath);
  }

  /**
   * Surgically modifies a value at the specified path in a config file.
   * Preserves comments, formatting, and other content.
   * @param filePath - Path to the configuration file
   * @param path - Array of property names/indexes representing the path to the value
   * @param value - New value to set at the specified path
   * @throws Error if file not found or modification fails
   */
  async modifyConfig(
    filePath: string,
    path: string[],
    value: any
  ): Promise<void> {
    const content = await readFile(filePath, "utf-8");
    const edits = modify(content, path, value, {
      formattingOptions: { tabSize: 2, insertSpaces: true, eol: "\n" },
    });
    const newContent = applyEdits(content, edits);
    await writeFile(filePath, newContent, "utf-8");
  }
}
