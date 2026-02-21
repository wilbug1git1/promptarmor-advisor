import { DetectionPattern, PromptSeverity, PromptCategory } from '../types';

/**
 * Patterns for detecting missing input validation around LLM calls
 */
export const inputValidationPatterns: DetectionPattern[] = [
    // User input passed directly to LLM call without length check
    {
        regex: /(?:user[_\s]*input|user[_\s]*message|req\.body|request\.(?:body|query|params))\s*(?:\.(?:prompt|message|text|content))?/gi,
        message: 'User input near prompt construction. Ensure input validation (length limits, injection pattern checks).',
        severity: PromptSeverity.Warning,
        category: PromptCategory.InputValidation,
        recommendation: 'Add input validation: enforce max length, check for injection patterns (e.g., "ignore previous instructions"), and sanitize before use.',
        hoverDetail:
            'User input should be validated before being included in LLM prompts.\n\n' +
            '**Recommended checks:**\n' +
            '- Max length (e.g., 2000 chars)\n' +
            '- Injection pattern detection ("ignore previous", "override", "forget")\n' +
            '- Special character filtering\n' +
            '- Content type validation',
        codeSnippet: `// PromptArmor: Input validation helper
function validatePromptInput(input: string, maxLength = 2000): string {
    if (!input || typeof input !== 'string') {
        throw new Error('Invalid input');
    }
    if (input.length > maxLength) {
        input = input.slice(0, maxLength);
    }
    const injectionPatterns = /ignore previous|override|forget|disregard|system prompt|you are now/i;
    if (injectionPatterns.test(input)) {
        throw new Error('Potential injection detected in input');
    }
    return input;
}`,
        minSensitivity: 'medium',
    },
    // Python: raw input() used near prompt
    {
        regex: /input\s*\(\s*["'][^"']*["']\s*\).*(?:prompt|llm|chat|message|completion)/gi,
        message: 'Raw input() near prompt code. Validate and sanitize user input before LLM use.',
        severity: PromptSeverity.Warning,
        category: PromptCategory.InputValidation,
        recommendation: 'Validate input from input() before passing to LLM: check length, filter injection patterns.',
        hoverDetail:
            'Using raw `input()` near LLM code is risky.\n\n' +
            '**Add validation:**\n```python\ndef validate_input(user_input: str) -> str:\n    if len(user_input) > 2000:\n        user_input = user_input[:2000]\n    import re\n    if re.search(r"(ignore previous|override|forget)", user_input, re.IGNORECASE):\n        raise ValueError("Invalid input detected")\n    return user_input\n```',
        languages: ['python'],
    },
    // Detect long prompt/message strings without truncation logic nearby
    {
        regex: /(?:messages|prompt)\s*(?:=|\[)[\s\S]{0,200}(?:content|role)\s*:/gi,
        message: 'LLM message construction detected. Ensure user content has length limits applied.',
        severity: PromptSeverity.Info,
        category: PromptCategory.InputValidation,
        recommendation: 'Consider adding a max length check on user-provided content before including it in messages.',
        hoverDetail:
            'When constructing LLM messages arrays, ensure that any user-contributed content ' +
            'has been truncated to a safe length (e.g., 2000 characters) to prevent token abuse.',
        minSensitivity: 'high',
    },
];
