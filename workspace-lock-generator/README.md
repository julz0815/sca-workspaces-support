# Workspace Lock Generator

A TypeScript application that generates individual package-lock.json files for JavaScript and TypeScript applications using workspaces. It supports different package managers (npm, yarn, pnpm) and their workspace configurations.

## Features

- Supports multiple package managers (npm, yarn, pnpm)
- Handles different workspace configurations
- Generates individual lock files for each workspace
- Resolves dependencies from the root lock file
- Provides detailed logging and dependency resolution reports
- Skips private packages (optional)
- Includes/excludes dev dependencies (optional)

## Installation

```bash
npm install -g workspace-lock-generator
```

## Usage

```bash
workspace-lock-generator -p <path> [options]
```

### Options

- `-p, --path <path>`: Path to the workspace root (required)
- `-v, --verbose`: Enable verbose logging
- `-f, --force`: Force overwrite existing lock files
- `-d, --dev`: Include dev dependencies
- `-s, --skip-private`: Skip private packages

### Example

```bash
workspace-lock-generator -p ./my-monorepo -v -d
```

## Supported Workspace Configurations

### npm

```json
{
  "workspaces": [
    "packages/*",
    "apps/*"
  ]
}
```

### Yarn

```json
{
  "workspaces": {
    "packages": [
      "packages/*",
      "apps/*"
    ]
  }
}
```

### pnpm

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

## Output

The tool provides detailed output about:

1. Workspace detection
2. Package manager identification
3. Lock file generation progress
4. Dependency resolution status
5. Summary of successful and failed operations

Example output:

```
ℹ Detected package manager: npm
ℹ Workspaces found: 3

📦 Processing workspace pattern: packages/*
✓ Generated lock file for packages/app1
✓ Generated lock file for packages/app2

Generation Summary:
✓ Successfully processed 2 workspaces

Dependency Resolution Summary:

packages/app1:
✓ Resolved: 15 dependencies
⚠ Unresolved: 1 dependencies
  - private-package@1.0.0: Dependency not found in lock file

packages/app2:
✓ Resolved: 12 dependencies
```

## Error Handling

The tool handles various error cases:

- Missing package.json files
- Invalid workspace configurations
- Unresolvable dependencies
- File system errors
- Invalid lock file formats

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

MIT 