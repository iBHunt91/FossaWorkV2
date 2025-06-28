# PR Command

**What it does:** Creates a pull request on GitHub with all the proper checks and documentation.

**When to use it:**
- When your feature is ready for review
- After fixing a bug
- To merge changes to main branch

**How to use it:**
- `/pr` - Creates PR to main branch
- `/pr develop` - Creates PR to develop branch

**Example scenario:** You've finished implementing the new export feature. Type `/pr main` and Claude will update from main, run all tests, generate a PR description from your commits, and create the pull request on GitHub.

**What happens:**
1. 🔄 Updates from target branch
2. 🧪 Runs complete test suite
3. 📝 Generates PR description
4. 🎯 Creates PR via GitHub CLI
5. 👥 Adds reviewers
6. 🏷️ Adds appropriate labels

**Prerequisites:**
- GitHub CLI (`gh`) must be installed
- You must be authenticated with `gh auth login`

---

## Arguments

- `target` (optional): Target branch (default: "main")

## Content

I'll create a pull request to {{target}} branch.

<task>
1. Fetch and merge latest from {{target}} branch
2. Run full test suite to ensure no breaks
3. Check for merge conflicts
4. Generate PR description from commit messages
5. Include test results in PR description
6. Create pull request using gh CLI
7. Add appropriate labels (feature/fix/docs)
8. Assign reviewers if configured
9. Provide link to created PR
</task>