<#
.SYNOPSIS
    Installs the PromptArmor Advisor VS Code extension from a local .vsix file.

.DESCRIPTION
    This script packages (if needed) and installs the PromptArmor Advisor extension
    into VS Code on the local machine. Copy this entire project folder to any computer
    and run this script.

.NOTES
    Requirements: VS Code must be installed and 'code' must be on PATH.
    Run from the project root directory (where package.json lives).
#>

param(
    [switch]$SkipBuild,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$extensionId = "promptarmor.promptarmor-advisor"
$vsixName = "promptarmor-advisor-1.0.0.vsix"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Push-Location $scriptDir

# --- Preflight checks ---
Write-Host ""
Write-Host "=== PromptArmor Advisor Installer ===" -ForegroundColor Cyan
Write-Host ""

# Check VS Code is available
if (-not (Get-Command code -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] 'code' command not found. Is VS Code installed and on PATH?" -ForegroundColor Red
    Write-Host "  -> Try opening VS Code, Ctrl+Shift+P, type 'Shell Command: Install code in PATH'" -ForegroundColor Yellow
    Pop-Location
    exit 1
}

# --- Uninstall mode ---
if ($Uninstall) {
    Write-Host "Uninstalling $extensionId ..." -ForegroundColor Yellow
    code --uninstall-extension $extensionId 2>$null
    Write-Host "Done. Reload VS Code to complete removal." -ForegroundColor Green
    Pop-Location
    exit 0
}

# --- Build .vsix if needed ---
$vsixPath = Join-Path $scriptDir $vsixName

if (-not $SkipBuild -or -not (Test-Path $vsixPath)) {
    Write-Host "Building extension package..." -ForegroundColor Yellow

    # Check npm is available
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] 'npm' not found. Install Node.js from https://nodejs.org" -ForegroundColor Red
        Pop-Location
        exit 1
    }

    # Check vsce is available
    $vsceCmd = Get-Command vsce -ErrorAction SilentlyContinue
    if (-not $vsceCmd) {
        Write-Host "Installing @vscode/vsce globally..." -ForegroundColor Yellow
        npm install -g @vscode/vsce
    }

    # Install dependencies
    if (-not (Test-Path (Join-Path $scriptDir "node_modules"))) {
        Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
        npm install
    }

    # Remove old .vsix
    if (Test-Path $vsixPath) {
        Remove-Item $vsixPath -Force
    }

    # Package
    Write-Host "Packaging .vsix..." -ForegroundColor Yellow
    vsce package --allow-missing-repository
    if (-not (Test-Path $vsixPath)) {
        Write-Host "[ERROR] Packaging failed. Check for errors above." -ForegroundColor Red
        Pop-Location
        exit 1
    }

    Write-Host "Package created: $vsixName" -ForegroundColor Green
}
else {
    Write-Host "Using existing $vsixName (use without -SkipBuild to rebuild)" -ForegroundColor DarkGray
}

# --- Install ---
Write-Host ""
Write-Host "Installing extension..." -ForegroundColor Yellow
code --install-extension $vsixPath --force

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "=== Installation Complete ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Reload VS Code to activate:  Ctrl+Shift+P -> 'Developer: Reload Window'" -ForegroundColor Cyan
    Write-Host ""
}
else {
    Write-Host "[ERROR] Installation failed with exit code $LASTEXITCODE" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location
