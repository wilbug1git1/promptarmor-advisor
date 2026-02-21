import * as vscode from 'vscode';
import { DiagnosticsProvider } from './diagnostics';
import { PromptCategory } from '../types';

const CATEGORY_LABELS: Record<string, string> = {
    [PromptCategory.SystemPromptHardening]: '🛡️ System Prompt Hardening',
    [PromptCategory.InputValidation]: '🔍 Input Validation',
    [PromptCategory.RateLimiting]: '⏱️ Rate Limiting',
    [PromptCategory.OutputFiltering]: '🧹 Output Filtering',
    [PromptCategory.TopicGuardrails]: '🎯 Topic Guardrails',
};

/**
 * Provides hover tooltips over detected prompt security issues
 */
export class PromptHoverProvider implements vscode.HoverProvider {
    private diagnosticsProvider: DiagnosticsProvider;

    constructor(diagnosticsProvider: DiagnosticsProvider) {
        this.diagnosticsProvider = diagnosticsProvider;
    }

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const issues = this.diagnosticsProvider.getIssues(document.uri);

        const matchingIssues = issues.filter(issue => issue.range.contains(position));
        if (matchingIssues.length === 0) {
            return null;
        }

        const contents: vscode.MarkdownString[] = [];

        for (const issue of matchingIssues) {
            const md = new vscode.MarkdownString();
            md.isTrusted = true;
            md.supportHtml = true;

            const categoryLabel = CATEGORY_LABELS[issue.category] || issue.category;

            md.appendMarkdown(`### PromptArmor: ${categoryLabel}\n\n`);
            md.appendMarkdown(`**${issue.severity.toUpperCase()}**: ${issue.message}\n\n`);

            if (issue.hoverDetail) {
                md.appendMarkdown(`---\n\n${issue.hoverDetail}\n\n`);
            }

            md.appendMarkdown(`**Recommendation:** ${issue.recommendation}\n\n`);

            if (issue.codeSnippet) {
                md.appendMarkdown(`---\n\n**Suggested code:**\n\n`);
                md.appendCodeblock(issue.codeSnippet, this.getLanguageForDocument(document));
            }

            // Add quick action link
            const applyArgs = encodeURIComponent(JSON.stringify({
                uri: document.uri.toString(),
                range: {
                    start: { line: issue.range.start.line, character: issue.range.start.character },
                    end: { line: issue.range.end.line, character: issue.range.end.character },
                },
                category: issue.category,
            }));
            md.appendMarkdown(`\n\n[💡 Apply Fix](command:PromptArmor.applyFix?${applyArgs})`);

            contents.push(md);
        }

        return new vscode.Hover(contents);
    }

    private getLanguageForDocument(document: vscode.TextDocument): string {
        switch (document.languageId) {
            case 'python': return 'python';
            case 'javascript':
            case 'javascriptreact': return 'javascript';
            case 'typescript':
            case 'typescriptreact': return 'typescript';
            default: return 'javascript';
        }
    }
}
