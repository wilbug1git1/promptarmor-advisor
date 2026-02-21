import { DetectionPattern, PromptSeverity, PromptCategory } from '../types';

/**
 * Patterns for detecting LLM API calls without rate limiting
 */
export const rateLimitingPatterns: DetectionPattern[] = [
    // OpenAI API calls
    {
        regex: /openai\.(?:ChatCompletion\.create|chat\.completions\.create|Completion\.create|completions\.create)/gi,
        message: 'OpenAI API call detected. Ensure rate limiting is applied per user/session.',
        severity: PromptSeverity.Warning,
        category: PromptCategory.RateLimiting,
        recommendation: 'Add rate limiting around LLM API calls to prevent abuse. Consider per-user throttling (e.g., 10 requests/min).',
        hoverDetail:
            'LLM API calls without rate limiting are vulnerable to abuse.\n\n' +
            '**Risks:**\n' +
            '- Cost explosion from excessive API calls\n' +
            '- Denial of service for other users\n' +
            '- API key exhaustion\n\n' +
            '**Recommended:** Add per-user rate limiting (e.g., 10 req/min) using libraries like `rate-limiter-flexible` (JS) or `ratelimit` (Python).',
        codeSnippet: `// PromptArmor: Rate limiting with rate-limiter-flexible
const { RateLimiterMemory } = require('rate-limiter-flexible');
const rateLimiter = new RateLimiterMemory({
    points: 10,  // 10 requests
    duration: 60, // per 60 seconds
});

async function handleLLMRequest(userId: string, prompt: string) {
    try {
        await rateLimiter.consume(userId);
        // Proceed with LLM API call
    } catch (rateLimiterRes) {
        throw new Error('Rate limit exceeded. Please wait before making another request.');
    }
}`,
    },
    // Anthropic API calls
    {
        regex: /anthropic\.(?:messages\.create|completions\.create|Anthropic\(\))/gi,
        message: 'Anthropic API call detected. Ensure rate limiting is applied per user/session.',
        severity: PromptSeverity.Warning,
        category: PromptCategory.RateLimiting,
        recommendation: 'Add rate limiting around LLM API calls to prevent abuse.',
        hoverDetail:
            'LLM API calls to Anthropic without rate limiting are vulnerable to cost abuse and DoS.\n\n' +
            '**Add per-user rate limiting** before making API calls.',
        codeSnippet: `# PromptArmor: Python rate limiting example
from ratelimit import limits, sleep_and_retry

@sleep_and_retry
@limits(calls=10, period=60)  # 10 calls per minute
def call_anthropic(user_id: str, prompt: str):
    # Proceed with API call
    pass`,
    },
    // Generic fetch/axios calls to known LLM endpoints
    {
        regex: /(?:fetch|axios|requests?\.(?:post|get))\s*\(\s*["'`][^"'`]*(?:api\.openai|api\.anthropic|generativelanguage\.googleapis|api\.cohere)/gi,
        message: 'Direct HTTP call to LLM API endpoint detected. Ensure rate limiting and error handling.',
        severity: PromptSeverity.Warning,
        category: PromptCategory.RateLimiting,
        recommendation: 'Wrap LLM API HTTP calls with rate limiting, retry logic, and proper error handling.',
        hoverDetail:
            'Direct HTTP calls to LLM APIs should be protected:\n\n' +
            '- **Rate limiting**: Prevent abuse\n' +
            '- **Retry with backoff**: Handle transient failures\n' +
            '- **Error handling**: Catch and handle API errors gracefully\n' +
            '- **Timeout**: Set request timeouts to prevent hanging',
    },
    // LLM API call in a loop without throttle
    {
        regex: /(?:for|while|forEach|map)\s*[\(\{][\s\S]{0,300}(?:openai|anthropic|completion|chat\.create|messages\.create)/gi,
        message: 'LLM API call inside a loop detected. High risk of rate limit exhaustion and cost explosion.',
        severity: PromptSeverity.Critical,
        category: PromptCategory.RateLimiting,
        recommendation: 'Add delays/throttling when calling LLM APIs in loops. Consider batching requests or using queues.',
        hoverDetail:
            '**HIGH RISK**: Calling LLM APIs in a loop without throttling can:\n' +
            '- Exhaust API rate limits immediately\n' +
            '- Generate unexpected costs\n' +
            '- Get your API key suspended\n\n' +
            '**Fix:** Add delay between calls, use batch APIs, or implement a request queue.',
    },
];
