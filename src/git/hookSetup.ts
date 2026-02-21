import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Sets up git hooks (Husky / pre-commit) for PromptArmor integration
 */
export class HookSetup {
    /**
     * Interactive setup of git hooks in the workspace
     */
    public async setup(): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('PromptArmor: No workspace folder found.');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;

        // Detect project type
        const hasPackageJson = fs.existsSync(path.join(rootPath, 'package.json'));
        const hasPyproject = fs.existsSync(path.join(rootPath, 'pyproject.toml'));
        const hasRequirements = fs.existsSync(path.join(rootPath, 'requirements.txt'));
        const hasGit = fs.existsSync(path.join(rootPath, '.git'));

        if (!hasGit) {
            vscode.window.showErrorMessage('PromptArmor: No git repository found. Initialize git first.');
            return;
        }

        const options: string[] = [];
        if (hasPackageJson) {
            options.push('Husky (Node.js pre-commit hook)');
        }
        if (hasPyproject || hasRequirements) {
            options.push('pre-commit (Python framework)');
        }
        options.push('Raw git hook (shell script)');

        const choice = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select git hook setup method',
            title: 'PromptArmor: Setup Git Hooks',
        });

        if (!choice) { return; }

        switch (choice) {
            case 'Husky (Node.js pre-commit hook)':
                await this.setupHusky(rootPath);
                break;
            case 'pre-commit (Python framework)':
                await this.setupPreCommitPython(rootPath);
                break;
            case 'Raw git hook (shell script)':
                await this.setupRawHook(rootPath);
                break;
        }
    }

    private async setupHusky(rootPath: string): Promise<void> {
        const huskyDir = path.join(rootPath, '.husky');

        if (!fs.existsSync(huskyDir)) {
            fs.mkdirSync(huskyDir, { recursive: true });
        }

        const preCommitPath = path.join(huskyDir, 'pre-commit');
        const hookContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "🛡️ PromptArmor: Scanning for prompt security issues..."

# Run PromptArmor pre-commit scan
# This checks staged files for prompt vulnerabilities
# Exit with non-zero to block commit if critical issues found

# Option 1: Use VS Code task (if VS Code is running)
# code --command promptarmor.gitPreCommitScan

# Option 2: Grep-based fallback scan for common issues
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\\.(js|ts|py|jsx|tsx)$')

if [ -z "$STAGED_FILES" ]; then
    echo "PromptArmor: No relevant files staged."
    exit 0
fi

ISSUES=0
for FILE in $STAGED_FILES; do
    # Check for direct user input concatenation into system prompts
    if grep -qiE 'system[_\\s]*prompt.*\\+.*user[_\\s]*input|system[_\\s]*message.*\\+.*req\\.body' "$FILE" 2>/dev/null; then
        echo "⚠️  CRITICAL: $FILE - User input concatenated into system prompt!"
        ISSUES=$((ISSUES + 1))
    fi
    # Check for LLM API calls without rate limiting patterns nearby
    if grep -qiE 'openai\\.|anthropic\\.' "$FILE" 2>/dev/null; then
        if ! grep -qiE 'rate.?limit|throttle|RateLimiter' "$FILE" 2>/dev/null; then
            echo "⚠️  WARNING: $FILE - LLM API call without rate limiting"
        fi
    fi
done

if [ $ISSUES -gt 0 ]; then
    echo ""
    echo "🛡️ PromptArmor: $ISSUES critical issue(s) found! Fix before committing."
    echo "   Run 'PromptArmor: Scan' in VS Code for details and quick fixes."
    exit 1
fi

echo "✅ PromptArmor: No critical prompt vulnerabilities found."
exit 0
`;

        fs.writeFileSync(preCommitPath, hookContent, { mode: 0o755 });

        vscode.window.showInformationMessage(
            'PromptArmor: Husky pre-commit hook created! Run `npx husky install` to activate.',
            'Open Terminal'
        ).then(choice => {
            if (choice === 'Open Terminal') {
                const terminal = vscode.window.createTerminal('PromptArmor Setup');
                terminal.show();
                terminal.sendText('npm install husky --save-dev && npx husky install');
            }
        });
    }

    private async setupPreCommitPython(rootPath: string): Promise<void> {
        const configPath = path.join(rootPath, '.pre-commit-config.yaml');

        const yamlContent = `# PromptArmor pre-commit configuration
repos:
  - repo: local
    hooks:
      - id: promptarmor
        name: PromptArmor Advisor
        entry: python -c "
import re, sys, glob

issues = 0
for pattern in ['**/*.py', '**/*.js', '**/*.ts']:
    for filepath in glob.glob(pattern, recursive=True):
        try:
            with open(filepath, 'r') as f:
                content = f.read()
            # Check for user input in system prompts
            if re.search(r'system[_\\s]*prompt.*\\+.*user', content, re.IGNORECASE):
                print(f'CRITICAL: {filepath} - User input in system prompt!')
                issues += 1
            # Check for missing rate limiting
            if re.search(r'openai\\.|anthropic\\.', content, re.IGNORECASE):
                if not re.search(r'rate.?limit|throttle', content, re.IGNORECASE):
                    print(f'WARNING: {filepath} - LLM API without rate limiting')
        except:
            pass

if issues > 0:
    print(f'PromptArmor: {issues} critical issue(s). Fix before committing.')
    sys.exit(1)
print('PromptArmor: No critical issues found.')
"
        language: python
        types: [python, javascript, ts]
        pass_filenames: false
`;

        fs.writeFileSync(configPath, yamlContent);

        vscode.window.showInformationMessage(
            'PromptArmor: .pre-commit-config.yaml created! Run `pre-commit install` to activate.',
            'Open Terminal'
        ).then(choice => {
            if (choice === 'Open Terminal') {
                const terminal = vscode.window.createTerminal('PromptArmor Setup');
                terminal.show();
                terminal.sendText('pip install pre-commit && pre-commit install');
            }
        });
    }

    private async setupRawHook(rootPath: string): Promise<void> {
        const hooksDir = path.join(rootPath, '.git', 'hooks');
        const preCommitPath = path.join(hooksDir, 'pre-commit');

        const hookContent = `#!/bin/sh
# PromptArmor: Pre-commit security check for prompt-based code
echo "🛡️ PromptArmor: Scanning staged files..."

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\\.(js|ts|py|jsx|tsx)$')

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

ISSUES=0
for FILE in $STAGED_FILES; do
    if grep -qiE 'system[_\\s]*prompt.*\\+.*user[_\\s]*input|system[_\\s]*message.*\\+.*req\\.body' "$FILE" 2>/dev/null; then
        echo "⚠️  CRITICAL: $FILE - User input concatenated into system prompt!"
        ISSUES=$((ISSUES + 1))
    fi
done

if [ $ISSUES -gt 0 ]; then
    echo "🛡️ PromptArmor: $ISSUES critical issue(s) found! Fix before committing."
    exit 1
fi

echo "✅ PromptArmor: Clean."
exit 0
`;

        fs.writeFileSync(preCommitPath, hookContent, { mode: 0o755 });

        vscode.window.showInformationMessage('PromptArmor: Git pre-commit hook installed successfully!');
    }
}
