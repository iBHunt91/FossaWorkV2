# Claude Code SDK for Python - Usage Guide

## Overview

The Claude Code SDK for Python provides a programmatic interface to interact with Claude Code, enabling AI-powered code interactions and tool usage within Python applications. This allows you to integrate Claude's capabilities directly into your Python scripts and applications.

## Installation

```bash
# Standard installation
pip install claude-code-sdk

# macOS with Homebrew-managed Python
python3 -m pip install --user --break-system-packages claude-code-sdk
```

**Prerequisites:**
- Python 3.10 or higher
- Node.js (for the Claude Code CLI)
- Claude Code CLI: `npm install -g @anthropic-ai/claude-code`

## Quick Start

### Basic Usage

```python
import anyio
from claude_code_sdk import query

async def main():
    async for message in query(prompt="What is 2 + 2?"):
        print(message)

anyio.run(main)
```

### Processing Response Messages

```python
from claude_code_sdk import query, AssistantMessage, TextBlock

async def main():
    async for message in query(prompt="Hello Claude"):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    print(block.text)

anyio.run(main)
```

## Configuration Options

### ClaudeCodeOptions

Configure Claude's behavior with `ClaudeCodeOptions`:

```python
from claude_code_sdk import ClaudeCodeOptions

options = ClaudeCodeOptions(
    # Custom system prompt
    system_prompt="You are a helpful coding assistant",
    
    # Append to existing system prompt
    append_system_prompt="Always explain your code changes",
    
    # Maximum conversation turns
    max_turns=3,
    
    # Tools Claude can use
    allowed_tools=["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
    
    # Tools Claude cannot use
    disallowed_tools=["Bash"],
    
    # Permission handling mode
    permission_mode='acceptEdits',  # 'default', 'acceptEdits', or 'bypassPermissions'
    
    # Working directory
    cwd="/path/to/project",
    
    # Model selection
    model="claude-3-sonnet-20240229",
    
    # Continue previous conversation
    continue_conversation=True,
    
    # Resume from session ID
    resume="session_id_here",
    
    # Maximum thinking tokens
    max_thinking_tokens=8000,
    
    # MCP (Model Context Protocol) tools
    mcp_tools=["tool1", "tool2"],
    
    # MCP server configurations
    mcp_servers={
        "server_name": {
            "transport": ["node", "path/to/server.js"],
            "env": {"KEY": "value"}
        }
    }
)
```

## Tool Usage

### Available Tools

Claude Code can use various tools to interact with your filesystem and environment:

- **File Operations:** `Read`, `Write`, `Edit`, `MultiEdit`
- **Search Tools:** `Grep`, `Glob`, `LS`
- **System Tools:** `Bash`
- **Web Tools:** `WebFetch`, `WebSearch`
- **Task Management:** `TodoRead`, `TodoWrite`
- **Specialized:** `NotebookRead`, `NotebookEdit` (for Jupyter notebooks)

### File Operations Example

```python
from claude_code_sdk import query, ClaudeCodeOptions

async def create_python_file():
    options = ClaudeCodeOptions(
        allowed_tools=["Write", "Read", "Edit"],
        permission_mode='acceptEdits'  # Auto-accept file edits
    )
    
    prompt = """
    Create a Python file called calculator.py with functions for:
    1. Addition
    2. Subtraction
    3. Multiplication
    4. Division
    Include proper error handling.
    """
    
    async for message in query(prompt=prompt, options=options):
        # Process responses
        pass
```

### Code Analysis Example

```python
async def analyze_codebase():
    options = ClaudeCodeOptions(
        allowed_tools=["Read", "Grep", "Glob"],
        cwd="/path/to/project"
    )
    
    prompt = """
    Analyze the Python files in this project and:
    1. List all class definitions
    2. Find any TODO comments
    3. Identify potential security issues
    """
    
    async for message in query(prompt=prompt, options=options):
        # Process analysis results
        pass
```

## Message Types

### AssistantMessage

Contains Claude's responses with content blocks:

```python
from claude_code_sdk import AssistantMessage, TextBlock, ToolUseBlock

if isinstance(message, AssistantMessage):
    for block in message.content:
        if isinstance(block, TextBlock):
            print(f"Text: {block.text}")
        elif isinstance(block, ToolUseBlock):
            print(f"Tool: {block.name}")
            print(f"Input: {block.input}")
```

### ResultMessage

Contains cost and usage information:

```python
from claude_code_sdk import ResultMessage

if isinstance(message, ResultMessage):
    print(f"Cost: ${message.cost_usd:.4f}")
    print(f"Duration: {message.duration_ms}ms")
    print(f"API Duration: {message.duration_api_ms}ms")
    print(f"Total turns: {message.num_turns}")
    print(f"Session ID: {message.session_id}")
    if message.usage:
        print(f"Usage: {message.usage}")
```

### SystemMessage

Contains system-level information:

