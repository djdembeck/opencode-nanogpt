import { Command } from 'commander';
import { ConfigManager } from '../config-manager.js';
import { validateBeforeWrite, validateAfterWrite, safeValidateConfig } from '../validation.js';
import { access, readFile } from 'fs/promises';
import { parse } from 'jsonc-parser';

export const validateCommand = new Command('validate')
  .description('Validate config file syntax')
  .option('--strict', 'Enable strict validation (fail on warnings)')
  .option('--json', 'Output results as JSON')
  .action(async (options) => {
    const program = validateCommand.parent;
    if (!program) {
      console.error('Error: Unable to access parent command');
      process.exit(1);
    }

    const opts = program.opts();
    const configPath = opts.config as string;

    const configManager = new ConfigManager();

    const result: {
      valid: boolean;
      filePath: string;
      errors: string[];
      warnings: string[];
    } = {
      valid: true,
      filePath: configPath,
      errors: [],
      warnings: [],
    };

    try {
      let fileExists = true;
      try {
        await access(configPath);
      } catch {
        fileExists = false;
      }

      if (!fileExists) {
        result.valid = false;
        result.errors.push(`Config file not found: ${configPath}`);
        outputResult(result, options.json);
        process.exit(1);
      }

      const content = await readFile(configPath, 'utf-8');

      const parseErrors: any[] = [];
      const parsed = parse(content, parseErrors, {
        disallowComments: false,
        allowTrailingComma: true,
      });

      if (parseErrors.length > 0) {
        result.valid = false;
        parseErrors.forEach((err) => {
          result.errors.push(`Parse error at offset ${err.offset}: ${err.error}`);
        });
        outputResult(result, options.json);
        process.exit(1);
      }

      const validationResult = safeValidateConfig(parsed);

      if (!validationResult.success) {
        result.valid = false;
        validationResult.error.issues.forEach((err) => {
          const path = err.path.length > 0 ? err.path.join('.') : 'root';
          result.errors.push(`${path}: ${err.message}`);
        });
      }

      if (options.strict && result.warnings.length > 0) {
        result.valid = false;
      }

      outputResult(result, options.json);

      if (result.valid) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
      outputResult(result, options.json);
      process.exit(1);
    }
  });

function outputResult(
  result: {
    valid: boolean;
    filePath: string;
    errors: string[];
    warnings: string[];
  },
  asJson: boolean
): void {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  if (result.valid) {
    console.log('  ✓ Configuration is valid');
  } else {
    console.log('  ✗ Configuration has errors');
  }
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log(`File: ${result.filePath}`);
  console.log('');

  if (result.errors.length > 0) {
    console.log('Errors:');
    result.errors.forEach((err, index) => {
      console.log(`  ${index + 1}. ${err}`);
    });
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log('Warnings:');
    result.warnings.forEach((warn, index) => {
      console.log(`  ${index + 1}. ${warn}`);
    });
    console.log('');
  }

  if (result.valid && result.errors.length === 0 && result.warnings.length === 0) {
    console.log('No issues found!');
    console.log('');
  }
}
