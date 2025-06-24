# Comprehensive Security Test Suite

This directory contains a comprehensive security test suite for FossaWork V2, covering all critical security aspects of the application.

## 📋 Test Coverage

### 1. **Authentication Bypass Tests** (`test_authentication_bypass.py`)
- User isolation: Users cannot access other users' data
- Token manipulation prevention
- Path traversal in API endpoints
- Authorization header injection
- Concurrent access isolation
- SQL injection in authentication

### 2. **Security Headers Verification** (`test_security_headers.py`)
- X-Content-Type-Options (MIME sniffing)
- X-Frame-Options (Clickjacking)
- X-XSS-Protection (XSS for older browsers)
- Content-Security-Policy (CSP)
- Strict-Transport-Security (HSTS)
- Referrer-Policy
- Permissions-Policy
- Cache control on sensitive endpoints

### 3. **N+1 Query Detection** (`test_n_plus_one_queries.py`)
- Database query efficiency
- Eager loading verification
- Pagination performance
- Filtering optimization
- Index utilization
- Query performance benchmarks

### 4. **Input Validation Tests** (`test_input_validation.py`)
- XSS (Cross-Site Scripting) prevention
- SQL injection protection
- Command injection prevention
- Path traversal protection
- XXE (XML External Entity) prevention
- JSON injection protection
- Unicode bypass attempts
- Input length limits

### 5. **Rate Limiting Tests** (`test_rate_limiting.py`)
- Authentication endpoint limits (5/minute)
- API endpoint limits (60/minute)
- Scraping endpoint limits (10/minute)
- Brute force protection
- DDoS mitigation
- Per-IP rate limiting
- CORS headers on rate-limited responses

### 6. **CORS Configuration Tests** (`test_cors_configuration.py`)
- Preflight request handling
- Origin validation
- Credentials handling
- Method restrictions
- Header restrictions
- Error response CORS headers
- WebSocket CORS support

## 🚀 Running the Tests

### Run All Security Tests
```bash
# From the project root
cd /Users/ibhunt/Documents/GitHub/FossaWorkV2-security-fixes
python tests/backend/security/comprehensive/run_security_tests.py
```

### Run Specific Test Category
```bash
# Run only authentication tests
python tests/backend/security/comprehensive/run_security_tests.py auth

# Run only input validation tests
python tests/backend/security/comprehensive/run_security_tests.py input

# Available categories: auth, headers, n+1, input, rate, cors
```

### Run with Pytest Directly
```bash
# Run all security tests
pytest tests/backend/security/comprehensive/

# Run specific test file
pytest tests/backend/security/comprehensive/test_authentication_bypass.py

# Run with coverage
pytest tests/backend/security/comprehensive/ --cov=app --cov-report=html

# Run only critical tests
pytest tests/backend/security/comprehensive/ -m critical
```

## 📊 Test Results

Test results are automatically saved to JSON files with timestamps:
- `security_test_results_YYYYMMDD_HHMMSS.json`

The results include:
- Total tests run
- Pass/fail counts
- Test duration
- Security score (percentage)
- Detailed results per test module

## 🎯 Security Score

The security score is calculated as:
```
Security Score = (Passed Tests / Total Tests) × 100
```

Score interpretation:
- **100%**: 🏆 Excellent - All security tests passed
- **90-99%**: ✅ Good - Minor security issues to address
- **80-89%**: ⚠️ Fair - Several security issues need attention
- **70-79%**: 🚨 Poor - Significant security vulnerabilities present
- **<70%**: ❌ Critical - Major security overhaul required

## 🔧 Prerequisites

### Required Python Packages
```bash
pip install pytest pytest-asyncio fastapi sqlalchemy
```

### Environment Variables
The tests automatically set up required environment variables:
- `SECRET_KEY`: JWT secret key
- `FOSSAWORK_MASTER_KEY`: Encryption master key
- `DATABASE_URL`: Test database URL

## 🏗️ Test Architecture

### Fixtures (conftest.py)
- `test_db`: Fresh database for each test
- `client`: FastAPI test client
- `test_user`: Pre-created test user
- `auth_headers`: Authentication headers
- `malicious_payloads`: Common attack payloads

### Test Structure
Each test module follows this pattern:
1. Setup test environment
2. Create test data
3. Execute security tests
4. Verify security measures
5. Clean up

## 🔍 CI/CD Integration

### GitHub Actions Example
```yaml
name: Security Tests

on: [push, pull_request]

jobs:
  security-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.9'
    
    - name: Install dependencies
      run: |
        pip install -r backend/requirements.txt
        pip install pytest pytest-asyncio
    
    - name: Run Security Tests
      run: |
        python tests/backend/security/comprehensive/run_security_tests.py
    
    - name: Upload Results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: security-test-results
        path: tests/backend/security/comprehensive/security_test_results_*.json
```

## 🐛 Debugging Failed Tests

### Verbose Output
```bash
# Run with detailed output
pytest tests/backend/security/comprehensive/test_input_validation.py -vv

# Show print statements
pytest tests/backend/security/comprehensive/test_rate_limiting.py -s

# Stop on first failure
pytest tests/backend/security/comprehensive/ -x
```

### Common Issues
1. **Database Lock**: Ensure no other processes are using the test database
2. **Port Conflicts**: Check that test ports are available
3. **Environment Variables**: Verify test environment setup
4. **Async Issues**: Use pytest-asyncio for async tests

## 📈 Performance Benchmarks

Expected test execution times:
- Authentication tests: ~5 seconds
- Security headers: ~3 seconds
- N+1 queries: ~10 seconds
- Input validation: ~15 seconds
- Rate limiting: ~20 seconds
- CORS tests: ~5 seconds

Total suite: ~1 minute

## 🔒 Security Best Practices Tested

1. **Defense in Depth**: Multiple layers of security
2. **Least Privilege**: Users only access their own data
3. **Input Sanitization**: All inputs validated and sanitized
4. **Rate Limiting**: Protection against abuse
5. **Security Headers**: Browser security features enabled
6. **CORS**: Proper cross-origin restrictions
7. **Performance**: Efficient queries prevent DoS

## 🚨 When Tests Fail

If security tests fail:

1. **DO NOT IGNORE**: Security test failures indicate vulnerabilities
2. **Fix Immediately**: Address the root cause, not the test
3. **Document**: Record what was fixed and why
4. **Re-test**: Ensure all tests pass after fixes
5. **Review**: Have security fixes reviewed by team

## 📝 Adding New Security Tests

To add new security tests:

1. Create test file: `test_new_security_feature.py`
2. Import from `conftest.py` for fixtures
3. Follow naming convention: `test_specific_vulnerability()`
4. Add to `run_security_tests.py` test modules
5. Document in this README
6. Tag with appropriate pytest markers

Example:
```python
@pytest.mark.security
@pytest.mark.critical
def test_new_vulnerability(client, auth_headers, malicious_payloads):
    """Test description"""
    # Test implementation
    assert security_measure_works
```

## 🤝 Contributing

When contributing security tests:
- Write clear test descriptions
- Include both positive and negative cases
- Test edge cases and boundaries
- Document security implications
- Follow existing patterns

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [SQLAlchemy Security](https://docs.sqlalchemy.org/en/20/core/security.html)