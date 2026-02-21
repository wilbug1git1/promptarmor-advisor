import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Scanner } from './scanner';
import { DiagnosticsProvider, PromptHoverProvider, PromptCodeActionProvider, DecorationProvider } from './providers';
import { StatusBarManager, SidePanelProvider, ModalWarningManager } from './ui';
import { CommitGuard, HookSetup } from './git';
import { ConfigManager } from './config';
import { PromptIssue } from './types';

const SUPPORTED_LANGUAGES = [
    'javascript', 'typescript', 'python',
    'javascriptreact', 'typescriptreact',
];

let diagnosticsProvider: DiagnosticsProvider;
let decorationProvider: DecorationProvider;
let statusBarManager: StatusBarManager;
let modalWarningManager: ModalWarningManager;
let sidePanelProvider: SidePanelProvider;
let commitGuard: CommitGuard;
let configManager: ConfigManager;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

export function activate(context: vscode.ExtensionContext) {
    // Core components
    const scanner = new Scanner();
    configManager = new ConfigManager();
    diagnosticsProvider = new DiagnosticsProvider(scanner);
    decorationProvider = new DecorationProvider(diagnosticsProvider);
    statusBarManager = new StatusBarManager(diagnosticsProvider);
    modalWarningManager = new ModalWarningManager(diagnosticsProvider);
    commitGuard = new CommitGuard(diagnosticsProvider);
    const hookSetup = new HookSetup();

    // Side panel
    sidePanelProvider = new SidePanelProvider(context.extensionUri, diagnosticsProvider);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidePanelProvider.viewType, sidePanelProvider)
    );

    // ── Document selector for providers ──
    const selector: vscode.DocumentSelector = SUPPORTED_LANGUAGES.map(lang => ({
        language: lang,
        scheme: 'file',
    }));

    // ── Register providers ──
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            selector,
            new PromptHoverProvider(diagnosticsProvider)
        )
    );

    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            selector,
            new PromptCodeActionProvider(diagnosticsProvider),
            { providedCodeActionKinds: PromptCodeActionProvider.providedCodeActionKinds }
        )
    );

    // ── Register commands ──

    // Manual scan
    context.subscriptions.push(
        vscode.commands.registerCommand('promptarmor.scan', () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                runScan(editor.document);
            } else {
                vscode.window.showInformationMessage('PromptArmor: Open a file to scan.');
            }
        })
    );

    // Aggressive workspace scan
    context.subscriptions.push(
        vscode.commands.registerCommand('promptarmor.aggressiveScan', async () => {
            await scanWorkspace();
        })
    );

    // Open settings
    context.subscriptions.push(
        vscode.commands.registerCommand('promptarmor.configure', () => {
            vscode.commands.executeCommand(
                'workbench.action.openSettings',
                '@ext:promptarmor.promptarmor-advisor'
            );
        })
    );

    // Toggle aggressiveness
    context.subscriptions.push(
        vscode.commands.registerCommand('promptarmor.toggleAggressiveness', () => {
            configManager.toggleAggressiveness();
        })
    );

    // Pre-commit scan
    context.subscriptions.push(
        vscode.commands.registerCommand('promptarmor.gitPreCommitScan', () => {
            commitGuard.preCommitScan();
        })
    );

    // Setup git hooks
    context.subscriptions.push(
        vscode.commands.registerCommand('promptarmor.setupGitHooks', () => {
            hookSetup.setup();
        })
    );

    // Export scan results as JSON
    context.subscriptions.push(
        vscode.commands.registerCommand('promptarmor.exportScanResults', async () => {
            const json = commitGuard.exportScanResults();
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
                const outPath = path.join(workspaceFolders[0].uri.fsPath, 'PromptArmor-report.json');
                fs.writeFileSync(outPath, json, 'utf-8');
                vscode.window.showInformationMessage(`PromptArmor: Report exported to ${outPath}`);
                const doc = await vscode.workspace.openTextDocument(outPath);
                vscode.window.showTextDocument(doc);
            } else {
                // Show in new untitled document
                const doc = await vscode.workspace.openTextDocument({ content: json, language: 'json' });
                vscode.window.showTextDocument(doc);
            }
        })
    );

    // Apply fix command (used by hover links)
    context.subscriptions.push(
        vscode.commands.registerCommand('promptarmor.applyFix', (args: any) => {
            // Trigger quick fix at the given range
            if (args && args.uri) {
                const uri = vscode.Uri.parse(args.uri);
                vscode.workspace.openTextDocument(uri).then(doc => {
                    vscode.window.showTextDocument(doc).then(() => {
                        vscode.commands.executeCommand('editor.action.quickFix');
                    });
                });
            }
        })
    );

    // Show recommendation detail (used by code actions)
    context.subscriptions.push(
        vscode.commands.registerCommand('promptarmor.showRecommendation', (issue: PromptIssue) => {
            const panel = vscode.window.createWebviewPanel(
                'PromptArmorRecommendation',
                `PromptArmor: ${issue.category}`,
                vscode.ViewColumn.Beside,
                { enableScripts: false }
            );
            panel.webview.html = getRecommendationHtml(issue);
        })
    );

    // ── Event listeners ──

    // Scan on save
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            if (isSupportedDocument(document)) {
                runScan(document);
                modalWarningManager.checkAndWarn(document);
            }
        })
    );

    // Scan on change (debounced, depends on aggressiveness)
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const document = event.document;
            if (!isSupportedDocument(document)) { return; }

            const aggressiveness = configManager.getAggressiveness();
            if (aggressiveness === 'low') { return; } // low = save only

            const delay = aggressiveness === 'high' ? 300 : 1000;
            if (debounceTimer) { clearTimeout(debounceTimer); }
            debounceTimer = setTimeout(() => {
                runScan(document);
            }, delay);
        })
    );

    // Scan on file open (auto-scan)
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && isSupportedDocument(editor.document)) {
                runScan(editor.document);
            }
        })
    );

    // Update decorations when editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                decorationProvider.updateDecorations(editor);
            }
        })
    );

    // Reload ignore file when it changes
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            if (document.fileName.endsWith('.promptarmorignore')) {
                configManager.loadIgnoreFile();
            }
        })
    );

    // React to config changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('PromptArmor')) {
                // Re-scan active document
                const editor = vscode.window.activeTextEditor;
                if (editor && isSupportedDocument(editor.document)) {
                    runScan(editor.document);
                }
                // Update reminder schedule
                modalWarningManager.stopReminders();
                modalWarningManager.startReminders();
            }
        })
    );

    // ── Initialize ──

    // Initialize git commit guard
    commitGuard.initialize();

    // Start reminders if in high mode
    modalWarningManager.startReminders();

    // Initial scan of active editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && isSupportedDocument(activeEditor.document)) {
        runScan(activeEditor.document);
    }

    // Register disposables
    context.subscriptions.push(
        diagnosticsProvider,
        decorationProvider,
        statusBarManager,
        commitGuard
    );

    // Show activation message on first install
    const hasShownWelcome = context.globalState.get('promptarmor.welcomeShown');
    if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
            '🛡️ PromptArmor Advisor activated! Open a JS/TS/Python file with LLM code to get security recommendations.',
            'Scan Now',
            'Configure'
        ).then(choice => {
            if (choice === 'Scan Now') {
                vscode.commands.executeCommand('promptarmor.scan');
            } else if (choice === 'Configure') {
                vscode.commands.executeCommand('promptarmor.configure');
            }
        });
        context.globalState.update('promptarmor.welcomeShown', true);
    }
}

