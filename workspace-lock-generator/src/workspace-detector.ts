import * as fs from 'fs';
import * as path from 'path';
import { PackageJson, WorkspaceConfig } from './types';
import { logger } from './logger';
import { glob } from 'glob';

export class WorkspaceDetector {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath);
  }

  private detectPackageManager(): 'npm' | 'yarn' | 'pnpm' {
    if (fs.existsSync(path.join(this.rootPath, 'pnpm-workspace.yaml'))) {
      return 'pnpm';
    }
    if (fs.existsSync(path.join(this.rootPath, 'yarn.lock'))) {
      return 'yarn';
    }
    if (fs.existsSync(path.join(this.rootPath, 'package-lock.json'))) {
      return 'npm';
    }
    return 'npm'; // Default to npm if no lock file is found
  }

  private getLockFileName(packageManager: 'npm' | 'yarn' | 'pnpm'): string {
    switch (packageManager) {
      case 'yarn':
        return 'yarn.lock';
      case 'pnpm':
        return 'pnpm-lock.yaml';
      case 'npm':
      default:
        return 'package-lock.json';
    }
  }

  private getWorkspacesFromPackageJson(packageJson: PackageJson): string[] {
    if (!packageJson.workspaces) {
      logger.info('No workspaces field found in package.json');
      return [];
    }

    logger.info(`Found workspaces in package.json: ${JSON.stringify(packageJson.workspaces)}`);

    if (Array.isArray(packageJson.workspaces)) {
      return packageJson.workspaces;
    }

    return packageJson.workspaces.packages || [];
  }

  private getWorkspacesFromPnpm(): string[] {
    try {
      const workspaceYamlPath = path.join(this.rootPath, 'pnpm-workspace.yaml');
      logger.info(`Reading pnpm workspace file: ${workspaceYamlPath}`);
      
      const workspaceYaml = fs.readFileSync(workspaceYamlPath, 'utf8');
      logger.info(`Raw pnpm-workspace.yaml content:\n${workspaceYaml}`);

      const yaml = workspaceYaml
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

      logger.info(`Parsed YAML lines: ${JSON.stringify(yaml)}`);

      const packagesIndex = yaml.findIndex(line => line === 'packages:');
      if (packagesIndex === -1) {
        logger.error('No packages field found in pnpm-workspace.yaml');
        return [];
      }

      const workspaceGlobs = yaml
        .slice(packagesIndex + 1)
        .filter(line => line.startsWith('- '))
        .map(line => {
          const match = line.match(/- ['"](.*)['"]/);
          if (!match) {
            logger.info(`Could not parse workspace glob from line: ${line}`);
            return null;
          }
          const glob = match[1];
          logger.info(`Found workspace glob: ${glob}`);
          return glob;
        })
        .filter((glob): glob is string => glob !== null && !glob.startsWith('!'));

      logger.info(`Found workspaces in pnpm-workspace.yaml: ${JSON.stringify(workspaceGlobs)}`);
      
      if (workspaceGlobs.length === 0) {
        logger.error('No workspace globs found in pnpm-workspace.yaml');
        return [];
      }

      return this.resolveWorkspaceDirs(workspaceGlobs);
    } catch (error) {
      logger.error(`Failed to read pnpm-workspace.yaml: ${error}`);
      return [];
    }
  }

  private resolveWorkspaceDirs(workspaceGlobs: string[]): string[] {
    logger.info(`Root path: ${this.rootPath}`);
    logger.info(`Resolving workspace globs: ${JSON.stringify(workspaceGlobs)}`);
    // Use glob to resolve all workspace directories
    const dirs = workspaceGlobs
      .map(pattern => {
        const fullPattern = path.join(this.rootPath, pattern);
        logger.info(`Full pattern: ${fullPattern}`);
        const matches = glob.sync(fullPattern, { absolute: true });
        logger.info(`Pattern ${pattern} matched: ${JSON.stringify(matches)}`);
        return matches;
      })
      .flat();
    // Filter for those that contain a package.json
    const resolved = dirs.filter(dir => {
      const hasPackageJson = fs.existsSync(path.join(dir, 'package.json'));
      logger.info(`Directory ${dir} has package.json: ${hasPackageJson}`);
      return hasPackageJson;
    });
    logger.info(`Resolved workspace paths: ${JSON.stringify(resolved)}`);
    return resolved;
  }

  public detectWorkspaceConfig(): WorkspaceConfig {
    const packageManager = this.detectPackageManager();
    const lockFileName = this.getLockFileName(packageManager);

    let workspaces: string[] = [];
    const packageJsonPath = path.join(this.rootPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf8')
        ) as PackageJson;
        const workspaceGlobs = this.getWorkspacesFromPackageJson(packageJson);
        workspaces = this.resolveWorkspaceDirs(workspaceGlobs);
      } catch (error) {
        logger.error(`Failed to read package.json: ${error}`);
      }
    }

    if (packageManager === 'pnpm') {
      workspaces = this.getWorkspacesFromPnpm();
    }

    logger.info(`Detected package manager: ${packageManager}`);
    logger.info(`Workspaces found: ${workspaces.length}`);

    return {
      rootPath: this.rootPath,
      packageManager,
      workspaces,
      lockFileName
    };
  }
} 