```python
from claude_code_sdk import SystemMessage

if isinstance(message, SystemMessage):
    print(f"System event: {message.subtype}")
    print(f"Data: {message.data}")
```

## Error Handling

The SDK provides specific error types for different failure scenarios:

```python
from claude_code_sdk import (
    ClaudeSDKError,      # Base error class
    CLINotFoundError,    # Claude Code CLI not installed
    CLIConnectionError,  # Connection issues
    ProcessError,        # Process execution failed
    CLIJSONDecodeError,  # JSON parsing issues
)

try:
    async for message in query(prompt="Hello"):
        # Process messages
        pass
except CLINotFoundError:
    print("Please install Claude Code CLI: npm install -g @anthropic-ai/claude-code")
except ProcessError as e:
    print(f"Process failed with exit code: {e.exit_code}")
    print(f"Stderr: {e.stderr}")
except CLIJSONDecodeError as e:
    print(f"Failed to parse response: {e}")
except CLIConnectionError as e:
    print(f"Connection error: {e}")
except ClaudeSDKError as e:
    print(f"SDK error: {e}")
```

## Advanced Usage

### Batch Processing

Process multiple files or tasks:

```python
async def batch_process_files():
    options = ClaudeCodeOptions(
        allowed_tools=["Read", "Write", "Edit"],
        permission_mode='acceptEdits'
    )
    
    files = ["file1.py", "file2.py", "file3.py"]
    
    for file in files:
        prompt = f"Add type hints to all functions in {file}"
        async for message in query(prompt=prompt, options=options):
            # Process each file
            pass
```

### Interactive Sessions

Continue conversations across multiple queries:

```python
async def interactive_session():
    options = ClaudeCodeOptions(
        continue_conversation=True,
        max_turns=10
    )
    
    # First query
    async for message in query(prompt="Create a todo list app structure", options=options):
        if isinstance(message, ResultMessage):
            session_id = message.session_id
    
    # Continue the conversation
    options.resume = session_id
    async for message in query(prompt="Now add a database schema", options=options):
        # Continue building on previous work
        pass
```

### Custom Tool Permissions

Fine-tune tool access:

```python
# Read-only analysis
read_only_options = ClaudeCodeOptions(
    allowed_tools=["Read", "Grep", "Glob", "LS"],
    disallowed_tools=["Write", "Edit", "Bash"]
)

# Full access with auto-approval
full_access_options = ClaudeCodeOptions(
    allowed_tools=["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
    permission_mode='bypassPermissions'
)

# Interactive mode (default)
interactive_options = ClaudeCodeOptions(
    allowed_tools=["Read", "Write", "Edit"],
    permission_mode='default'  # Prompts for each file change
)
```

## Integration with FossaWork V2

Example of using Claude Code SDK within the FossaWork V2 project:

```python
from claude_code_sdk import query, ClaudeCodeOptions
import asyncio

async def analyze_work_orders():
    """Use Claude to analyze work order patterns"""
    options = ClaudeCodeOptions(
        allowed_tools=["Read", "Grep"],
        cwd="/Users/ibhunt/Documents/GitHub/FossaWorkV2"
    )
    
    prompt = """
    Analyze the work order scraping implementation in backend/app/services/workfossa_scraper.py
    and identify:
    1. The main data extraction patterns
    2. Error handling approaches
    3. Potential improvements
    """
    
    async for message in query(prompt=prompt, options=options):
        # Process analysis
        pass

async def generate_test_cases():
    """Generate test cases for a service"""
    options = ClaudeCodeOptions(
        allowed_tools=["Read", "Write"],
        permission_mode='acceptEdits',
        cwd="/Users/ibhunt/Documents/GitHub/FossaWorkV2"
    )
    
    prompt = """
    Read backend/app/services/dispenser_scraper.py and create comprehensive
    test cases in tests/backend/services/test_dispenser_scraper.py
    """
    
    async for message in query(prompt=prompt, options=options):
        # Test generation
        pass
```

## Best Practices

1. **Error Handling:** Always wrap queries in try-except blocks
2. **Tool Selection:** Only enable tools that are needed for the task
3. **Permission Mode:** Use `acceptEdits` for automated scripts, `default` for interactive use
4. **Working Directory:** Always set `cwd` to ensure consistent file paths
5. **Message Processing:** Check message types before accessing properties
6. **Cost Monitoring:** Track costs using ResultMessage for budget management
7. **Session Management:** Save session IDs for continuing conversations

## Limitations

- Requires Claude Code CLI to be installed and accessible
- Async-only API (use `anyio.run()` or `asyncio.run()`)
- Tool availability depends on Claude Code permissions
- File operations are subject to filesystem permissions

## Additional Resources

- [Claude Code SDK Documentation](https://docs.anthropic.com/en/docs/claude-code/sdk)
- [Claude Code Security & Tools](https://docs.anthropic.com/en/docs/claude-code/security#tools-available-to-claude)
- [GitHub Repository](https://github.com/anthropics/claude-code-sdk-python)