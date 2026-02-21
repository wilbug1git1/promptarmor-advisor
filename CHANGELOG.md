# Changelog

All notable changes to **PromptArmor Advisor** will be documented in this file.

## [1.0.0] — 2026-02-20

### Added
- Real-time scanning for 18 prompt security patterns across 5 categories
- System Prompt Security: detects hardcoded prompts, user input concatenation, template literal injection
- Input Validation: flags raw user input passed to LLM APIs
- Rate Limiting: identifies unprotected calls to OpenAI, Anthropic, and HTTP LLM endpoints
- Output Filtering: catches unfiltered LLM responses in storage, display, or return paths
- Topic Guardrails: warns about missing domain scoping and unbounded conversation scope
- Two scanning modes: Default (informational) and High Aggressiveness (blocking)
- Inline Quick Fix code actions for JavaScript/TypeScript and Python
- Rich hover tooltips with explanations and code snippets
- Gutter decoration icons (red/orange/blue shields) by severity
- Security Dashboard side panel with live checklist and issue grouping
- Status bar indicator with issue counts
- Git pre-commit scanning integration
- Git hook setup wizard (Husky, pre-commit, raw hooks)
- JSON export for CI/CD pipelines
- `.promptarmorignore` file support
- Modal warning dialogs for critical issues (High mode)
- Configurable settings for all features
