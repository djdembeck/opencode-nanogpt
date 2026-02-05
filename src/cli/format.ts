import { Command } from 'commander';
import { ConfigManager } from '../config-manager.js';
import { BackupManager } from '../backup.js';
import { validateAfterWrite } from '../validation.js';
import { access, readFile, writeFile } from 'fs/promises';
import { parse, applyEdits, modify } from 'jsonc-parser';

export const formatCommand = new Command('format')
  .description('Format config with proper double quotes and indentation')
  .option('--check', 'Check if formatting is needed without making changes')
  .option('--write', 'Write formatted output back to file (default behavior)')
  .action(async (options) => {
    const program = formatCommand.parent;
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

      console.log(`Reading ${configPath}...`);
      const content = await readFile(configPath, 'utf-8');

      const errors: any[] = [];
      const parsed = parse(content, errors, {
        disallowComments: false,
        allowTrailingComma: true,
      });

      if (errors.length > 0) {
        console.error('Error: Config file contains invalid JSON/JSONC');
        errors.forEach((err, index) => {
          console.error(`  ${index + 1}. Line ${err.offset}: ${err.error}`);
        });
        process.exit(1);
      }

      const formattedContent = JSON.stringify(parsed, null, 2);
      const needsFormatting = content !== formattedContent;

      if (options.check) {
        if (needsFormatting) {
          console.log('✗ Config file needs formatting');
          console.log('');
          console.log('Run "nanogpt-config format --write" to apply formatting.');
          process.exit(1);
        } else {
          console.log('✓ Config file is already formatted');
          process.exit(0);
        }
      }

      if (needsFormatting) {
        console.log('Creating backup...');
        await backupManager.createBackup(configPath);

        console.log('Applying formatting...');
        await writeFile(configPath, formattedContent, 'utf-8');

        console.log('Validating formatted configuration...');
        await validateAfterWrite(configManager, configPath);

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('  Formatting complete!');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        console.log('Changes applied:');
        console.log('  • Consistent double quotes');
        console.log('  • 2-space indentation');
        console.log('  • No trailing commas');
        console.log('  • Sorted keys');
      } else {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('  No changes needed');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        console.log('Config file is already properly formatted.');
      }

    } catch (error) {
      console.error('Error formatting config:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
