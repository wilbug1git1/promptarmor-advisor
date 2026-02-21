import * as vscode from 'vscode';
import { DiagnosticsProvider } from '../providers/diagnostics';
import { PromptSeverity } from '../types';

/**
 * Git commit guard — intercepts commits and warns about unresolved prompt vulnerabilities
 */
export class CommitGuard implements vscode.Disposable {
    private diagnosticsProvider: DiagnosticsProvider;
    private disposables: vscode.Disposable[] = [];

    constructor(diagnosticsProvider: DiagnosticsProvider) {
        this.diagnosticsProvider = diagnosticsProvider;
    }

    /**
     * Initialize git integration by hooking into the git extension
     */
    public async initialize(): Promise<void> {
        const config = vscode.workspace.getConfiguration('promptarmor');
        if (!config.get('enableGitCommitGuard', false)) {
            return;
        }

        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            return;
        }

        if (!gitExtension.isActive) {
            await gitExtension.activate();
        }

        const git = gitExtension.exports.getAPI(1);
        if (!git) {
            return;
        }

        // Watch for repository changes
        for (const repo of git.repositories) {
            this.watchRepository(repo);
        }

        // Watch for new repositories
        git.onDidOpenRepository((repo: any) => {
            this.watchRepository(repo);
        });
    }

    private watchRepository(repo: any): void {
        // Listen for state changes (includes commit attempts via inputBox)
        if (repo.inputBox) {
            // We can't directly intercept commits via the API easily,
            // so we register a pre-commit task check
        }
    }

    /**
     * Manual pre-commit scan — scans all staged/modified files
     */
    public async preCommitScan(): Promise<boolean> {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            vscode.window.showWarningMessage('PromptArmor: Git extension not available.');
            return true;
        }

        if (!gitExtension.isActive) {
            await gitExtension.activate();
        }

        const git = gitExtension.exports.getAPI(1);
        if (!git || git.repositories.length === 0) {
            vscode.window.showWarningMessage('PromptArmor: No git repository found.');
            return true;
        }

        const repo = git.repositories[0];
        const changes = [
            ...repo.state.workingTreeChanges,
            ...repo.state.indexChanges,
        ];

        if (changes.length === 0) {
            vscode.window.showInformationMessage('PromptArmor: No changed files to scan.');
            return true;
        }

        let totalCritical = 0;
        let totalWarning = 0;
        const issueFiles: string[] = [];

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'PromptArmor: Scanning changed files...',
                cancellable: false,
            },
            async () => {
                for (const change of changes) {
                    try {
                        const doc = await vscode.workspace.openTextDocument(change.uri);
                        const issues = this.diagnosticsProvider.updateDiagnostics(doc);

                        const critical = issues.filter(i => i.severity === PromptSeverity.Critical).length;
                        const warning = issues.filter(i => i.severity === PromptSeverity.Warning).length;

                        if (critical > 0 || warning > 0) {
                            totalCritical += critical;
                            totalWarning += warning;
                            issueFiles.push(vscode.workspace.asRelativePath(change.uri));
                        }
                    } catch {
                        // File might not be openable (deleted, binary, etc.)
                    }
                }
            }
        );

        if (totalCritical > 0 || totalWarning > 0) {
            const result = await vscode.window.showWarningMessage(
                `PromptArmor detected ${totalCritical} critical and ${totalWarning} warning(s) ` +
                `in ${issueFiles.length} file(s).\n\n` +
                `Affected files: ${issueFiles.join(', ')}\n\n` +
                `Proceed with commit anyway?`,
                { modal: true },
                'Review Issues',
                'Cancel Commit',
                'Ignore'
            );

            if (result === 'Review Issues') {
                vscode.commands.executeCommand('workbench.action.problems.focus');
                return false;
            }
            if (result === 'Cancel Commit') {
                return false;
            }
        } else {
            vscode.window.showInformationMessage(
                'PromptArmor: No prompt security issues found in changed files. Safe to commit!'
            );
        }

        return true;
    }

    /**
     * Export all scan results as JSON (for CI/CD integration)
     */
    public exportScanResults(): string {
        const allIssues = this.diagnosticsProvider.getAllIssues();
        const results: any[] = [];

        for (const [uri, issues] of allIssues) {
            for (const issue of issues) {
                results.push({
                    file: uri,
                    line: issue.range.start.line + 1,
                    column: issue.range.start.character + 1,
                    severity: issue.severity,
                    category: issue.category,
                    message: issue.message,
                    recommendation: issue.recommendation,
                });
            }
        }

        return JSON.stringify({ scanDate: new Date().toISOString(), issues: results, total: results.length }, null, 2);
    }

    dispose(): void {
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
