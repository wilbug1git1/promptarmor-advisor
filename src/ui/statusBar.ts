import * as vscode from 'vscode';
import { DiagnosticsProvider } from '../providers/diagnostics';
import { PromptSeverity } from '../types';

/**
 * Manages the status bar item showing PromptArmor scan status
 */
export class StatusBarManager implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private diagnosticsProvider: DiagnosticsProvider;
    private blinkInterval: ReturnType<typeof setInterval> | undefined;
    private isBlinkOn = true;

    constructor(diagnosticsProvider: DiagnosticsProvider) {
        this.diagnosticsProvider = diagnosticsProvider;
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.statusBarItem.command = 'promptarmor.scan';
        this.statusBarItem.tooltip = 'PromptArmor Advisor - Click to scan';
        this.update();
        this.statusBarItem.show();
    }

    /**
     * Update the status bar with current issue counts
     */
    public update(): void {
        const counts = this.diagnosticsProvider.getIssueCounts();
        const total = counts.info + counts.warning + counts.critical;

        // Stop any existing blink
        this.stopBlink();

        if (total === 0) {
            this.statusBarItem.text = '$(shield) PromptArmor: Clean';
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.tooltip = 'PromptArmor Advisor - No issues detected';
        } else {
            const parts: string[] = [];
            if (counts.critical > 0) {
                parts.push(`${counts.critical} critical`);
            }
            if (counts.warning > 0) {
                parts.push(`${counts.warning} warnings`);
            }
            if (counts.info > 0) {
                parts.push(`${counts.info} info`);
            }

            this.statusBarItem.text = `$(shield) PromptArmor: ${parts.join(', ')}`;
            this.statusBarItem.tooltip = `PromptArmor Advisor - ${total} issue(s) found. Click to scan.`;

            if (counts.critical > 0) {
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.errorBackground'
                );

                // Blink in high aggressiveness
                const aggressiveness = vscode.workspace
                    .getConfiguration('promptarmor')
                    .get<string>('aggressiveness', 'default');
                if (aggressiveness === 'high') {
                    this.startBlink();
                }
            } else if (counts.warning > 0) {
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.warningBackground'
                );
            } else {
                this.statusBarItem.backgroundColor = undefined;
            }
        }
    }

    private startBlink(): void {
        this.blinkInterval = setInterval(() => {
            this.isBlinkOn = !this.isBlinkOn;
            if (this.isBlinkOn) {
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.errorBackground'
                );
            } else {
                this.statusBarItem.backgroundColor = undefined;
            }
        }, 1000);
    }

    private stopBlink(): void {
        if (this.blinkInterval) {
            clearInterval(this.blinkInterval);
            this.blinkInterval = undefined;
        }
        this.isBlinkOn = true;
    }

    dispose(): void {
        this.stopBlink();
        this.statusBarItem.dispose();
    }
}
