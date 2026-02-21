import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Manages .promptarmorignore file and configuration utilities
 */
export class ConfigManager {
    private ignorePatterns: string[] = [];

    constructor() {
        this.loadIgnoreFile();
    }

    /**
     * Load patterns from .promptarmorignore file in workspace root
     */
    public loadIgnoreFile(): void {
        this.ignorePatterns = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) { return; }

        for (const folder of workspaceFolders) {
            const ignoreFilePath = path.join(folder.uri.fsPath, '.promptarmorignore');
            if (fs.existsSync(ignoreFilePath)) {
                const content = fs.readFileSync(ignoreFilePath, 'utf-8');
                const patterns = content
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                this.ignorePatterns.push(...patterns);
            }
        }
    }

    /**
     * Check if a file should be ignored based on .promptarmorignore patterns
     */
    public shouldIgnore(filePath: string): boolean {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) { return false; }

        const relativePath = vscode.workspace.asRelativePath(filePath);

        for (const pattern of this.ignorePatterns) {
            if (this.matchGlob(relativePath, pattern)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Simple glob matching (supports *, **, and ?)
     */
    private matchGlob(filePath: string, pattern: string): boolean {
        // Normalize separators
        const normalizedPath = filePath.replace(/\\/g, '/');
        const normalizedPattern = pattern.replace(/\\/g, '/');

        // Convert glob to regex
        let regexStr = normalizedPattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '{{DOUBLESTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]')
            .replace(/\{\{DOUBLESTAR\}\}/g, '.*');

        // If pattern starts with / or doesn't contain /, match from root
        if (!normalizedPattern.includes('/')) {
            regexStr = `(^|/)${regexStr}($|/)`;
        } else {
            regexStr = `^${regexStr}`;
        }

        try {
            return new RegExp(regexStr).test(normalizedPath);
        } catch {
            return false;
        }
    }

    /**
     * Get current aggressiveness level
     */
    public getAggressiveness(): 'low' | 'default' | 'high' {
        return vscode.workspace
            .getConfiguration('promptarmor')
            .get('aggressiveness', 'default') as 'low' | 'default' | 'high';
    }

    /**
     * Cycle aggressiveness level
     */
    public async toggleAggressiveness(): Promise<void> {
        const current = this.getAggressiveness();
        const levels: Array<'low' | 'default' | 'high'> = ['low', 'default', 'high'];
        const currentIdx = levels.indexOf(current);
        const next = levels[(currentIdx + 1) % levels.length];

        await vscode.workspace
            .getConfiguration('promptarmor')
            .update('aggressiveness', next, vscode.ConfigurationTarget.Workspace);

        vscode.window.showInformationMessage(`PromptArmor aggressiveness set to: ${next}`);
    }
}
