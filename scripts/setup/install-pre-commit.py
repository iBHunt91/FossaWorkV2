#!/usr/bin/env python3
"""
Install and configure pre-commit hooks for FossaWork V2.
"""

import subprocess
import sys
from pathlib import Path

def run_command(cmd: list, check=True) -> bool:
    """Run a command and return success status."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=check)
        if result.stdout:
            print(result.stdout)
        if result.stderr and result.returncode != 0:
            print(result.stderr, file=sys.stderr)
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        print(f"Error running {' '.join(cmd)}: {e}", file=sys.stderr)
        return False

def main():
    """Install and configure pre-commit hooks."""
    print("🔧 Setting up pre-commit hooks for FossaWork V2...\n")
    
    # Check if we're in the project root
    if not Path("package.json").exists():
        print("❌ Error: Must run from project root directory")
        sys.exit(1)
    
    # Install pre-commit
    print("📦 Installing pre-commit...")
    if not run_command([sys.executable, "-m", "pip", "install", "pre-commit"]):
        print("❌ Failed to install pre-commit")
        sys.exit(1)
    
    # Install Python development dependencies
    print("\n📦 Installing Python linting tools...")
    tools = ["black", "isort", "flake8", "bandit", "detect-secrets"]
    for tool in tools:
        print(f"  Installing {tool}...")
        run_command([sys.executable, "-m", "pip", "install", tool], check=False)
    
    # Install pre-commit hooks
    print("\n🔗 Installing git hooks...")
    if not run_command(["pre-commit", "install"]):
        print("❌ Failed to install git hooks")
        sys.exit(1)
    
    # Create initial secrets baseline
    print("\n🔒 Creating secrets baseline...")
    run_command(["detect-secrets", "scan", "--baseline", ".secrets.baseline"], check=False)
    
    # Run pre-commit on all files to check current state
    print("\n🧪 Running initial check on all files...")
    print("(This may take a few minutes...)\n")
    
    # Run with --show-diff-on-failure for better feedback
    result = run_command(["pre-commit", "run", "--all-files", "--show-diff-on-failure"], check=False)
    
    if result:
        print("\n✅ All checks passed! Pre-commit hooks are ready.")
    else:
        print("\n⚠️  Some checks failed. This is normal for initial setup.")
        print("Run 'pre-commit run --all-files' to see issues.")
        print("Many issues can be auto-fixed with the --fix flag.")
    
    print("\n📋 Pre-commit hooks installed:")
    print("  • Black (Python formatting)")
    print("  • isort (Import sorting)")
    print("  • Flake8 (Python linting)")
    print("  • Prettier (JS/TS formatting)")
    print("  • Bandit (Security checks)")
    print("  • detect-secrets (Secret scanning)")
    print("  • Custom FossaWork checks")
    
    print("\n💡 Usage:")
    print("  • Hooks run automatically on 'git commit'")
    print("  • Run manually: 'pre-commit run --all-files'")
    print("  • Skip hooks: 'git commit --no-verify'")
    print("  • Update hooks: 'pre-commit autoupdate'")

if __name__ == "__main__":
    main()