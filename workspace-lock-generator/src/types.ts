export interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
  private?: boolean;
}

export interface LockFileEntry {
  version: string;
  resolved?: string;
  integrity?: string;
  dependencies?: Record<string, string>;
  name?: string;
}

export interface LockFile {
  name: string;
  version: string;
  lockfileVersion: number;
  requires: boolean;
  packages: {
    [key: string]: LockFileEntry;
  };
}

export interface WorkspaceConfig {
  rootPath: string;
  packageManager: 'npm' | 'yarn' | 'pnpm';
  workspaces: string[];
  lockFileName: string;
}

export interface ResolvedDependency {
  name: string;
  version: string;
  resolved: boolean;
  error?: string;
}

export interface WorkspaceResult {
  workspacePath: string;
  success: boolean;
  dependencies: ResolvedDependency[];
  error?: string;
}

export interface GeneratorOptions {
  verbose: boolean;
  force: boolean;
  includeDevDependencies: boolean;
  skipPrivate: boolean;
} 