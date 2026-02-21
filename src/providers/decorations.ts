import * as vscode from 'vscode';
import { DiagnosticsProvider } from './diagnostics';
import { PromptSeverity } from '../types';

/**
 * Manages editor decorations: gutter icons and line highlights for prompt issues
 */
export class DecorationProvider implements vscode.Disposable {
    private criticalDecorationType: vscode.TextEditorDecorationType;
    private warningDecorationType: vscode.TextEditorDecorationType;
    private infoDecorationType: vscode.TextEditorDecorationType;
    private diagnosticsProvider: DiagnosticsProvider;

    constructor(diagnosticsProvider: DiagnosticsProvider) {
        this.diagnosticsProvider = diagnosticsProvider;

        this.criticalDecorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.getGutterIconUri('critical'),
            gutterIconSize: 'contain',
            overviewRulerColor: '#ff0000',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            backgroundColor: 'rgba(255, 0, 0, 0.08)',
            isWholeLine: true,
        });

        this.warningDecorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.getGutterIconUri('warning'),
            gutterIconSize: 'contain',
            overviewRulerColor: '#ff8800',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            backgroundColor: 'rgba(255, 136, 0, 0.06)',
            isWholeLine: true,
        });

        this.infoDecorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.getGutterIconUri('info'),
            gutterIconSize: 'contain',
            overviewRulerColor: '#0088ff',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
        });
    }

    /**
     * Update decorations for a text editor
     */
    public updateDecorations(editor: vscode.TextEditor): void {
        const issues = this.diagnosticsProvider.getIssues(editor.document.uri);

        const critical: vscode.DecorationOptions[] = [];
        const warning: vscode.DecorationOptions[] = [];
        const info: vscode.DecorationOptions[] = [];

        for (const issue of issues) {
            const decoration: vscode.DecorationOptions = {
                range: issue.range,
                hoverMessage: new vscode.MarkdownString(
                    `**PromptArmor** (${issue.severity}): ${issue.message}`
                ),
            };

            switch (issue.severity) {
                case PromptSeverity.Critical:
                    critical.push(decoration);
                    break;
                case PromptSeverity.Warning:
                    warning.push(decoration);
                    break;
                case PromptSeverity.Info:
                    info.push(decoration);
                    break;
            }
        }

        editor.setDecorations(this.criticalDecorationType, critical);
        editor.setDecorations(this.warningDecorationType, warning);
        editor.setDecorations(this.infoDecorationType, info);
    }

    /**
     * Clear all decorations from an editor
     */
    public clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(this.criticalDecorationType, []);
        editor.setDecorations(this.warningDecorationType, []);
        editor.setDecorations(this.infoDecorationType, []);
    }

    /**
     * Generate a simple SVG data URI for gutter icons
     */
    private getGutterIconUri(level: 'critical' | 'warning' | 'info'): vscode.Uri {
        const colors: Record<string, string> = {
            critical: '#ff0000',
            warning: '#ff8800',
            info: '#0088ff',
        };
        const color = colors[level];

        // Shield icon as SVG data URI
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">
            <path d="M8 1L2 4v4c0 3.5 2.6 6.8 6 7.5 3.4-.7 6-4 6-7.5V4L8 1z" fill="${color}" opacity="0.85"/>
            <path d="M8 2.2L3 4.7v3.5c0 2.9 2.2 5.6 5 6.3 2.8-.7 5-3.4 5-6.3V4.7L8 2.2z" fill="none" stroke="white" stroke-width="0.5"/>
            ${level === 'critical' ? '<text x="8" y="11" text-anchor="middle" fill="white" font-size="8" font-weight="bold">!</text>' : ''}
            ${level === 'warning' ? '<text x="8" y="11" text-anchor="middle" fill="white" font-size="8" font-weight="bold">⚠</text>' : ''}
            ${level === 'info' ? '<text x="8" y="11" text-anchor="middle" fill="white" font-size="7" font-weight="bold">i</text>' : ''}
        </svg>`;

        return vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
    }

    dispose(): void {
        this.criticalDecorationType.dispose();
        this.warningDecorationType.dispose();
        this.infoDecorationType.dispose();
    }
}
