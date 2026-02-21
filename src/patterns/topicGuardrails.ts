import { DetectionPattern, PromptSeverity, PromptCategory } from '../types';

/**
 * Patterns for detecting prompts without topic guardrails
 */
export const topicGuardrailPatterns: DetectionPattern[] = [
    // System prompt without domain scoping
    {
        regex: /(?:system[_\s]*prompt|system[_\s]*message)\s*[:=]\s*(?:["'`f])(?![\s\S]*(?:only\s+(?:about|related|regarding)|out\s+of\s+scope|outside\s+(?:my|your)\s+expertise|strictly\s+about|do\s+not\s+(?:answer|respond)\s+to\s+(?:questions|topics)\s+(?:outside|unrelated)))/gi,
        message: 'System prompt lacks topic guardrails. Responses may drift off-topic.',
        severity: PromptSeverity.Warning,
        category: PromptCategory.TopicGuardrails,
        recommendation: 'Add topic scoping to your system prompt: "Respond only with information related to threat intelligence or cybersecurity. If off-topic, reply: \'Topic out of scope.\'"',
        hoverDetail:
            'Without topic guardrails, LLMs may respond to any question, even those outside your domain.\n\n' +
            '**Add to your system prompt:**\n' +
            '"Ensure all responses are strictly about threat intel/cybersecurity. ' +
            'If the query deviates, respond: \'This is outside my expertise in cybersecurity.\'"',
        codeSnippet: `// PromptArmor: Topic guardrail addition
const topicGuardrail = \`
Ensure all responses are strictly about threat intelligence and cybersecurity.
If the query is off-topic or unrelated, respond: "This is outside my expertise in cybersecurity."
Do not answer questions about unrelated domains.\`;

// Append to your system prompt:
// systemPrompt += topicGuardrail;`,
    },
    // Prompt with broad/unbounded instruction
    {
        regex: /["'`](?:You can (?:answer|help with) anything|answer any question|help with (?:everything|anything)|no topic restrictions)["'`]/gi,
        message: 'Unbounded topic scope detected. LLM may respond to any topic without restriction.',
        severity: PromptSeverity.Warning,
        category: PromptCategory.TopicGuardrails,
        recommendation: 'Replace unbounded scope with domain-specific restrictions to prevent off-topic responses.',
        hoverDetail:
            'Prompts with unbounded scope ("answer anything", "help with everything") remove all guardrails.\n\n' +
            '**Replace with specific scoping:**\n' +
            '"You are an expert in cybersecurity threat intelligence. Only respond to questions within this domain."',
    },
    // LLM messages array without any system message
    {
        regex: /messages\s*[:=]\s*\[\s*\{\s*(?:"role"|'role'|role)\s*:\s*(?:"user"|'user'|`user`)/gi,
        message: 'Messages array starts with "user" role without a "system" message. Consider adding system-level guardrails.',
        severity: PromptSeverity.Info,
        category: PromptCategory.TopicGuardrails,
        recommendation: 'Add a system message with role definition and topic guardrails before user messages.',
        hoverDetail:
            'Starting a messages array without a system message means no guardrails are set.\n\n' +
            '**Best practice:** Always include a system message first:\n' +
            '```json\n{\n  "role": "system",\n  "content": "You are a cybersecurity analyst. Only respond to security-related topics."\n}\n```',
        minSensitivity: 'medium',
    },
];
