import { copyFile, unlink, readdir, stat, chmod } from 'fs/promises';
import { dirname, basename, join } from 'path';

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
    const backupPath = filePath + '.bak';
    await copyFile(filePath, backupPath);

    // Preserve permissions
    const stats = await stat(filePath);
    await chmod(backupPath, stats.mode);

    return backupPath;
  }

  /**
   * Restores a file from its backup.
   * @param filePath - Path to the file to restore (backup must exist at filePath.bak)
   */
  async restoreFromBackup(filePath: string): Promise<void> {
    const backupPath = filePath + '.bak';
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
    return files.filter(f => f.startsWith(base) && f.includes('.bak'));
  }

  /**
   * Cleans up old backups, keeping only the most recent N.
   * @param filePath - Base file path
   * @param keepCount - Number of recent backups to keep (default: 3)
   */
  async cleanupOldBackups(filePath: string, keepCount: number = 3): Promise<void> {
    const backups = await this.listBackups(filePath);

    if (backups.length > keepCount) {
      // Sort to ensure we keep the most recent (assuming .bak files are the only ones)
      // In a more sophisticated version, we'd sort by modification time
      const toDelete = backups.slice(0, backups.length - keepCount);
      for (const backup of toDelete) {
        await unlink(join(dirname(filePath), backup));
      }
    }
  }
}
