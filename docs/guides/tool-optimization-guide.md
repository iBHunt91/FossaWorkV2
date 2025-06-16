# Tool Optimization Guide for FossaWork V2

## Current Tool Inventory

### Core Claude Code Tools
- **File Operations:** Read, Write, Edit, MultiEdit
- **Search:** Grep, Glob, LS, Task (agent)
- **System:** Bash, WebFetch, WebSearch
- **Task Management:** TodoRead, TodoWrite

### MCP Servers
1. **Taskmaster AI** - Task management and multi-LLM workflows
2. **Context7** - Enhanced context and code analysis
3. **Sequential Thinking** - Complex problem-solving
4. **Playwright MCP** - Browser automation
5. **Notion MCP** - Documentation management

### Project-Specific Tools
- **Form Automation** - AccuMeasure, batch processing
- **Web Scraping** - WorkFossa, dispenser data
- **Claude Code SDK** - Python integration

## Optimization Strategies

### 1. Tool Integration Workflows

#### A. Documentation Sync Workflow
Combine Notion MCP + TodoWrite for automated documentation updates:

```python
# Example: Auto-document completed features
async def document_completed_feature():
    # 1. Check completed todos
    todos = await check_completed_todos()
    
    # 2. Generate documentation
    for todo in todos:
        if todo['priority'] == 'high' and 'feature' in todo['content']:
            # Use Claude SDK to analyze changes
            analysis = await analyze_feature_changes(todo)
            
            # Update Notion documentation
            await update_notion_docs(analysis)
            
            # Mark as documented
            await mark_documented(todo)
```

#### B. Automated Testing Workflow
Integrate Playwright MCP + Claude Code SDK:

```python
# Example: Generate and run tests automatically
async def auto_test_workflow():
    # 1. Use Claude SDK to generate test cases
    test_code = await generate_test_cases("backend/app/services/dispenser_scraper.py")
    
    # 2. Write test files
    await write_test_files(test_code)
    
    # 3. Use Playwright MCP to run browser tests
    await run_browser_tests()
    
    # 4. Report results
    await report_test_results()
```

### 2. Context Management Optimization

#### A. Smart Context Loading
Use Context7 strategically to reduce token usage:

```bash
# Before: Loading entire files
claude "explain this function" file.py

# After: Context7 targeted loading
# 1. Resolve library context first
mcp__context7__resolve-library-id "fastapi"
# 2. Get specific docs
mcp__context7__get-library-docs "/fastapi/fastapi" --topic "routing"
# 3. Now work with minimal context
```

#### B. Sequential Analysis Pattern
Combine Sequential Thinking + Task agent:

```python
# Complex debugging workflow
1. Use Sequential Thinking to break down the problem
2. Use Task agent to search for related issues
3. Apply fixes systematically
4. Verify with sequential validation
```

### 3. Automation Enhancements

#### A. Batch Operations with Progress
Enhance batch processing with better progress tracking:

```python
from claude_code_sdk import query, ClaudeCodeOptions

async def enhanced_batch_processor():
    options = ClaudeCodeOptions(
        allowed_tools=["Read", "Write", "Edit", "TodoWrite"],
        permission_mode='acceptEdits'
    )
    
    # Track progress in todos
    await create_batch_todos(work_orders)
    
    for order in work_orders:
        # Process with Claude SDK
        await process_with_claude(order, options)
        
        # Update todo status
        await update_todo_progress(order)
        
        # Send notifications
        await notify_progress(order)
```

#### B. Intelligent Scraping
Combine web scraping with Claude analysis:

```python
async def smart_scraper():
    # 1. Scrape data
    raw_data = await scrape_workfossa()
    
    # 2. Use Claude to analyze patterns
    patterns = await analyze_data_patterns(raw_data)
    
    # 3. Optimize future scraping
    await update_scraping_strategy(patterns)
```

### 4. Workflow Templates

