# Refactor Component

Perform safe multi-file refactoring of React components.

## Execution Steps

1. Analyze target component: $ARGUMENTS
   - Current file location
   - Component structure
   - Props interface
   - Internal state/hooks
   - Dependencies
2. Find all usages across codebase:
   - Import statements
   - JSX usage
   - Props passing
   - Type references
   - Test files
3. Analyze refactoring requirements:
   - Current patterns used
   - Target pattern/structure
   - Breaking changes
   - Migration strategy
4. Check dependencies:
   - Context providers used
   - Custom hooks
   - Service connections
   - Store/state management
5. Create refactoring plan:
   - Step-by-step changes
   - File modifications
   - Import updates
   - Type changes
6. Execute refactoring:
   - Update component structure
   - Modify props interface
   - Update all imports
   - Fix TypeScript types
   - Update test files
7. Validate changes:
   - Run TypeScript compiler
   - Execute affected tests
   - Check ESLint rules
   - Verify functionality
8. Generate refactoring report:
   - Files modified
   - Patterns applied
   - Test results
   - Performance impact

## Parameters
- Component name or path
- `--pattern`: Target pattern (composition/container/hooks)
- `--dry-run`: Preview changes without applying
- `--update-tests`: Also update test files
- `--preserve-api`: Keep external API unchanged

## Example Usage

```
/refactor-component DispenserModal --pattern=composition
```

```
/refactor-component src/components/FilterBreakdown.jsx --pattern=hooks --update-tests
```

## Refactoring Patterns

### Composition Pattern
- Split into smaller components
- Use component composition
- Implement render props
- Create compound components

### Container Pattern
- Separate logic from presentation
- Create container/presenter split
- Move state management up
- Implement data fetching

### Hooks Pattern
- Convert class to function
- Extract custom hooks
- Use built-in hooks
- Implement hook composition

## Safety Checks
- Backup original files
- Verify no runtime errors
- Check bundle size impact
- Validate accessibility
- Test user interactions