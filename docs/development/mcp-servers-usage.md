# MCP Servers Usage Documentation

## Overview

Model Context Protocol (MCP) servers extend Claude Code's capabilities by providing additional tools and functionality. This project currently uses multiple MCP servers for enhanced development workflow and automation capabilities.

## Available MCP Servers

### 1. Taskmaster AI (`taskmaster-ai`)
**Purpose:** Advanced task management and workflow automation
**Command:** `npx -y --package=task-master-ai task-master-ai`

**Features:**
- Intelligent task breakdown and planning
- Multi-LLM support (Anthropic, Perplexity, OpenAI, Google, Mistral, OpenRouter, XAI, Azure)
- Advanced workflow management

**Configuration:**
- Requires multiple API keys for different LLM providers
- Currently configured with Anthropic and Perplexity API keys
- Other providers require configuration

### 2. Context7 MCP (`context7-mcp`)
**Purpose:** Enhanced context management and code analysis
**Command:** `npx -y @smithery/cli@latest run @upstash/context7-mcp`

**Features:**
- Advanced context understanding
- Code analysis and suggestions
- Context-aware development assistance

**Configuration:**
- Uses Smithery key for authentication
- Requires active internet connection

### 3. Clear Thought (`clear-thought`)
**Purpose:** Structured thinking and problem-solving assistance
**Command:** `npx -y @smithery/cli@latest run @waldzellai/clear-thought`

**Features:**
- Step-by-step problem analysis
- Structured decision-making support
- Clear communication assistance

**Configuration:**
- Uses Smithery key for authentication
- Provides cognitive assistance tools

### 4. Sequential Thinking (`server-sequential-thinking`)
**Purpose:** Complex problem-solving through sequential analysis
**Command:** `npx -y @smithery/cli@latest run @smithery-ai/server-sequential-thinking`

**Features:**
- Multi-step problem breakdown
- Sequential reasoning support
- Complex task analysis

**Configuration:**
- Uses Smithery key for authentication
- Ideal for complex development challenges

### 5. Puppeteer MCP (`puppeteer`)
**Purpose:** Browser automation and web scraping
**Command:** `npx -y @smithery/cli@latest run @smithery-ai/puppeteer`

**Features:**
- Browser automation capabilities
- Web scraping and interaction
- Automated testing support

**Configuration:**
- Uses Smithery key for authentication
- Complements the project's existing Playwright automation

### 6. Playwright MCP (`playwright-mcp`)
**Purpose:** Advanced browser automation and testing
**Command:** `npx -y @smithery/cli@latest run @microsoft/playwright-mcp`

**Features:**
- Advanced browser automation
- Cross-browser testing support
- Web application testing
- Form automation (complements existing form automation system)

**Configuration:**
- Uses Smithery key for authentication
- Enhances the project's existing Playwright capabilities

### 7. Notion MCP (`notionApi`)
**Purpose:** Integration with Notion API for documentation and knowledge management
**Command:** `npx -y @notionhq/notion-mcp-server`

**Features:**
- Create, read, update pages in Notion
- Search Notion workspace content
- Manage Notion databases
- Add comments to pages
- Integrate project documentation with Notion

**Configuration:**
- Requires Notion Integration Token
- Token must have appropriate permissions for target pages/databases
- Configure in `.cursor/mcp.json` with Authorization header

## Usage Guidelines

### When to Use Each Server

**Taskmaster AI:**
- Complex project planning and task breakdown
- Multi-step workflow automation
- When you need advanced AI reasoning with multiple models

**Context7 MCP:**
- Code analysis and optimization
- Understanding complex codebases
- Context-aware development decisions

**Clear Thought / Sequential Thinking:**
- Complex problem-solving scenarios
- Architecture decisions
- Debugging complex issues

**Puppeteer / Playwright MCP:**
- Browser automation tasks
- Web scraping requirements
- Automated testing scenarios
- Form automation enhancements

**Notion MCP:**
- Documentation management
- Knowledge base integration
- Project notes and planning
- Team collaboration documentation
- Syncing project information with Notion workspace

### Best Practices

1. **Choose the Right Server:** Select MCP servers based on specific task requirements
2. **API Key Management:** Ensure all required API keys are properly configured
3. **Resource Management:** MCP servers consume additional resources; use judiciously
4. **Error Handling:** Monitor MCP server logs for connectivity or configuration issues
5. **Security:** Keep API keys secure and regularly rotate them

### Integration with Existing Systems

The MCP servers complement the project's existing capabilities:

- **Form Automation:** Playwright MCP enhances existing form automation (`backend/app/services/workfossa_automation.py`)
- **Web Scraping:** Puppeteer MCP can augment existing scraping (`backend/app/services/workfossa_scraper.py`)
- **Task Management:** Taskmaster AI works alongside the project's batch processing system
- **Development Workflow:** Context7 and thinking servers support the development process

### Troubleshooting

**Common Issues:**
1. **Connection Errors:** Check internet connectivity and API key validity
2. **Authentication Failures:** Verify Smithery keys and API credentials
3. **Performance Issues:** Consider disabling unused MCP servers
4. **Version Conflicts:** Ensure latest versions using `-y` flag with npx

**Diagnostic Commands:**
```bash
# Test MCP server connectivity
npx -y @smithery/cli@latest run [server-name] --test

# Check API key validity
echo $ANTHROPIC_API_KEY | head -c 20
```

### Platform Considerations

**Windows:**
- Uses `cmd /c` for command execution
- Ensure Windows Subsystem for Linux (WSL) compatibility if needed

**macOS/Linux:**
- Direct execution support
- May require different command structure (remove `cmd /c`)

## Security Notes

⚠️ **API Key Security:**
- API keys are currently stored in plain text in MCP configuration
- Consider using environment variables or secure credential storage
- Regularly rotate API keys for security

⚠️ **Network Security:**
- MCP servers make external network connections
- Ensure firewall rules allow necessary connections
- Monitor network traffic for unusual activity

## Configuration File Location

MCP server configuration is stored in:
- Primary: `/Users/ibhunt/FossaWorkV2/.cursor/mcp.json`
- Backup/History: `.history/.cursor/mcp_*.json`

## Related Documentation

- [Batch Automation System](/ai_docs/systems/batch-automation.md)
- [Form Automation](/ai_docs/systems/form-automation.md)
- [Browser Automation](/ai_docs/components/backend-services.md#browser-automation)
- [Development Workflow](/ai_docs/development/workflow-memory.md)