import * as vscode from 'vscode';
import { DiagnosticsProvider } from '../providers/diagnostics';
import { PromptSeverity, PromptIssue, PromptCategory } from '../types';

const CATEGORY_INFO: Record<string, { icon: string; title: string; description: string }> = {
    [PromptCategory.SystemPromptHardening]: {
        icon: '🛡️',
        title: 'System Prompt Hardening',
        description: 'Techniques to prevent prompt injection and enforce role consistency.',
    },
    [PromptCategory.InputValidation]: {
        icon: '🔍',
        title: 'Input Validation',
        description: 'Checks for input length and common injection patterns.',
    },
    [PromptCategory.RateLimiting]: {
        icon: '⏱️',
        title: 'Rate Limiting',
        description: 'Mechanisms to throttle requests on a per-user basis.',
    },
    [PromptCategory.OutputFiltering]: {
        icon: '🧹',
        title: 'Output Filtering',
        description: 'Basic safety validations on LLM-generated responses.',
    },
    [PromptCategory.TopicGuardrails]: {
        icon: '🎯',
        title: 'Topic Guardrails',
        description: 'Ensuring responses remain scoped to threat intel/cybersecurity topics.',
    },
};

/**
 * Side panel webview showing PromptArmor checklist and issue details
 */
export class SidePanelProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'promptarmor.sidePanel';

    private view?: vscode.WebviewView;
    private diagnosticsProvider: DiagnosticsProvider;

    constructor(
        private readonly extensionUri: vscode.Uri,
        diagnosticsProvider: DiagnosticsProvider
    ) {
        this.diagnosticsProvider = diagnosticsProvider;
    }

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };

        this.updateContent();

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'scan':
                    vscode.commands.executeCommand('promptarmor.scan');
                    break;
                case 'openIssue':
                    this.openIssue(data.uri, data.line);
                    break;
                case 'configure':
                    vscode.commands.executeCommand('promptarmor.configure');
                    break;
            }
        });
    }

    /**
     * Refresh the side panel content
     */
    public updateContent(): void {
        if (!this.view) {
            return;
        }
        this.view.webview.html = this.getHtml();
    }

    private async openIssue(uriStr: string, line: number): Promise<void> {
        const uri = vscode.Uri.parse(uriStr);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc);
        const pos = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }

    private getHtml(): string {
        const allIssues = this.diagnosticsProvider.getAllIssues();
        const counts = this.diagnosticsProvider.getIssueCounts();
        const total = counts.info + counts.warning + counts.critical;

        // Build issue list HTML
        let issueListHtml = '';
        if (total === 0) {
            issueListHtml = '<div class="no-issues">✅ No prompt security issues detected.</div>';
        } else {
            for (const [uriStr, issues] of allIssues) {
                if (issues.length === 0) { continue; }
                const fileName = uriStr.split('/').pop() || uriStr;
                issueListHtml += `<div class="file-group"><h3>${this.escapeHtml(fileName)}</h3>`;
                for (const issue of issues) {
                    const severityClass = issue.severity;
                    const catInfo = CATEGORY_INFO[issue.category];
                    issueListHtml += `
                        <div class="issue ${severityClass}" onclick="openIssue('${this.escapeHtml(uriStr)}', ${issue.range.start.line})">
                            <span class="icon">${catInfo?.icon || '🔒'}</span>
                            <div class="issue-content">
                                <div class="issue-title">${this.escapeHtml(issue.message)}</div>
                                <div class="issue-meta">Line ${issue.range.start.line + 1} · ${issue.severity}</div>
                            </div>
                        </div>`;
                }
                issueListHtml += '</div>';
            }
        }

        // Build checklist HTML
        let checklistHtml = '';
        for (const [category, info] of Object.entries(CATEGORY_INFO)) {
            const categoryIssues = Array.from(allIssues.values())
                .flat()
                .filter(i => i.category === category);
            const hasIssues = categoryIssues.length > 0;
            const statusIcon = hasIssues ? '⚠️' : '✅';
            checklistHtml += `
                <div class="checklist-item ${hasIssues ? 'has-issues' : 'clean'}">
                    <span class="status">${statusIcon}</span>
                    <div>
                        <strong>${info.icon} ${info.title}</strong>
                        <div class="checklist-desc">${info.description}</div>
                        ${hasIssues ? `<div class="issue-count">${categoryIssues.length} issue(s)</div>` : ''}
                    </div>
                </div>`;
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 0 8px; }
        h2 { font-size: 14px; margin: 12px 0 6px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
        .summary { display: flex; gap: 12px; margin: 8px 0; font-size: 12px; }
        .summary .count { font-weight: bold; }
        .summary .critical { color: #ff4444; }
        .summary .warning { color: #ff8800; }
        .summary .info { color: #4488ff; }
        .btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground);
               border: none; padding: 4px 12px; cursor: pointer; margin: 4px 2px; font-size: 12px; border-radius: 2px; }
        .btn:hover { background: var(--vscode-button-hoverBackground); }
        .checklist-item { display: flex; gap: 8px; padding: 6px 4px; border-bottom: 1px solid var(--vscode-panel-border); align-items: flex-start; }
        .checklist-item .status { font-size: 14px; min-width: 20px; }
        .checklist-item strong { font-size: 12px; }
        .checklist-desc { font-size: 11px; opacity: 0.8; margin-top: 2px; }
        .issue-count { font-size: 11px; color: #ff8800; margin-top: 2px; }
        .file-group h3 { font-size: 12px; margin: 8px 0 4px; }
        .issue { display: flex; gap: 8px; padding: 6px; cursor: pointer; border-radius: 3px; margin: 2px 0; }
        .issue:hover { background: var(--vscode-list-hoverBackground); }
        .issue .icon { font-size: 14px; min-width: 20px; }
        .issue-title { font-size: 12px; }
        .issue-meta { font-size: 10px; opacity: 0.6; margin-top: 2px; }
        .issue.critical { border-left: 3px solid #ff4444; }
        .issue.warning { border-left: 3px solid #ff8800; }
        .issue.info { border-left: 3px solid #4488ff; }
        .no-issues { padding: 16px; text-align: center; font-size: 13px; opacity: 0.8; }
    </style>
</head>
<body>
    <h2>PromptArmor Advisor</h2>
    <div class="summary">
        <span class="count critical">${counts.critical} Critical</span>
        <span class="count warning">${counts.warning} Warnings</span>
        <span class="count info">${counts.info} Info</span>
    </div>
    <div>
        <button class="btn" onclick="scan()">🔍 Scan Now</button>
        <button class="btn" onclick="configure()">⚙️ Settings</button>
    </div>

    <h2>Security Checklist</h2>
    ${checklistHtml}

    <h2>Issues</h2>
    ${issueListHtml}

    <script>
        const vscode = acquireVsCodeApi();
        function scan() { vscode.postMessage({ type: 'scan' }); }
        function configure() { vscode.postMessage({ type: 'configure' }); }
        function openIssue(uri, line) { vscode.postMessage({ type: 'openIssue', uri, line }); }
    </script>
</body>
</html>`;
    }

    private escapeHtml(str: string): string {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}
