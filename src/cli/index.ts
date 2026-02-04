#!/usr/bin/env node

import { Command, OptionValues } from 'commander';
import { ConfigManager } from '../config-manager.js';
import { BackupManager } from '../backup.js';
import { initCommand } from './init.js';
import { updateModelsCommand } from './update-models.js';
import { validateCommand } from './validate.js';
import { rollbackCommand } from './rollback.js';
import { formatCommand } from './format.js';

const program = new Command();

program
  .name('nanogpt-config')
  .description('CLI for managing NanoGPT OpenCode configuration')
  .version('1.0.0');

program
  .option('-c, --config <path>', 'Path to config file', '~/.config/opencode/opencode.json')
  .option('-k, --api-key <key>', 'NanoGPT API key')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.config && opts.config.startsWith('~')) {
      opts.config = opts.config.replace('~', process.env.HOME || process.env.USERPROFILE || '');
    }
  });

program.addCommand(initCommand);
program.addCommand(updateModelsCommand);
program.addCommand(validateCommand);
program.addCommand(rollbackCommand);
program.addCommand(formatCommand);

program.parse();
