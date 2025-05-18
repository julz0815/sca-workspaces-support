"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
const logger_1 = require("./logger");
class LockGenerator {
    constructor(rootPath, options) {
        this.rootPath = path.resolve(rootPath);
        this.options = options;
    }
    async findWorkspacePackages(workspacePattern) {
        try {
            return await (0, glob_1.glob)(workspacePattern, { cwd: this.rootPath });
        }
        catch (error) {
            logger_1.logger.error(`Error finding workspace packages: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return [];
        }
    }
    readPackageJson(packagePath) {
        try {
            const content = fs.readFileSync(packagePath, 'utf8');
            return JSON.parse(content);
        }
        catch (error) {
            logger_1.logger.error(`Failed to read package.json at ${packagePath}: ${error}`);
            return null;
        }
    }
    readLockFile(lockFilePath) {
        try {
            const content = fs.readFileSync(lockFilePath, 'utf8');
            return JSON.parse(content);
        }
        catch (error) {
            logger_1.logger.error(`Failed to read lock file at ${lockFilePath}: ${error}`);
            return null;
        }
    }
    resolveDependencies(dependencies, lockFile) {
        const resolved = [];
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
            }
            else {
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
    generateLockFile(packageJson, rootPackageJson) {
        const newLockFile = {
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
    async generateWorkspaceLockFiles(workspacePatterns) {
        const results = [];
        // Read root package.json
        const rootPackageJsonPath = path.join(this.rootPath, 'package.json');
        if (!fs.existsSync(rootPackageJsonPath)) {
            logger_1.logger.error('No root package.json found');
            return results;
        }
        const rootPackageJson = this.readPackageJson(rootPackageJsonPath);
        if (!rootPackageJson) {
            logger_1.logger.error('Failed to read root package.json');
            return results;
        }
        for (const pattern of workspacePatterns) {
            try {
                const workspacePaths = await this.findWorkspacePackages(pattern);
                logger_1.logger.workspace(`Processing workspace pattern: ${pattern}`);
                for (const workspacePath of workspacePaths) {
                    // Use the full path directly since it's already absolute
                    const packageJsonPath = path.join(workspacePath, 'package.json');
                    logger_1.logger.info(`Checking package.json at: ${packageJsonPath}`);
                    if (!fs.existsSync(packageJsonPath)) {
                        logger_1.logger.warning(`No package.json found in ${workspacePath}`);
                        continue;
                    }
                    const packageJson = this.readPackageJson(packageJsonPath);
                    if (!packageJson) {
                        continue;
                    }
                    if (this.options.skipPrivate && packageJson.private) {
                        logger_1.logger.info(`Skipping private package: ${workspacePath}`);
                        continue;
                    }
                    const newLockFile = this.generateLockFile(packageJson, rootPackageJson);
                    const lockFilePath = path.join(workspacePath, 'package-lock.json');
                    if (fs.existsSync(lockFilePath) && !this.options.force) {
                        logger_1.logger.warning(`Lock file already exists at ${lockFilePath}. Use --force to overwrite.`);
                        continue;
                    }
                    fs.writeFileSync(lockFilePath, JSON.stringify(newLockFile, null, 2));
                    logger_1.logger.success(`Generated lock file for ${workspacePath}`);
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
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                logger_1.logger.error(`Error processing workspace pattern ${pattern}: ${errorMessage}`);
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
exports.LockGenerator = LockGenerator;
