"""
Comprehensive Security Test Suite for FossaWork V2

This package contains security tests covering:
- Authentication bypass prevention
- Security headers verification
- N+1 query detection
- Input validation (XSS, SQL injection)
- Rate limiting and DDoS protection
- CORS configuration security
"""

from .test_authentication_bypass import TestAuthenticationBypass
from .test_security_headers import TestSecurityHeaders
from .test_n_plus_one_queries import TestNPlusOneQueries
from .test_input_validation import TestInputValidation
from .test_rate_limiting import TestRateLimiting
from .test_cors_configuration import TestCORSConfiguration

__all__ = [
    "TestAuthenticationBypass",
    "TestSecurityHeaders", 
    "TestNPlusOneQueries",
    "TestInputValidation",
    "TestRateLimiting",
    "TestCORSConfiguration",
]

# Version
__version__ = "1.0.0"