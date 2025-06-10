"""
Console utilities for cross-platform compatibility
"""
import platform
import os
import sys

def is_windows_console():
    """Check if running in a Windows console that doesn't support Unicode well"""
    if platform.system() != "Windows":
        return False
    
    # Check if running in a terminal that supports Unicode
    if os.environ.get("WT_SESSION"):  # Windows Terminal
        return False
    if os.environ.get("TERM_PROGRAM") == "vscode":  # VS Code terminal
        return False
    
    # Check console encoding
    try:
        return sys.stdout.encoding.lower() in ['cp1252', 'cp437', 'ascii']
    except:
        return True

def safe_print(message: str) -> str:
    """Convert message to be safe for console output"""
    if not is_windows_console():
        return message
    
    # Remove common emojis used in the app
    emoji_replacements = {
        "[START]": "[STARTED]",
        "[OK]": "[OK]",
        "[ERROR]": "[ERROR]",
        "[WEB]": "[WEB]",
        "[DATA]": "[DATA]",
        "[HOME]": "[HOME]",
        "[HEALTH]": "[HEALTH]",
        "[LOG]": "[LOG]",
        "[MEMORY]": "[MEMORY]",
        "[CLEANUP]": "[CLEANUP]",
        "[WARNING]": "[WARNING]",
        "[SAVE]": "[SAVE]",
        "[SEARCH]": "[SEARCH]",
        "[FILE]": "[FILE]",
        "[SECURE]": "[SECURE]",
        "[KEY]": "[KEY]",
        "[EMAIL]": "[EMAIL]",
        "[SYNC]": "[SYNC]",
        "[TIME]": "[TIME]",
        "[TIP]": "[TIP]"
    }
    
    result = message
    for emoji, replacement in emoji_replacements.items():
        result = result.replace(emoji, replacement)
    
    return result

# Create a custom logger formatter for Windows
class SafeConsoleFormatter:
    """Formatter that removes emojis on Windows consoles"""
    def __init__(self, base_formatter):
        self.base_formatter = base_formatter
        
    def format(self, record):
        formatted = self.base_formatter.format(record)
        return safe_print(formatted)
        
    def __getattr__(self, name):
        # Delegate all other attributes to base formatter
        return getattr(self.base_formatter, name)