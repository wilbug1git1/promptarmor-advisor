import * as vscode from 'vscode';
import { DetectionPattern, PromptIssue } from './types';
import {
    systemPromptPatterns,
    inputValidationPatterns,
    rateLimitingPatterns,
    outputFilteringPatterns,
    topicGuardrailPatterns,
} from './patterns';

/**
 * Core scanner that runs all detection patterns against a document
 */
export class Scanner {
    private allPatterns: DetectionPattern[];

    constructor() {
        this.allPatterns = [
            ...systemPromptPatterns,
            ...inputValidationPatterns,
            ...rateLimitingPatterns,
            ...outputFilteringPatterns,
            ...topicGuardrailPatterns,
        ];
    }

    /**
     * Scan a document and return all detected prompt issues
     */
    public scan(document: vscode.TextDocument): PromptIssue[] {
        const config = vscode.workspace.getConfiguration('promptarmor');
        const sensitivity: string = config.get('sensitivity', 'medium');
        const customKeywords: string[] = config.get('customKeywords', []);
        const excludedFileTypes: string[] = config.get('excludedFileTypes', []);
        const languageId = document.languageId;

        // Check excluded file types
        const ext = '.' + document.fileName.split('.').pop();
        if (excludedFileTypes.includes(ext)) {
            return [];
        }

        const text = document.getText();
        const issues: PromptIssue[] = [];

        // Run all built-in patterns
        for (const pattern of this.allPatterns) {
            // Filter by language
            if (pattern.languages && pattern.languages.length > 0) {
                if (!pattern.languages.includes(languageId)) {
                    continue;
                }
            }

            // Filter by sensitivity
            if (pattern.minSensitivity) {
                const levels = ['low', 'medium', 'high'];
                const patternLevel = levels.indexOf(pattern.minSensitivity);
                const userLevel = levels.indexOf(sensitivity);
                if (userLevel < patternLevel) {
                    continue;
                }
            }

            // Reset regex lastIndex for global patterns
            const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
            let match: RegExpExecArray | null;

            while ((match = regex.exec(text)) !== null) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);
                const range = new vscode.Range(startPos, endPos);

                issues.push({
                    range,
                    message: pattern.message,
                    severity: pattern.severity,
                    category: pattern.category,
                    recommendation: pattern.recommendation,
                    codeSnippet: pattern.codeSnippet,
                    hoverDetail: pattern.hoverDetail,
                });

                // Prevent infinite loops on zero-length matches
                if (match[0].length === 0) {
                    regex.lastIndex++;
                }
            }
        }

        // Run custom keyword patterns
        if (customKeywords.length > 0) {
            const escapedKeywords = customKeywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const customRegex = new RegExp(`(?:${escapedKeywords.join('|')})`, 'gi');
            let match: RegExpExecArray | null;

            while ((match = customRegex.exec(text)) !== null) {
                const startPos = document.positionAt(match.index);
                const endPos = document.positionAt(match.index + match[0].length);
                const range = new vscode.Range(startPos, endPos);

                issues.push({
                    range,
                    message: `Custom keyword "${match[0]}" detected. Review for prompt security.`,
                    severity: 'info' as any,
                    category: 'system-prompt-hardening' as any,
                    recommendation: 'Review this code section for prompt security best practices.',
                });

                if (match[0].length === 0) {
                    customRegex.lastIndex++;
                }
            }
        }

        return issues;
    }

    /**
     * Quick check if a document likely contains prompt-related code
     * (used for threshold: only activate if multiple indicators present)
     */
    public hasPromptIndicators(document: vscode.TextDocument): boolean {
        const text = document.getText().toLowerCase();
        const indicators = [
            'prompt', 'llm', 'openai', 'anthropic', 'chatcompletion',
            'system message', 'system_message', 'systemprompt', 'system_prompt',
            'messages.create', 'chat.completions', 'you are a',
            'gpt-4', 'gpt-3', 'claude', 'gemini', 'completion',
        ];
        let count = 0;
        for (const indicator of indicators) {
            if (text.includes(indicator)) {
                count++;
            }
            if (count >= 2) {
                return true;
            }
        }

        const config = vscode.workspace.getConfiguration('promptarmor');
        const sensitivity: string = config.get('sensitivity', 'medium');
        // In high sensitivity, a single indicator is enough
        if (sensitivity === 'high' && count >= 1) {
            return true;
        }
        return false;
    }
}
