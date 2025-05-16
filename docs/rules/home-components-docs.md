---
HOME_COMPONENTS_DOCUMENTATION
---
description: Rule to ensure the home components documentation stays up-to-date whenever these files are modified
globs: src/components/home/**/*
filesToApplyRule: src/components/home/**/*.{tsx,ts}
alwaysApply: true
---

## Home Components Documentation Rule

This rule enforces that documentation for the home components is kept up-to-date as components are modified.

### Requirements

- The `src/components/home/README.md` file must exist and contain documentation for all home components
- When any file in `src/components/home` is modified, the documentation must be updated to reflect those changes
- Documentation should include:
  - Component purpose
  - Props interface
  - Key features
  - Component relationships

### Workflow Process

1. When modifying any home component, check if your changes affect the component's interface or functionality
2. If yes, update the corresponding section in `src/components/home/README.md`
3. Add the current date to the "Last Updated" section at the bottom of the README
4. Include documentation updates in the same commit as the component changes

### Validation

- Documentation should accurately reflect the current component implementation
- All components in the directory should be documented
- Props and their types should match the actual component interface
- Component relationships should be kept up-to-date

### Examples

Good documentation update:
```md
### SearchBar.tsx
A search input component with clear functionality.

**Props:**
- `searchQuery`: Current search text (string)
- `setSearchQuery`: Function to update search text (function)
- `placeholder`: Custom placeholder text (string, optional) - NEW

**Features:**
- Search input with clear button
- Custom placeholder support - NEW
- Keyboard shortcut support - NEW
```

### Additional Notes

- Major component refactoring should include corresponding documentation updates
- New components added to this directory must be documented in the README
- Always include propTypes and default values in documentation
