import * as vscode from 'vscode';
import { PromptSeverity, PromptIssue } from '../types';
import { DiagnosticsProvider } from '../providers/diagnostics';

/**
 * Handles modal warnings for high-severity issues in aggressive mode
 */
export class ModalWarningManager {
    private diagnosticsProvider: DiagnosticsProvider;
    private suppressedUris: Set<string> = new Set();
    private reminderInterval: ReturnType<typeof setInterval> | undefined;

    constructor(diagnosticsProvider: DiagnosticsProvider) {
        this.diagnosticsProvider = diagnosticsProvider;
    }

    /**
     * Check issues and show modal if appropriate (called on save)
     */
    public async checkAndWarn(document: vscode.TextDocument): Promise<void> {
        const config = vscode.workspace.getConfiguration('promptarmor');
        const aggressiveness = config.get<string>('aggressiveness', 'default');

        // Only show modals in high aggressiveness
        if (aggressiveness !== 'high') {
            return;
        }

        const uriStr = document.uri.toString();

        // Don't re-show if user suppressed for this file/session
        if (this.suppressedUris.has(uriStr)) {
            return;
        }

        const issues = this.diagnosticsProvider.getIssues(document.uri);
        const criticalIssues = issues.filter(i => i.severity === PromptSeverity.Critical);

        if (criticalIssues.length === 0) {
            return;
        }

        const result = await vscode.window.showWarningMessage(
            `⚠️ PromptArmor: ${criticalIssues.length} Critical Prompt Vulnerability(ies) Detected!\n` +
            `This could allow injection attacks or data exposure.\n` +
            `Review in Problems panel or apply quick fixes.`,
            { modal: true },
            'Fix Now',
            'Ignore Once',
            'Configure'
        );

        switch (result) {
            case 'Fix Now':
                // Focus on the first critical issue
                if (criticalIssues[0]) {
                    const editor = await vscode.window.showTextDocument(document);
                    editor.selection = new vscode.Selection(
                        criticalIssues[0].range.start,
                        criticalIssues[0].range.end
                    );
                    editor.revealRange(
                        criticalIssues[0].range,
                        vscode.TextEditorRevealType.InCenter
                    );
                    // Trigger code actions
                    await vscode.commands.executeCommand(
                        'editor.action.quickFix',
                        document.uri,
                        criticalIssues[0].range
                    );
                }
                break;
            case 'Ignore Once':
                this.suppressedUris.add(uriStr);
                break;
            case 'Configure':
                vscode.commands.executeCommand('promptarmor.configure');
                break;
        }
    }

    /**
     * Start periodic reminder for unresolved issues (high aggressiveness)
     */
    public startReminders(): void {
        const config = vscode.workspace.getConfiguration('promptarmor');
        const aggressiveness = config.get<string>('aggressiveness', 'default');

        if (aggressiveness !== 'high') {
            this.stopReminders();
            return;
        }

        // Remind every 5 minutes
        this.reminderInterval = setInterval(() => {
            const counts = this.diagnosticsProvider.getIssueCounts();
            if (counts.critical > 0 || counts.warning > 0) {
                vscode.window.showWarningMessage(
                    `PromptArmor: ${counts.critical + counts.warning} unresolved prompt security issue(s). Scan and fix before commit!`,
                    'Open Problems',
                    'Snooze'
                ).then(choice => {
                    if (choice === 'Open Problems') {
                        vscode.commands.executeCommand('workbench.action.problems.focus');
                    }
                });
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Stop periodic reminders
     */
    public stopReminders(): void {
        if (this.reminderInterval) {
            clearInterval(this.reminderInterval);
            this.reminderInterval = undefined;
        }
    }

    /**
     * Clear all suppressions
     */
    public clearSuppressions(): void {
        this.suppressedUris.clear();
    }

    dispose(): void {
        this.stopReminders();
    }
}
