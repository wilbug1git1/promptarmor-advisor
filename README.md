# PromptArmor Advisor

> **Real-time security analysis for LLM prompt engineering** — detect vulnerabilities, enforce guardrails, and harden your AI-powered applications before they ship.

---

## 🛡️ What It Does

PromptArmor Advisor is a VS Code linter purpose-built for developers working with Large Language Models (LLMs). It scans your code in real-time to detect **prompt injection risks**, **missing input validation**, **rate limiting gaps**, **unfiltered output**, and **missing topic guardrails**.

Think of it as **ESLint for prompt security**.

---

## ✨ Features

### 🔍 Real-Time Pattern Detection
Scans your code as you type, highlighting security issues with squiggly underlines and gutter icons — just like a regular linter.

| Category | What It Catches |
|---|---|
| **System Prompt Security** | Hardcoded prompts, user input concatenation, template literal injection |
| **Input Validation** | Raw user input passed to LLM APIs, missing sanitization |
| **Rate Limiting** | Unprotected API calls to OpenAI, Anthropic, and HTTP LLM endpoints |
| **Output Filtering** | Unfiltered LLM responses stored, displayed, or returned directly |
| **Topic Guardrails** | Missing domain scoping, unbounded conversation scope |

### 🎯 Two Scanning Modes

- **Default Mode** — Lightweight background scanning with informational diagnostics
- **High Aggressiveness** — Elevated severity levels, modal warnings on save, periodic reminders, and commit-blocking scans

### 💡 Inline Quick Fixes
Hover over any issue to see a detailed explanation with a recommended code fix. Use **Quick Fix** (`Ctrl+.`) to insert hardened code snippets directly — supports both **JavaScript/TypeScript** and **Python**.

### 📊 Security Dashboard
A dedicated side panel in the activity bar shows:
- Live security checklist (✅ / ❌ per category)
- All detected issues grouped by file
- One-click scanning and configuration

### 🔒 Git Integration
- **Pre-commit scanning** — blocks commits containing critical prompt issues (High mode)
- **Hook setup wizard** — configure Husky, pre-commit (Python), or raw git hooks with one command
- **JSON export** — export scan results for CI/CD pipelines

### ⚙️ Configurable
- Toggle aggressiveness from the status bar or command palette
- Use `.promptarmorignore` to exclude files/folders (glob patterns)
- Per-setting control over scanning, modal warnings, and git hooks

---

## 🚀 Getting Started

1. **Install** the extension  
2. **Open** any JavaScript, TypeScript, or Python file that interacts with an LLM  
3. **Issues appear automatically** — look for colored underlines and shield icons in the gutter  
4. **Hover** over an issue for details and fixes  
5. **Use Quick Fix** (`Ctrl+.`) to apply recommended mitigations  

---

## 📋 Commands

Open the Command Palette (`Ctrl+Shift+P`) and type "PromptArmor":

| Command | Description |
|---|---|
| `PromptArmor: Scan Current File` | Run a full scan on the active file |
| `PromptArmor: Aggressive Scan Workspace` | Scan all supported files in the workspace |
| `PromptArmor: Toggle Aggressiveness` | Cycle between Default and High modes |
| `PromptArmor: Configure Settings` | Open extension settings |
| `PromptArmor: Setup Git Hooks` | Interactive git hook configuration wizard |
| `PromptArmor: Pre-Commit Scan` | Scan staged/modified files before commit |
| `PromptArmor: Export Scan Results` | Export findings as JSON for CI/CD |

---

## ⚙️ Settings

| Setting | Default | Description |
|---|---|---|
| `promptarmor.enableScanning` | `true` | Enable/disable real-time scanning |
| `promptarmor.aggressiveness` | `"default"` | Scanning mode: `"default"` or `"high"` |
| `promptarmor.showInlineHints` | `true` | Show inline decorations and gutter icons |
| `promptarmor.enableGitHooks` | `false` | Enable pre-commit scanning integration |
| `promptarmor.enableModalWarnings` | `true` | Show modal dialogs for critical issues (High mode) |
| `promptarmor.scanOnSave` | `true` | Automatically scan when files are saved |
| `promptarmor.excludePatterns` | `[]` | Glob patterns for files to exclude |

---

## 🎨 Severity Levels

Issues are color-coded by severity:

- 🔴 **Critical** — Prompt injection vectors, direct user input concatenation
- 🟠 **Warning** — Missing rate limiting, unfiltered output
- 🔵 **Info** — Best practice recommendations, missing guardrails

In **High Aggressiveness** mode, warnings are elevated to errors and info items become warnings.

---

## 📁 Ignoring Files

Create a `.promptarmorignore` file in your project root:

```
# Ignore test files
**/*.test.js
**/*.spec.ts

# Ignore generated code
dist/
build/
node_modules/
```

---

## 🔗 Supported Languages

- JavaScript (`.js`, `.jsx`)
- TypeScript (`.ts`, `.tsx`)
- Python (`.py`)

---

## 🤝 Why PromptArmor?

LLM-powered applications introduce a new class of security vulnerabilities that traditional linters don't catch. Prompt injection, missing guardrails, and unfiltered output can lead to data leaks, unauthorized actions, and reputational damage.

**PromptArmor brings prompt security into your development workflow** — catching issues at write-time, not after deployment.

---

## 📄 License

MIT

---

<p align="center">
  <strong>Built for developers who ship secure AI.</strong>
</p>
