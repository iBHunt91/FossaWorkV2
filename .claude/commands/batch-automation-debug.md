# Batch Automation Debug

Debug batch processing issues for form automation system.

## Execution Steps

1. Analyze batch processor logs in `/logs/` directory
2. Check current batch job status in `/data/automation-jobs/`
3. Monitor memory usage and performance metrics:
   - Node.js heap usage
   - Active browser instances
   - Process CPU usage
4. Identify stuck or failed jobs by checking:
   - Job start time vs current time
   - Last update timestamp
   - Error count and messages
5. Trace execution path through:
   - Batch queue management (`/server/form-automation/batchProcessor.js`)
   - Individual job processing (`/server/form-automation/FormProcessor.js`)
   - Error recovery mechanisms (`/server/form-automation/ErrorRecovery.js`)
6. Check for common issues:
   - Browser context leaks
   - Timeout configurations
   - Memory exhaustion
   - Network failures
7. Generate diagnostic report including:
   - Active jobs summary
   - Failed jobs analysis
   - Performance bottlenecks
   - Memory usage patterns
8. Suggest optimization strategies

## Parameters
- `job-id`: Specific job ID to debug
- `date-range`: Date range for analysis (e.g., "2025-01-19:2025-01-20")
- `status`: Filter by job status (active, failed, completed)
- `--verbose`: Include detailed execution traces

## Example Usage

```
/batch-automation-debug job-id=1748114545453
```

```
/batch-automation-debug status=failed date-range=today --verbose
```

## Common Issues and Solutions

### Memory Leaks
- Check for unclosed browser contexts
- Verify page.close() calls
- Monitor browser instance pool

### Stuck Jobs
- Check timeout configurations
- Verify network connectivity
- Review error recovery logic

### Performance Degradation
- Analyze batch size settings
- Check concurrent job limits
- Review browser instance reuse