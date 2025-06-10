# Generate API Docs

Create comprehensive API documentation from Express routes.

## Execution Steps

1. Scan all route files in `/server/routes/`:
   - api.js - Main API routes
   - formAutomation.js - Form automation endpoints
   - users.js - User management
   - settings.js - Settings endpoints
   - circleK.js - Circle K specific routes
   - logRoutes.js - Logging endpoints
2. Extract endpoint information:
   - HTTP methods (GET, POST, PUT, DELETE)
   - Route paths with parameters
   - Middleware requirements
   - Request body schemas
   - Response formats
   - Status codes
   - Error responses
3. Analyze authentication:
   - Public endpoints
   - Auth required endpoints
   - Permission levels
   - Token validation
4. Generate documentation formats:
   - OpenAPI 3.0 specification
   - Markdown documentation
   - Postman collection
   - Insomnia workspace
5. Include examples:
   - Sample requests
   - Response examples
   - Error scenarios
   - Authentication flow
6. Create interactive elements:
   - Try-it-out functionality
   - Code snippets (cURL, JS, Python)
   - SDK examples
7. Update documentation:
   - vibe_docs/api_design.md
   - Create versioned API docs
   - Update README with API section
8. Generate additional assets:
   - API changelog
   - Migration guides
   - Deprecation notices

## Parameters
- `--format`: Output format (openapi/markdown/postman/all)
- `--version`: API version to document
- `--include-internal`: Include internal endpoints
- `--base-url`: Base URL for examples

## Example Usage

```
/generate-api-docs --format=openapi --base-url=http://localhost:3001
```

```
/generate-api-docs --format=all --include-internal
```

## Documentation Structure

### Endpoint Documentation
```markdown
## GET /api/work-orders
Retrieve work orders with filtering

### Parameters
- startDate (query): ISO date string
- endDate (query): ISO date string
- status (query): active|completed|all

### Response
200 OK
{
  "orders": [...],
  "total": 150,
  "filtered": 42
}
```

### Authentication Section
- Bearer token authentication
- Session management
- Permission matrices
- Security best practices

### Error Handling
- Standard error format
- Common error codes
- Troubleshooting guide
- Rate limiting info