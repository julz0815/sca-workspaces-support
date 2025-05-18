import { Command } from 'commander';
import { WorkspaceDetector } from './workspace-detector';
import { LockGenerator } from './lock-generator';
import { logger } from './logger';
import { GeneratorOptions } from './types';

const program = new Command();

program
  .name('workspace-lock-generator')
  .description('Generate individual package-lock.json files for JavaScript and TypeScript applications using workspaces')
  .version('1.0.0')
  .requiredOption('-p, --path <path>', 'path to the workspace root')
  .option('-v, --verbose', 'enable verbose logging')
  .option('-f, --force', 'force overwrite existing lock files')
  .option('-d, --dev', 'include dev dependencies')
  .option('-s, --skip-private', 'skip private packages')
  .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    // Set up logging
    logger.setVerbose(options.verbose);

    // Detect workspace configuration
    const detector = new WorkspaceDetector(options.path);
    const config = detector.detectWorkspaceConfig();

    if (config.workspaces.length === 0) {
      logger.error('No workspaces found in the project');
      process.exit(1);
    }

    // Generate lock files
    const generator = new LockGenerator(options.path, {
      verbose: options.verbose,
      force: options.force,
      includeDevDependencies: options.dev,
      skipPrivate: options.skipPrivate
    });

    const results = await generator.generateWorkspaceLockFiles(config.workspaces);

    // Print summary
    logger.info('\nGeneration Summary:');
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    logger.success(`Successfully processed ${successful.length} workspaces`);
    if (failed.length > 0) {
      logger.error(`Failed to process ${failed.length} workspaces:`);
      failed.forEach(result => {
        logger.error(`  - ${result.workspacePath}: ${result.error}`);
      });
    }

    // Print dependency resolution summary
    logger.info('\nDependency Resolution Summary:');
    results.forEach(result => {
      if (result.success) {
        const resolved = result.dependencies.filter(d => d.resolved);
        const unresolved = result.dependencies.filter(d => !d.resolved);

        logger.workspace(`\n${result.workspacePath}:`);
        logger.success(`  Resolved: ${resolved.length} dependencies`);
        if (unresolved.length > 0) {
          logger.warning(`  Unresolved: ${unresolved.length} dependencies`);
          unresolved.forEach(dep => {
            logger.warning(`    - ${dep.name}@${dep.version}: ${dep.error}`);
          });
        }
      }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Fatal error: ${errorMessage}`);
    process.exit(1);
  }
}

main(); 