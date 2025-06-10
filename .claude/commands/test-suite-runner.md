# Test Suite Runner

Run comprehensive test suites with detailed reporting.

## Execution Steps

1. Identify test suite to run based on $ARGUMENTS:
   - `unit`: Vitest unit tests for components/services
   - `form`: Form automation tests with Playwright
   - `batch`: Batch processing system tests
   - `integration`: Full system integration tests
   - `e2e`: End-to-end browser automation tests
   - `api`: API endpoint tests
   - `all`: Run all test suites
2. Set up test environment:
   - Check required dependencies
   - Start necessary services
   - Set test environment variables
   - Clear test data/logs
3. Configure test runners:
   - Set timeout values
   - Configure parallel execution
   - Set up test reporters
   - Enable coverage collection
4. Execute tests with options:
   - Run in watch mode for development
   - Generate coverage reports
   - Create JUnit XML for CI
   - Capture screenshots/videos
5. Handle test failures:
   - Retry flaky tests
   - Capture error screenshots
   - Preserve test artifacts
   - Generate debug logs
6. Generate comprehensive report:
   - Test summary statistics
   - Coverage percentages
   - Performance metrics
   - Failed test analysis
7. Suggest fixes for failures:
   - Common error patterns
   - Related code changes
   - Environment issues
8. Update test documentation

## Parameters
- `suite`: Test suite to run (unit/form/batch/integration/e2e/api/all)
- `--watch`: Run in watch mode
- `--coverage`: Generate coverage report
- `--headed`: Run browser tests in headed mode
- `--parallel`: Number of parallel workers
- `--retry`: Number of retries for failed tests

## Example Usage

```
/test-suite-runner suite=form --headed --retry=2
```

```
/test-suite-runner suite=all --coverage --parallel=4
```

## Test Suite Details

### Unit Tests (`npm test`)
- Component tests with React Testing Library
- Service layer tests
- Utility function tests
- Hook tests

### Form Tests (`npm run test:form`)
- Single form automation
- Batch form processing
- Error recovery scenarios
- Template validation

### Batch Tests (`npm run test:batch`)
- Queue management
- Concurrent processing
- Memory management
- Error handling

### Integration Tests
- API integration
- Database operations
- File system operations
- External service mocking

### E2E Tests
- Complete user workflows
- Multi-page interactions
- Authentication flows
- Data persistence