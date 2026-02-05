import { copyFile, unlink, readdir, stat, chmod } from "fs/promises";
import { dirname, basename, join } from "path";

/**
 * BackupManager provides safety and rollback capabilities for file modifications.
 * Creates .bak files before modifications and supports restoration.
 */
export class BackupManager {
  /**
   * Creates a backup of the specified file with .bak extension.
   * Preserves file permissions from the original file.
   * @param filePath - Path to the file to backup
   * @returns Promise resolving to the backup file path
   */
  async createBackup(filePath: string): Promise<string> {
    const backupPath = filePath + ".bak";
    await copyFile(filePath, backupPath);

    const stats = await stat(filePath);
    await chmod(backupPath, stats.mode);

    return backupPath;
  }

  /**
   * Restores a file from its backup.
   * @param filePath - Path to the file to restore (backup must exist at filePath.bak)
   */
  async restoreFromBackup(filePath: string): Promise<void> {
    const backupPath = filePath + ".bak";
    await copyFile(backupPath, filePath);
  }

  /**
   * Lists all backup files for a given file path.
   * @param filePath - Base file path to search for backups
   * @returns Array of backup file names (not full paths)
   */
  async listBackups(filePath: string): Promise<string[]> {
    const dir = dirname(filePath);
    const base = basename(filePath);
    const files = await readdir(dir);
    return files.filter((f) => f.startsWith(base) && f.includes(".bak"));
  }

  /**
   * Cleans up old backups, keeping only the most recent N.
   * @param filePath - Base file path
   * @param keepCount - Number of recent backups to keep (default: 3)
   */
  async cleanupOldBackups(
    filePath: string,
    keepCount: number = 3,
  ): Promise<void> {
    const backups = await this.listBackups(filePath);

    if (backups.length > keepCount) {
      const backupWithTimes = await Promise.all(
        backups.map(async (backup) => {
          const backupPath = join(dirname(filePath), backup);
          const stats = await stat(backupPath);
          return { name: backup, mtimeMs: stats.mtimeMs };
        }),
      );

      backupWithTimes.sort((a, b) => b.mtimeMs - a.mtimeMs);

      const backupsToDelete = backupWithTimes.slice(keepCount);
      await Promise.all(
        backupsToDelete.map(({ name }) =>
          unlink(join(dirname(filePath), name)),
        ),
      );
    }
  }

  /**
   * Restores a file from a specific backup file.
   * Validates and sanitizes backupName to prevent path traversal attacks.
   * @param filePath - Path to the file to restore
   * @param backupName - Name of the backup file (not full path)
   * @throws Error if backupName contains path traversal attempts
   */
  async restoreFromSpecificBackup(
    filePath: string,
    backupName: string,
  ): Promise<void> {
    // Sanitize backupName to prevent path traversal
    const sanitizedName = basename(backupName);

    // Validate that the sanitized name matches the original (no traversal attempts)
    if (sanitizedName !== backupName) {
      throw new Error(
        `Invalid backup name: ${backupName}. Path separators and traversal sequences are not allowed.`,
      );
    }

    // Additional validation: ensure no '..' or path separators
    if (
      backupName.includes("..") ||
      backupName.includes("/") ||
      backupName.includes("\\")
    ) {
      throw new Error(
        `Invalid backup name: ${backupName}. Path traversal is not allowed.`,
      );
    }

    // Compute the backup path
    const dir = dirname(filePath);
    const backupPath = join(dir, sanitizedName);

    // Verify the resolved backupPath starts with the intended directory
    const resolvedBackupPath = await import("path").then((m) =>
      m.resolve(backupPath),
    );
    const resolvedDir = await import("path").then((m) => m.resolve(dir));

    if (!resolvedBackupPath.startsWith(resolvedDir)) {
      throw new Error(
        `Security error: Backup path ${resolvedBackupPath} is outside the intended directory.`,
      );
    }

    // Perform the restore
    await copyFile(backupPath, filePath);
  }
}
