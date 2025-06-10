# Automate Form Test

Run comprehensive form automation tests for fuel dispenser forms.

## Execution Steps

1. Check current Playwright configuration in `/server/form-automation/`
2. Verify browser dependencies are installed for Windows
3. Create test data for form fields based on job parameters
4. Run form automation with specific parameters: $ARGUMENTS
5. Capture screenshots at key steps:
   - Login page
   - Form selection
   - Each dispenser section
   - Form submission
6. Generate detailed test report including:
   - Execution time
   - Success/failure status
   - Screenshot paths
   - Error messages
7. Handle errors with retry logic (max 3 attempts)
8. Update test results in `/data/automation-jobs/`

## Parameters
- `job-code`: The job code to test (e.g., 3002, 3146)
- `dispenser`: Dispenser number to test (1-10)
- `visit-type`: single or batch
- `--headed`: Run in headed mode (visible browser)
- `--slow-mo`: Delay between actions in ms

## Example Usage

```
/automate-form-test job-code=3002 dispenser=2 visit-type=single --headed --slow-mo=500
```

This will:
- Launch browser in headed mode with 500ms delays
- Navigate to AccuMeasure form system
- Login with stored credentials
- Select job code 3002
- Fill dispenser 2 with test data
- Take screenshots at each step
- Generate test report with timings

## Error Handling
- Automatically retries on timeout errors
- Captures full page screenshots on failure
- Logs detailed error messages
- Preserves browser context for debugging