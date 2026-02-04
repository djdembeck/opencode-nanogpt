import { Command } from 'commander';
import { BackupManager } from '../backup.js';
import { ConfigManager } from '../config-manager.js';
import { validateAfterWrite } from '../validation.js';
import { access } from 'fs/promises';

export const rollbackCommand = new Command('rollback')
  .description('Restore config from backup')
  .option('-l, --list', 'List available backups instead of restoring')
  .option('-n, --number <n>', 'Restore from the N-th most recent backup (default: 1)', '1')
  .action(async (options) => {
    const program = rollbackCommand.parent;
    if (!program) {
      console.error('Error: Unable to access parent command');
      process.exit(1);
    }

    const opts = program.opts();
    const configPath = opts.config as string;

    const backupManager = new BackupManager();
    const configManager = new ConfigManager();

    try {
      try {
        await access(configPath);
      } catch {
        console.error(`Error: Config file not found at ${configPath}`);
        process.exit(1);
      }

      if (options.list) {
        console.log(`Backups for ${configPath}:`);
        console.log('');

        const backups = await backupManager.listBackups(configPath);

        if (backups.length === 0) {
          console.log('  No backups found.');
          console.log('');
          console.log('Backups are created automatically before modifications.');
          console.log('Run "nanogpt-config init" or "nanogpt-config update-models" to create a backup.');
        } else {
          backups.forEach((backup, index) => {
            const marker = index === 0 ? ' (most recent)' : '';
            console.log(`  ${index + 1}. ${backup}${marker}`);
          });
        }

        process.exit(0);
      }

      const backups = await backupManager.listBackups(configPath);

      if (backups.length === 0) {
        console.error('Error: No backups found');
        console.error('Backups are created automatically before modifications.');
        process.exit(1);
      }

      const backupNumber = parseInt(options.number, 10);
      if (isNaN(backupNumber) || backupNumber < 1 || backupNumber > backups.length) {
        console.error(`Error: Invalid backup number. Available backups: 1-${backups.length}`);
        process.exit(1);
      }

      const backupToRestore = backups[backups.length - backupNumber];
      console.log(`Restoring from backup: ${backupToRestore}`);
      console.log(`Target: ${configPath}`);
      console.log('');

      console.log('Restoring...');
      await backupManager.restoreFromBackup(configPath);

      console.log('Validating restored configuration...');
      try {
        await validateAfterWrite(configManager, configPath);
        console.log('✓ Restored configuration is valid');
      } catch (error) {
        console.warn('⚠ Warning: Restored configuration has validation errors');
        console.warn(`  ${error instanceof Error ? error.message : error}`);
        console.warn('');
        console.warn('You may need to manually fix the configuration.');
      }

      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('  Rollback complete!');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`\nConfig restored from backup: ${backupToRestore}`);

    } catch (error) {
      console.error('Error during rollback:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
