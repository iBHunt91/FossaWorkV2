# Context7 Tool

Context7 brings up-to-date library documentation directly into Claude's context to help create accurate, working code solutions.

## Usage

```
/context7 <library_name>
```

This command fetches the latest documentation for the specified library.

## Features

- Access current, version-specific documentation
- Get real code examples from official sources
- Ensure code solutions use the latest APIs
- Reduce errors by working with verified documentation
- Improve accuracy of code generation

## How It Works

When you use the Context7 command:

1. First, Claude resolves the library name to a valid Context7 library ID
2. Then, Claude fetches the latest documentation for that library
3. This documentation is integrated into Claude's context
4. Claude can now provide up-to-date code solutions based on this documentation
5. Claude saves important documentation to the `/ai_docs/reference/libraries/` directory

## Documentation Storage

All documentation retrieved through Context7 should be stored in the appropriate location within the `/ai_docs/` directory structure:

```
/ai_docs/
└── reference/
    └── libraries/
        └── [library_name]/
            ├── overview.md       # General library information
            ├── api.md            # API documentation
            ├── examples.md       # Code examples
            └── usage.md          # Usage patterns and best practices
```

This ensures documentation remains accessible across sessions and can be referenced by other team members.

## When to Use

- When working with external libraries or frameworks
- When you need the latest API documentation
- When you want to ensure code examples are current
- When implementing features that rely on third-party packages
- When you need clarity on library usage patterns

## Example

```
/context7 react
```

This would fetch the latest React documentation to help Claude generate accurate React code and store it in `/ai_docs/reference/libraries/react/` for future reference.