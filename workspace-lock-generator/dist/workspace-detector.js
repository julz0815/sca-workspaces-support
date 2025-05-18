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
exports.WorkspaceDetector = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger_1 = require("./logger");
const glob_1 = require("glob");
class WorkspaceDetector {
    constructor(rootPath) {
        this.rootPath = path.resolve(rootPath);
    }
    detectPackageManager() {
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
    getLockFileName(packageManager) {
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
    getWorkspacesFromPackageJson(packageJson) {
        if (!packageJson.workspaces) {
            logger_1.logger.info('No workspaces field found in package.json');
            return [];
        }
        logger_1.logger.info(`Found workspaces in package.json: ${JSON.stringify(packageJson.workspaces)}`);
        if (Array.isArray(packageJson.workspaces)) {
            return packageJson.workspaces;
        }
        return packageJson.workspaces.packages || [];
    }
    getWorkspacesFromPnpm() {
        try {
            const workspaceYamlPath = path.join(this.rootPath, 'pnpm-workspace.yaml');
            logger_1.logger.info(`Reading pnpm workspace file: ${workspaceYamlPath}`);
            const workspaceYaml = fs.readFileSync(workspaceYamlPath, 'utf8');
            logger_1.logger.info(`Raw pnpm-workspace.yaml content:\n${workspaceYaml}`);
            const yaml = workspaceYaml
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('#'));
            logger_1.logger.info(`Parsed YAML lines: ${JSON.stringify(yaml)}`);
            const packagesIndex = yaml.findIndex(line => line === 'packages:');
            if (packagesIndex === -1) {
                logger_1.logger.error('No packages field found in pnpm-workspace.yaml');
                return [];
            }
            const workspaceGlobs = yaml
                .slice(packagesIndex + 1)
                .filter(line => line.startsWith('- '))
                .map(line => {
                const match = line.match(/- ['"](.*)['"]/);
                if (!match) {
                    logger_1.logger.info(`Could not parse workspace glob from line: ${line}`);
                    return null;
                }
                const glob = match[1];
                logger_1.logger.info(`Found workspace glob: ${glob}`);
                return glob;
            })
                .filter((glob) => glob !== null && !glob.startsWith('!'));
            logger_1.logger.info(`Found workspaces in pnpm-workspace.yaml: ${JSON.stringify(workspaceGlobs)}`);
            if (workspaceGlobs.length === 0) {
                logger_1.logger.error('No workspace globs found in pnpm-workspace.yaml');
                return [];
            }
            return this.resolveWorkspaceDirs(workspaceGlobs);
        }
        catch (error) {
            logger_1.logger.error(`Failed to read pnpm-workspace.yaml: ${error}`);
            return [];
        }
    }
    resolveWorkspaceDirs(workspaceGlobs) {
        logger_1.logger.info(`Root path: ${this.rootPath}`);
        logger_1.logger.info(`Resolving workspace globs: ${JSON.stringify(workspaceGlobs)}`);
        // Use glob to resolve all workspace directories
        const dirs = workspaceGlobs
            .map(pattern => {
            const fullPattern = path.join(this.rootPath, pattern);
            logger_1.logger.info(`Full pattern: ${fullPattern}`);
            const matches = glob_1.glob.sync(fullPattern, { absolute: true });
            logger_1.logger.info(`Pattern ${pattern} matched: ${JSON.stringify(matches)}`);
            return matches;
        })
            .flat();
        // Filter for those that contain a package.json
        const resolved = dirs.filter(dir => {
            const hasPackageJson = fs.existsSync(path.join(dir, 'package.json'));
            logger_1.logger.info(`Directory ${dir} has package.json: ${hasPackageJson}`);
            return hasPackageJson;
        });
        logger_1.logger.info(`Resolved workspace paths: ${JSON.stringify(resolved)}`);
        return resolved;
    }
    detectWorkspaceConfig() {
        const packageManager = this.detectPackageManager();
        const lockFileName = this.getLockFileName(packageManager);
        let workspaces = [];
        const packageJsonPath = path.join(this.rootPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const workspaceGlobs = this.getWorkspacesFromPackageJson(packageJson);
                workspaces = this.resolveWorkspaceDirs(workspaceGlobs);
            }
            catch (error) {
                logger_1.logger.error(`Failed to read package.json: ${error}`);
            }
        }
        if (packageManager === 'pnpm') {
            workspaces = this.getWorkspacesFromPnpm();
        }
        logger_1.logger.info(`Detected package manager: ${packageManager}`);
        logger_1.logger.info(`Workspaces found: ${workspaces.length}`);
        return {
            rootPath: this.rootPath,
            packageManager,
            workspaces,
            lockFileName
        };
    }
}
exports.WorkspaceDetector = WorkspaceDetector;
