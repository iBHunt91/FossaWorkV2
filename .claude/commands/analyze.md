# Analyze Command

**What it does:** Performs a deep analysis of your code to find problems, security issues, or areas that need improvement.

**When to use it:**
- Before deploying to production
- When the system feels slow
- To find security vulnerabilities
- For code quality reviews

**How to use it:**
- `/analyze security` - Find security problems
- `/analyze performance` - Find slow code
- `/analyze quality` - General code quality

**Example scenario:** You're preparing for a security audit. Type `/analyze security` and Claude will scan for issues like plain text passwords, missing authentication, SQL injection risks, and generate a report with fixes.

**Analysis Types:**
- `security` - Password storage, API auth, input validation
- `performance` - Slow queries, memory leaks, bottlenecks
- `architecture` - Code organization, patterns, dependencies
- `dependencies` - Outdated packages, vulnerabilities
- `quality` - Code duplication, complexity, standards

---

## Arguments

- `target` (required): What aspect to analyze

## Content

I'll perform a {{target}} analysis of the codebase.

<task>
1. Scan relevant code for {{target}} concerns
2. Identify specific issues and anti-patterns
3. Check against best practices
4. Generate severity ratings (Critical/High/Medium/Low)
5. Create actionable recommendations
6. Provide code examples for fixes
7. Update documentation with findings
</task>