/**
 * Run a scan on a document and update all UI
 */
function runScan(document: vscode.TextDocument): void {
    if (configManager.shouldIgnore(document.fileName)) {
        return;
    }

    diagnosticsProvider.updateDiagnostics(document);
    statusBarManager.update();
    sidePanelProvider.updateContent();

    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document === document) {
        decorationProvider.updateDecorations(editor);
    }
}

/**
 * Scan all supported files in the workspace
 */
async function scanWorkspace(): Promise<void> {
    const files = await vscode.workspace.findFiles(
        '**/*.{js,ts,py,jsx,tsx}',
        '**/node_modules/**'
    );

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'PromptArmor: Scanning workspace...',
            cancellable: true,
        },
        async (progress, token) => {
            let scanned = 0;
            for (const file of files) {
                if (token.isCancellationRequested) { break; }

                if (configManager.shouldIgnore(file.fsPath)) { continue; }

                try {
                    const doc = await vscode.workspace.openTextDocument(file);
                    diagnosticsProvider.updateDiagnostics(doc);
                } catch {
                    // Skip files that can't be opened
                }

                scanned++;
                progress.report({
                    increment: (100 / files.length),
                    message: `${scanned}/${files.length} files`,
                });
            }
        }
    );

    statusBarManager.update();
    sidePanelProvider.updateContent();

    const counts = diagnosticsProvider.getIssueCounts();
    const total = counts.info + counts.warning + counts.critical;
    vscode.window.showInformationMessage(
        `PromptArmor: Workspace scan complete. Found ${total} issue(s) ` +
        `(${counts.critical} critical, ${counts.warning} warnings, ${counts.info} info).`
    );
}

/**
 * Check if a document is supported for scanning
 */
function isSupportedDocument(document: vscode.TextDocument): boolean {
    return (
        SUPPORTED_LANGUAGES.includes(document.languageId) &&
        document.uri.scheme === 'file'
    );
}

/**
 * Generate HTML for recommendation detail panel
 */
function getRecommendationHtml(issue: PromptIssue): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px; max-width: 700px; }
        h1 { font-size: 18px; }
        h2 { font-size: 14px; margin-top: 16px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
        .severity { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; }
        .severity.critical { background: #ff4444; color: white; }
        .severity.warning { background: #ff8800; color: white; }
        .severity.info { background: #4488ff; color: white; }
        pre { background: var(--vscode-editor-background); padding: 12px; border-radius: 4px; overflow-x: auto; }
        code { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
        .recommendation { background: var(--vscode-editor-background); padding: 12px; border-left: 3px solid #4488ff; margin: 8px 0; }
    </style>
</head>
<body>
    <h1>🛡️ PromptArmor: ${escapeHtml(issue.category)}</h1>
    <span class="severity ${issue.severity}">${issue.severity.toUpperCase()}</span>

    <h2>Issue</h2>
    <p>${escapeHtml(issue.message)}</p>

    ${issue.hoverDetail ? `<h2>Details</h2><p>${issue.hoverDetail}</p>` : ''}

    <h2>Recommendation</h2>
    <div class="recommendation">${escapeHtml(issue.recommendation)}</div>

    ${issue.codeSnippet ? `<h2>Suggested Code</h2><pre><code>${escapeHtml(issue.codeSnippet)}</code></pre>` : ''}
</body>
</html>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function deactivate() {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
}
