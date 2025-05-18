import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { PackageJson, LockFile, ResolvedDependency, WorkspaceResult, GeneratorOptions } from './types';
import { logger } from './logger';

export class LockGenerator {
  private rootPath: string;
  private options: GeneratorOptions;

  constructor(rootPath: string, options: GeneratorOptions) {
    this.rootPath = path.resolve(rootPath);
    this.options = options;
  }

  private async findWorkspacePackages(workspacePattern: string): Promise<string[]> {
    try {
      return await glob(workspacePattern, { cwd: this.rootPath });
    } catch (error) {
      logger.error(`Error finding workspace packages: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  private readPackageJson(packagePath: string): PackageJson | null {
    try {
      const content = fs.readFileSync(packagePath, 'utf8');
      return JSON.parse(content) as PackageJson;
    } catch (error) {
      logger.error(`Failed to read package.json at ${packagePath}: ${error}`);
      return null;
    }
  }

  private readLockFile(lockFilePath: string): LockFile | null {
    try {
      const content = fs.readFileSync(lockFilePath, 'utf8');
      return JSON.parse(content) as LockFile;
    } catch (error) {
      logger.error(`Failed to read lock file at ${lockFilePath}: ${error}`);
      return null;
    }
  }

  private resolveDependencies(
    dependencies: Record<string, string>,
    lockFile: LockFile
  ): ResolvedDependency[] {
    const resolved: ResolvedDependency[] = [];

    for (const [name, version] of Object.entries(dependencies)) {
      const packageKey = `node_modules/${name}`;
      const entry = lockFile.packages[packageKey];

      if (entry) {
        resolved.push({
          name,
          version,
          resolved: true
        });

        // Recursively resolve nested dependencies
        if (entry.dependencies) {
          resolved.push(...this.resolveDependencies(entry.dependencies, lockFile));
        }
      } else {
        resolved.push({
          name,
          version,
          resolved: false,
          error: `Dependency not found in lock file: ${packageKey}`
        });
      }
    }

    return resolved;
  }

  private generateLockFile(
    packageJson: PackageJson,
    rootPackageJson: PackageJson
  ): LockFile {
    const newLockFile: LockFile = {
      name: packageJson.name,
      version: packageJson.version,
      lockfileVersion: 3,
      requires: true,
      packages: {
        "": {
          name: packageJson.name,
          version: packageJson.version,
          dependencies: {
            ...rootPackageJson.dependencies,
            ...rootPackageJson.devDependencies,
            ...packageJson.dependencies,
            ...(this.options.includeDevDependencies ? packageJson.devDependencies : {})
          }
        }
      }
    };

    // Add each dependency to the packages section
    const allDependencies = {
      ...rootPackageJson.dependencies,
      ...rootPackageJson.devDependencies,
      ...packageJson.dependencies,
      ...(this.options.includeDevDependencies ? packageJson.devDependencies : {})
    };

    for (const [name, version] of Object.entries(allDependencies)) {
      const packageKey = `node_modules/${name}`;
      newLockFile.packages[packageKey] = {
        version: version.replace(/^\^|~/, ''),
        resolved: `https://registry.npmjs.org/${name}/-/${name}-${version.replace(/^\^|~/, '')}.tgz`,
        integrity: `sha512-${Buffer.from(name + version).toString('base64')}`, // Placeholder integrity
        dependencies: {}
      };
    }

    return newLockFile;
  }

  public async generateWorkspaceLockFiles(
    workspacePatterns: string[]
  ): Promise<WorkspaceResult[]> {
    const results: WorkspaceResult[] = [];
    
    // Read root package.json
    const rootPackageJsonPath = path.join(this.rootPath, 'package.json');
    
    if (!fs.existsSync(rootPackageJsonPath)) {
      logger.error('No root package.json found');
      return results;
    }
    
    const rootPackageJson = this.readPackageJson(rootPackageJsonPath);
    if (!rootPackageJson) {
      logger.error('Failed to read root package.json');
      return results;
    }

    for (const pattern of workspacePatterns) {
      try {
        const workspacePaths = await this.findWorkspacePackages(pattern);
        logger.workspace(`Processing workspace pattern: ${pattern}`);

        for (const workspacePath of workspacePaths) {
          // Use the full path directly since it's already absolute
          const packageJsonPath = path.join(workspacePath, 'package.json');
          logger.info(`Checking package.json at: ${packageJsonPath}`);

          if (!fs.existsSync(packageJsonPath)) {
            logger.warning(`No package.json found in ${workspacePath}`);
            continue;
          }

          const packageJson = this.readPackageJson(packageJsonPath);
          if (!packageJson) {
            continue;
          }

          if (this.options.skipPrivate && packageJson.private) {
            logger.info(`Skipping private package: ${workspacePath}`);
            continue;
          }

          const newLockFile = this.generateLockFile(packageJson, rootPackageJson);
          const lockFilePath = path.join(workspacePath, 'package-lock.json');

          if (fs.existsSync(lockFilePath) && !this.options.force) {
            logger.warning(
              `Lock file already exists at ${lockFilePath}. Use --force to overwrite.`
            );
            continue;
          }

          fs.writeFileSync(lockFilePath, JSON.stringify(newLockFile, null, 2));
          logger.success(`Generated lock file for ${workspacePath}`);

          results.push({
            workspacePath,
            success: true,
            dependencies: Object.entries({
              ...rootPackageJson.dependencies,
              ...rootPackageJson.devDependencies,
              ...packageJson.dependencies,
              ...(this.options.includeDevDependencies
                ? packageJson.devDependencies
                : {})
            }).map(([name, version]) => ({
              name,
              version,
              resolved: true
            }))
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Error processing workspace pattern ${pattern}: ${errorMessage}`);
        results.push({
          workspacePath: pattern,
          success: false,
          dependencies: [],
          error: errorMessage
        });
      }
    }

    return results;
  }
} 