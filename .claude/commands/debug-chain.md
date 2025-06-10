# Debug Chain

Trace the complete execution path from UI interaction to backend processing.

## Execution Steps

1. Identify the starting point (button click, form submission, etc.)
2. Trace through:
   - React component event handler
   - Service layer API call
   - IPC communication (if Electron)
   - Backend route handler
   - Service implementation
   - Database/storage operations
3. Show each step with relevant code
4. Identify potential failure points

## Example Usage

```
/debug-chain form automation run button
```

This will show:
1. Button onClick handler in FormPrep.tsx
2. formService.runAutomation() call
3. IPC message to Electron main
4. API call to /api/form-automation/run
5. Backend route handler
6. AutomateForm.js implementation
7. Playwright browser automation