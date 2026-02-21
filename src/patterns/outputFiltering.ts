import { DetectionPattern, PromptSeverity, PromptCategory } from '../types';

/**
 * Patterns for detecting missing output filtering on LLM responses
 */
export const outputFilteringPatterns: DetectionPattern[] = [
    // LLM response stored without filtering
    {
        regex: /(?:response|result|completion|answer|output)\s*=\s*(?:await\s+)?(?:openai|anthropic|client|llm|model|chat)[\s\S]{0,100}(?:content|text|message|choices)/gi,
        message: 'LLM response stored without output filtering. Add safety checks before using.',
        severity: PromptSeverity.Warning,
        category: PromptCategory.OutputFiltering,
        recommendation: 'Add output filtering to scan LLM responses for harmful content, PII, or off-topic material before presenting to users.',
        hoverDetail:
            'LLM responses should be filtered before use.\n\n' +
            '**Check for:**\n' +
            '- Harmful content (violence, exploitation)\n' +
            '- PII leaks (emails, SSNs, passwords)\n' +
            '- Executable code that could be injected\n' +
            '- Off-topic responses\n' +
            '- Prompt leakage (system prompt revealed)',
        codeSnippet: `// PromptArmor: Output filtering helper
function filterLLMOutput(response: string): string {
    // Check for unsafe patterns
    const unsafePatterns = [
        /malware\\s+code/i,
        /exploit\\s+instructions/i,
        /\\b(?:password|ssn|credit.?card)\\s*[:=]\\s*\\S+/i,
    ];
    for (const pattern of unsafePatterns) {
        if (pattern.test(response)) {
            return 'Response blocked for safety.';
        }
    }
    // Check for prompt leakage
    if (/system\\s*prompt|you\\s+are\\s+a/i.test(response)) {
        return 'Response blocked: potential prompt leakage detected.';
    }
    return response;
}`,
    },
    // Response sent directly to user/client without checks
    {
        regex: /(?:res\.(?:send|json|write)|print|console\.log|return)\s*\(\s*(?:response|result|completion|answer)(?:\.(?:data|text|content|message|choices))?\s*\)/gi,
        message: 'LLM response sent directly to output without filtering. Add safety checks.',
        severity: PromptSeverity.Warning,
        category: PromptCategory.OutputFiltering,
        recommendation: 'Filter LLM output before sending to the client. Check for harmful content, PII, and prompt leakage.',
        hoverDetail:
            'Sending LLM responses directly to users without filtering is risky.\n\n' +
            '**Always post-process LLM output** to remove or block:\n' +
            '- Harmful or inappropriate content\n' +
            '- Personally identifiable information (PII)\n' +
            '- System prompt or instruction leaks\n' +
            '- Malicious code suggestions',
    },
    // Python: response used in format/print without filter
    {
        regex: /(?:print|return|\.format|f["'])\s*(?:\()?(?:response|result|completion|answer)(?:\.(?:content|text|choices))?/gi,
        message: 'LLM response used in output without filtering.',
        severity: PromptSeverity.Info,
        category: PromptCategory.OutputFiltering,
        recommendation: 'Apply output filtering before displaying or returning LLM responses.',
        hoverDetail:
            'Consider adding output validation before presenting LLM responses.\n\n' +
            '```python\ndef filter_output(response: str) -> str:\n    unsafe = ["malware code", "exploit instructions"]\n    for pattern in unsafe:\n        if pattern in response.lower():\n            return "Response blocked for safety."\n    return response\n```',
        minSensitivity: 'medium',
    },
];
