# Feature Command

**What it does:** Sets up all the files and structure needed for a new feature, saving you from creating everything manually.

**When to use it:**
- Starting a new feature
- Adding new functionality
- Creating new components

**How to use it:**
- `/feature user-reports` - Creates user reports feature
- `/feature export-csv` - Creates CSV export feature
- `/feature dashboard-charts` - Creates dashboard charts

**Example scenario:** You need to add a feature for exporting work orders to Excel. Type `/feature export-excel` and Claude will create the React component, API endpoint, tests, and documentation structure - all properly connected and ready for you to implement.

**What gets created:**
- 📁 Frontend component in `frontend/src/components/`
- 🔌 API endpoint in `backend/app/routes/`
- 🧪 Test files in `/tests/`
- 📚 Documentation stub
- 🌿 Feature branch
- ✅ TodoWrite tasks

---

## Arguments

- `name` (required): Feature name in kebab-case

## Content

I'll scaffold the "{{name}}" feature for you.

<task>
1. Create feature branch: feature/{{name}}
2. Generate React component structure
3. Create API route file with basic endpoints
4. Add database models if needed
5. Create test files for frontend and backend
6. Update route configurations
7. Add to navigation if UI feature
8. Create documentation template
9. Add implementation tasks to TodoWrite
10. Provide next steps for implementation
</task>