#### A. Feature Development Template
```yaml
name: feature-development
steps:
  1. planning:
     - tool: TodoWrite
     - action: Create feature task list
  
  2. research:
     - tool: Context7
     - action: Load relevant library docs
     
  3. implementation:
     - tools: [Read, Write, Edit]
     - action: Implement feature
     
  4. testing:
     - tool: Claude SDK
     - action: Generate tests
     
  5. documentation:
     - tool: Notion MCP
     - action: Update docs
```

#### B. Bug Fix Template
```yaml
name: bug-fix
steps:
  1. analysis:
     - tool: Sequential Thinking
     - action: Break down the issue
     
  2. search:
     - tool: Task agent
     - action: Find related code
     
  3. fix:
     - tools: [Edit, MultiEdit]
     - action: Apply fixes
     
  4. verify:
     - tool: Playwright MCP
     - action: Run regression tests
```

### 5. Performance Optimizations

#### A. Parallel Tool Usage
```python
# Instead of sequential operations
await read_file1()
await read_file2()
await read_file3()

# Use concurrent operations
files = await asyncio.gather(
    read_file1(),
    read_file2(),
    read_file3()
)
```

#### B. Caching Strategies
```python
# Cache Context7 library resolutions
LIBRARY_CACHE = {}

async def get_library_docs_cached(library_name):
    if library_name not in LIBRARY_CACHE:
        library_id = await resolve_library_id(library_name)
        LIBRARY_CACHE[library_name] = library_id
    
    return await get_library_docs(LIBRARY_CACHE[library_name])
```

### 6. Tool Selection Matrix

| Task Type | Primary Tool | Supporting Tools | Notes |
|-----------|-------------|------------------|-------|
| Code Analysis | Context7 + Read | Sequential Thinking | Use Context7 for external libs |
| Bug Fixing | Task agent + Edit | Sequential Thinking | Task agent for searching |
| Feature Dev | TodoWrite + Write | Context7, Notion | Track progress systematically |
| Testing | Claude SDK + Playwright | Task agent | Automated test generation |
| Documentation | Notion MCP | Claude SDK | Keep in sync with code |
| Refactoring | MultiEdit | Sequential Thinking | Batch edits for efficiency |

### 7. Best Practices

1. **Tool Chaining**: Connect tool outputs to inputs
   ```
   Scrape → Analyze → Store → Notify
   ```

2. **Context Preservation**: Use session IDs in Claude SDK
   ```python
   options = ClaudeCodeOptions(
       continue_conversation=True,
       resume=session_id
   )
   ```

3. **Error Recovery**: Implement retry mechanisms
   ```python
   @retry(attempts=3, delay=1)
   async def resilient_operation():
       # Tool operations with automatic retry
   ```

4. **Progress Visibility**: Always use TodoWrite for multi-step tasks
   ```python
   # Start of any complex task
   await create_task_list()
   # Update as you progress
   await mark_task_complete()
   ```

5. **Documentation as Code**: Update docs in same commit
   ```bash
   # Good practice
   git add feature.py tests/test_feature.py docs/feature.md
   git commit -m "Add feature with tests and docs"
   ```

## Implementation Checklist

- [ ] Create workflow templates for common tasks
- [ ] Set up Context7 caching mechanism
- [ ] Implement Claude SDK integration scripts
- [ ] Create automated documentation sync
- [ ] Build parallel processing utilities
- [ ] Establish tool selection guidelines
- [ ] Document team workflows

## Monitoring and Improvement

1. **Track Tool Usage**: Log which tools are used most
2. **Measure Efficiency**: Time saved with optimizations
3. **Gather Feedback**: What workflows need improvement
4. **Iterate**: Continuously refine based on usage

## Quick Reference Commands

```bash
# Optimal file search pattern
mcp__context7__resolve-library-id "library-name"  # First
Read specific files  # Then read with context

# Efficient batch operations
Use TodoWrite to plan → Process in parallel → Update progress

# Smart documentation
Code changes → Claude SDK analysis → Notion MCP update

# Automated testing
Write code → Generate tests with SDK → Run with Playwright
```