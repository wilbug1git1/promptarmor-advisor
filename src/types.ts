import * as vscode from 'vscode';

/**
 * Severity levels for detected issues
 */
export enum PromptSeverity {
    Info = 'info',
    Warning = 'warning',
    Critical = 'critical',
}

/**
 * Categories of prompt security issues
 */
export enum PromptCategory {
    SystemPromptHardening = 'system-prompt-hardening',
    InputValidation = 'input-validation',
    RateLimiting = 'rate-limiting',
    OutputFiltering = 'output-filtering',
    TopicGuardrails = 'topic-guardrails',
}

/**
 * A single detected prompt issue
 */
export interface PromptIssue {
    range: vscode.Range;
    message: string;
    severity: PromptSeverity;
    category: PromptCategory;
    recommendation: string;
    codeSnippet?: string;
    hoverDetail?: string;
}

/**
 * Pattern definition for detection
 */
export interface DetectionPattern {
    /** Regex to match against document text */
    regex: RegExp;
    /** Human-readable message */
    message: string;
    severity: PromptSeverity;
    category: PromptCategory;
    /** Recommendation shown in diagnostics and code actions */
    recommendation: string;
    /** Code snippet to insert/suggest */
    codeSnippet?: string;
    /** Detailed hover explanation */
    hoverDetail?: string;
    /** Languages this pattern applies to (empty = all supported) */
    languages?: string[];
    /** Minimum sensitivity to trigger ('low' triggers always, 'high' only on high sensitivity) */
    minSensitivity?: 'low' | 'medium' | 'high';
}
