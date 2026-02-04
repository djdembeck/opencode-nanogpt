import { Command } from 'commander';
import { ConfigManager } from '../config-manager.js';
import { BackupManager } from '../backup.js';
import { ensureNanogptProvider } from '../providers/nanogpt.js';
import { validateAfterWrite } from '../validation.js';
import { access } from 'fs/promises';

export const updateModelsCommand = new Command('update-models')
  .description('Update models from NanoGPT API (placeholder for API integration)')
  .option('-f, --force', 'Force update even if no changes detected')
  .action(async (options) => {
    const program = updateModelsCommand.parent;
    if (!program) {
      console.error('Error: Unable to access parent command');
      process.exit(1);
    }

    const opts = program.opts();
    const configPath = opts.config as string;

    const configManager = new ConfigManager();
    const backupManager = new BackupManager();

    try {
      try {
        await access(configPath);
      } catch {
        console.error(`Error: Config file not found at ${configPath}`);
        console.error('Run "nanogpt-config init" first to create a configuration file.');
        process.exit(1);
      }

      console.log('Creating backup...');
      await backupManager.createBackup(configPath);

      console.log('Ensuring nanogpt provider...');
      await ensureNanogptProvider(configManager, configPath);

      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('  NOTE: API integration coming in Task 7');
      console.log('  Currently only ensures provider structure exists');
      console.log('═══════════════════════════════════════════════════════');
      console.log('');

      console.log('Fetching models from NanoGPT API...');
      console.log('  (Placeholder - actual API integration pending)');

      console.log('Validating configuration...');
      await validateAfterWrite(configManager, configPath);

      console.log('\n✓ Models updated successfully!');
      console.log(`  Config file: ${configPath}`);
      console.log('\nTo view available models, check your config file or use OpenCode.');
    } catch (error) {
      console.error('Error updating models:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
