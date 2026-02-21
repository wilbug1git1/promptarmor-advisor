import * as vscode from 'vscode';
import { Scanner } from '../scanner';
import { PromptIssue, PromptSeverity } from '../types';

/**
 * Manages diagnostics for detected prompt security issues
 */
export class DiagnosticsProvider implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private scanner: Scanner;
    private issueCache: Map<string, PromptIssue[]> = new Map();

    constructor(scanner: Scanner) {
        this.scanner = scanner;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('PromptArmor');
    }

    /**
     * Scan a document and update diagnostics
     */
    public updateDiagnostics(document: vscode.TextDocument): PromptIssue[] {
        // Only scan if document has prompt indicators (threshold check)
        if (!this.scanner.hasPromptIndicators(document)) {
            this.diagnosticCollection.delete(document.uri);
            this.issueCache.delete(document.uri.toString());
            return [];
        }

        const issues = this.scanner.scan(document);
        this.issueCache.set(document.uri.toString(), issues);

        const diagnostics = issues.map(issue => {
            const diagnostic = new vscode.Diagnostic(
                issue.range,
                `[PromptArmor] ${issue.message}`,
                this.mapSeverity(issue.severity)
            );
            diagnostic.source = 'PromptArmor';
            diagnostic.code = issue.category;
            return diagnostic;
        });

        this.diagnosticCollection.set(document.uri, diagnostics);
        return issues;
    }

    /**
     * Get cached issues for a document
     */
    public getIssues(uri: vscode.Uri): PromptIssue[] {
        return this.issueCache.get(uri.toString()) || [];
    }

    /**
     * Get all cached issues across all documents
     */
    public getAllIssues(): Map<string, PromptIssue[]> {
        return this.issueCache;
    }

    /**
     * Get count of issues by severity
     */
    public getIssueCounts(): { info: number; warning: number; critical: number } {
        let info = 0, warning = 0, critical = 0;
        for (const issues of this.issueCache.values()) {
            for (const issue of issues) {
                switch (issue.severity) {
                    case PromptSeverity.Info: info++; break;
                    case PromptSeverity.Warning: warning++; break;
                    case PromptSeverity.Critical: critical++; break;
                }
            }
        }
        return { info, warning, critical };
    }

    /**
     * Clear all diagnostics
     */
    public clear(): void {
        this.diagnosticCollection.clear();
        this.issueCache.clear();
    }

    private mapSeverity(severity: PromptSeverity): vscode.DiagnosticSeverity {
        const aggressiveness = vscode.workspace.getConfiguration('promptarmor').get<string>('aggressiveness', 'default');

        switch (severity) {
            case PromptSeverity.Critical:
                return vscode.DiagnosticSeverity.Error;
            case PromptSeverity.Warning:
                // In high aggressiveness, escalate warnings to errors
                return aggressiveness === 'high'
                    ? vscode.DiagnosticSeverity.Error
                    : vscode.DiagnosticSeverity.Warning;
            case PromptSeverity.Info:
                // In high aggressiveness, escalate info to warnings
                return aggressiveness === 'high'
                    ? vscode.DiagnosticSeverity.Warning
                    : vscode.DiagnosticSeverity.Information;
            default:
                return vscode.DiagnosticSeverity.Information;
        }
    }

    dispose(): void {
        this.diagnosticCollection.dispose();
    }
}
