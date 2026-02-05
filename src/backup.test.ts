import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { BackupManager } from './backup';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';

describe('BackupManager', () => {
  const backupManager = new BackupManager();
  const testDir = join(process.cwd(), 'test-temp');
  const testFile = join(testDir, 'test-file.txt');

  beforeEach(async () => {
    // Create test directory if it doesn't exist
    await mkdir(testDir, { recursive: true });
    // Create a test file with content
    await writeFile(testFile, 'Original content');
  });

  afterEach(async () => {
    // Clean up all backup files for this test file
    try {
      const backups = await backupManager.listBackups(testFile);
      for (const backup of backups) {
        await unlink(join(testDir, backup));
      }
    } catch {
      // Ignore cleanup errors
    }
    // Clean up the main test file
    try {
      await unlink(testFile);
    } catch {
      // File may not exist, ignore
    }
    // Clean up the test directory if empty
    try {
      await unlink(testDir);
    } catch {
      // Directory may not be empty, ignore
    }
  });

  describe('createBackup', () => {
    it('should create a .bak file', async () => {
      const backupPath = await backupManager.createBackup(testFile);
      expect(backupPath).toBe(testFile + '.bak');
    });

    it('should copy original content to backup', async () => {
      await backupManager.createBackup(testFile);
      const backupContent = await (await import('fs/promises')).readFile(testFile + '.bak', 'utf-8');
      expect(backupContent).toBe('Original content');
    });

    it('should preserve file permissions', async () => {
      const backupPath = await backupManager.createBackup(testFile);
      const originalStats = await (await import('fs/promises')).stat(testFile);
      const backupStats = await (await import('fs/promises')).stat(backupPath);
      expect(backupStats.mode).toBe(originalStats.mode);
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore file from backup', async () => {
      // Create backup first
      await backupManager.createBackup(testFile);

      // Modify original file
      await writeFile(testFile, 'Modified content');

      // Restore from backup
      await backupManager.restoreFromBackup(testFile);

      // Verify content is restored
      const content = await (await import('fs/promises')).readFile(testFile, 'utf-8');
      expect(content).toBe('Original content');
    });

    it('should throw if backup does not exist', async () => {
      // Ensure no backup exists
      try {
        await unlink(testFile + '.bak');
      } catch {
        // Ignore if file doesn't exist
      }

      await expect(backupManager.restoreFromBackup(testFile)).rejects.toThrow();
    });
  });

  describe('listBackups', () => {
    it('should list all .bak files for the given file', async () => {
      // Create multiple backups with different naming patterns
      await backupManager.createBackup(testFile);
      await writeFile(testFile + '.bak.1', 'Backup 1');
      await writeFile(testFile + '.bak.2', 'Backup 2');

      const backups = await backupManager.listBackups(testFile);

      // Should include the main .bak file and the numbered backups
      expect(backups).toContain('test-file.txt.bak');
      expect(backups).toContain('test-file.txt.bak.1');
      expect(backups).toContain('test-file.txt.bak.2');
    });

    it('should return empty array when no backups exist', async () => {
      const backups = await backupManager.listBackups(testFile);
      expect(backups).toEqual([]);
    });

    it('should not include files from other directories', async () => {
      const otherDir = join(testDir, 'other');
      await mkdir(otherDir, { recursive: true });
      const otherFile = join(otherDir, 'other-file.txt');
      await writeFile(otherFile, 'Other content');
      await backupManager.createBackup(otherFile);

      const backups = await backupManager.listBackups(testFile);
      expect(backups).not.toContain('other-file.txt.bak');
    });
  });

  describe('cleanupOldBackups', () => {
    it('should keep the most recent N backups', async () => {
      // Create main backup
      await backupManager.createBackup(testFile);

      // Create additional numbered backups
      await writeFile(testFile + '.bak.1', 'Backup 1');
      await writeFile(testFile + '.bak.2', 'Backup 2');
      await writeFile(testFile + '.bak.3', 'Backup 3');
      await writeFile(testFile + '.bak.4', 'Backup 4');

      // Keep only 3 backups (main + 2 numbered)
      await backupManager.cleanupOldBackups(testFile, 3);

      const remaining = await backupManager.listBackups(testFile);
      expect(remaining.length).toBe(3);
      expect(remaining).toContain('test-file.txt.bak');
    });

    it('should not delete backups when count is within limit', async () => {
      await backupManager.createBackup(testFile);
      await writeFile(testFile + '.bak.1', 'Backup 1');

      await backupManager.cleanupOldBackups(testFile, 3);

      const remaining = await backupManager.listBackups(testFile);
      expect(remaining.length).toBe(2);
    });

    it('should handle default keepCount of 3', async () => {
      await backupManager.createBackup(testFile);
      await writeFile(testFile + '.bak.1', 'Backup 1');
      await writeFile(testFile + '.bak.2', 'Backup 2');
      await writeFile(testFile + '.bak.3', 'Backup 3');
      await writeFile(testFile + '.bak.4', 'Backup 4');

      await backupManager.cleanupOldBackups(testFile);

      const remaining = await backupManager.listBackups(testFile);
      expect(remaining.length).toBe(3);
    });
  });
});
