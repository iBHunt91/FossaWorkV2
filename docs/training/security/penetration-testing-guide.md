# Penetration Testing Guide for FossaWork V2
*Security Assessment & Vulnerability Testing*

## Learning Objectives
By the end of this training, team members will:
- Understand penetration testing methodologies and ethics
- Execute comprehensive security assessments of FossaWork V2
- Identify and exploit common web application vulnerabilities
- Document findings with appropriate risk ratings
- Develop remediation recommendations
- Establish ongoing security testing practices

## Table of Contents
1. [Penetration Testing Overview](#penetration-testing-overview)
2. [Testing Methodology](#testing-methodology)
3. [FossaWork V2 Specific Testing](#fossawork-v2-specific-testing)
4. [Automated Vulnerability Scanning](#automated-vulnerability-scanning)
5. [Manual Testing Techniques](#manual-testing-techniques)
6. [Web Application Security Testing](#web-application-security-testing)
7. [API Security Testing](#api-security-testing)
8. [Database Security Testing](#database-security-testing)
9. [Infrastructure Testing](#infrastructure-testing)
10. [Reporting and Remediation](#reporting-and-remediation)

## Penetration Testing Overview

### Definition and Purpose
**Penetration Testing**: Authorized simulated cyber attack against FossaWork V2 to evaluate the security of the application, infrastructure, and business processes.

**Goals**:
- Identify exploitable vulnerabilities before attackers do
- Validate security controls and defenses
- Assess real-world attack scenarios
- Provide evidence-based security improvements
- Meet compliance requirements (SOC2, GDPR)

### Testing Types for FossaWork V2

#### White Box Testing (Full Knowledge)
- **Scope**: Complete access to source code, documentation, credentials
- **Benefits**: Comprehensive coverage, efficient testing
- **Use Case**: Internal security assessments, pre-deployment testing

#### Black Box Testing (No Knowledge)
- **Scope**: Only publicly available information
- **Benefits**: Realistic external attacker perspective
- **Use Case**: External security validation, compliance testing

#### Gray Box Testing (Partial Knowledge)
- **Scope**: Limited internal information (user credentials, network diagrams)
- **Benefits**: Balanced approach, realistic insider threat simulation
- **Use Case**: Regular security assessments, post-incident testing

### Legal and Ethical Considerations

#### Authorization Requirements
```python
# Penetration Testing Authorization Template
class PenetrationTestingAuthorization:
    def __init__(self):
        self.authorization = {
            "scope": {
                "in_scope": [
                    "https://fossawork-app.local",
                    "Backend API endpoints (localhost:8000)",
                    "Database (SQLite - development only)",
                    "User authentication system",
                    "Work order management features"
                ],
                "out_of_scope": [
                    "Production WorkFossa systems",
                    "Third-party services",
                    "Corporate network infrastructure",
                    "Other users' systems",
                    "Social engineering attacks"
                ]
            },
            "authorized_activities": [
                "Vulnerability scanning",
                "Authentication bypass attempts",
                "SQL injection testing",
                "XSS payload testing",
                "File upload security testing",
                "API endpoint enumeration"
            ],
            "prohibited_activities": [
                "Data destruction or corruption",
                "Denial of service attacks",
                "Privilege escalation beyond test accounts",
                "Access to production data",
                "Sharing of discovered vulnerabilities"
            ],
            "time_window": "Business hours only (9 AM - 5 PM)",
            "emergency_contact": "security@fossawork.com",
            "reporting_requirements": "Document all findings, provide remediation timeline"
        }
    
    def validate_test_activity(self, activity: str, target: str) -> bool:
        """Validate if testing activity is authorized"""
        
        # Check if target is in scope
        in_scope = any(target.startswith(scope_item) for scope_item in self.authorization["scope"]["in_scope"])
        
        # Check if activity is authorized
        activity_authorized = activity in self.authorization["authorized_activities"]
        
        # Check if activity is prohibited
        activity_prohibited = activity in self.authorization["prohibited_activities"]
        
        return in_scope and activity_authorized and not activity_prohibited
```

#### Ethical Guidelines
1. **Do No Harm**: Never damage, destroy, or corrupt data
2. **Respect Privacy**: Only access data necessary for security testing
3. **Follow Scope**: Stay within authorized testing boundaries
4. **Document Everything**: Maintain detailed logs of all activities
5. **Responsible Disclosure**: Report vulnerabilities through proper channels
6. **Protect Evidence**: Secure all testing artifacts and findings

## Testing Methodology

### OWASP Testing Guide Framework
Following OWASP Web Security Testing Guide v4.2 methodology:

#### Phase 1: Information Gathering
```bash
#!/bin/bash
# Information Gathering Script for FossaWork V2

echo "=== FOSSAWORK V2 INFORMATION GATHERING ==="

# 1. Application Fingerprinting
echo "1. Application Fingerprinting..."
curl -I http://localhost:8000 | grep -E "(Server|X-Powered-By|X-Frame-Options)"
curl -I http://localhost:3000 | grep -E "(Server|X-Powered-By|X-Frame-Options)"

# 2. Technology Stack Detection
echo "2. Technology Stack Detection..."
whatweb http://localhost:3000 2>/dev/null || echo "Whatweb not available"

# 3. Directory/File Enumeration
echo "3. Directory Enumeration..."
# Common directories for React/FastAPI applications
directories=(
    "api"
    "docs" 
    "admin"
    "config"
    "static"
    "assets"
    "health"
    "metrics"
    ".env"
    "robots.txt"
    "sitemap.xml"
)

for dir in "${directories[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/$dir")
    if [ "$response" != "404" ]; then
        echo "Found: /$dir (HTTP $response)"
    fi
done

# 4. API Endpoint Discovery
echo "4. API Endpoint Discovery..."
# Common API endpoints for FossaWork V2
api_endpoints=(
    "api/health"
    "api/auth/login"
    "api/work-orders"
    "api/dispensers"
    "api/automation"
    "api/settings"
    "api/notifications"
    "api/v1/logs"
    "api/filters"
)

for endpoint in "${api_endpoints[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/$endpoint")
    echo "API Endpoint: /$endpoint (HTTP $response)"
done

# 5. JavaScript Analysis
echo "5. JavaScript Analysis..."
# Download and analyze main JS files
if command -v linkfinder.py &> /dev/null; then
    linkfinder.py -i http://localhost:3000 -o cli
fi

echo "=== INFORMATION GATHERING COMPLETE ==="
```

#### Phase 2: Configuration and Deployment Management Testing
```python
class ConfigurationTesting:
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.frontend_url = "http://localhost:3000"
    
    def test_error_handling(self):
        """Test error handling and information disclosure"""
        test_cases = [
            # SQL injection attempts to trigger errors
            {"endpoint": "/api/work-orders/999999", "method": "GET"},
            {"endpoint": "/api/work-orders/'", "method": "GET"},
            {"endpoint": "/api/auth/login", "method": "POST", "data": {"invalid": "data"}},
            
            # File access attempts
            {"endpoint": "/etc/passwd", "method": "GET"},
            {"endpoint": "/../../../etc/passwd", "method": "GET"},
            {"endpoint": "/api/../../../etc/passwd", "method": "GET"},
            
            # Admin interface probing
            {"endpoint": "/admin", "method": "GET"},
            {"endpoint": "/api/admin", "method": "GET"},
            {"endpoint": "/dashboard", "method": "GET"},
        ]
        
        results = []
        for test in test_cases:
            try:
                response = requests.request(
                    test["method"],
                    f"{self.base_url}{test['endpoint']}",
                    json=test.get("data"),
                    timeout=5
                )
                
                result = {
                    "endpoint": test["endpoint"],
                    "status_code": response.status_code,
                    "response_length": len(response.content),
                    "error_disclosure": self.check_error_disclosure(response.text),
                    "stack_trace": "traceback" in response.text.lower()
                }
                results.append(result)
                
            except Exception as e:
                results.append({
                    "endpoint": test["endpoint"],
                    "error": str(e)
                })
        
        return results
    
    def check_error_disclosure(self, response_text: str) -> bool:
        """Check for sensitive information in error messages"""
        sensitive_patterns = [
            r'/Users/[^/]+/',           # File paths
            r'File ".*\.py"',           # Python file paths
            r'Traceback',               # Stack traces
            r'Exception.*:',            # Exception details
            r'database.*error',         # Database errors
            r'SQL.*error',              # SQL errors
            r'password',                # Password mentions
            r'secret',                  # Secret mentions
        ]
        
        for pattern in sensitive_patterns:
            if re.search(pattern, response_text, re.IGNORECASE):
                return True
        
        return False
    
    def test_security_headers(self):
        """Test for security headers"""
        response = requests.get(self.frontend_url)
        
        security_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": ["DENY", "SAMEORIGIN"],
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": None,  # Any value acceptable
            "Content-Security-Policy": None,    # Any value acceptable
            "Referrer-Policy": None            # Any value acceptable
        }
        
        results = {}
        for header, expected in security_headers.items():
            actual_value = response.headers.get(header)
            
            if expected is None:
                results[header] = {
                    "present": actual_value is not None,
                    "value": actual_value
                }
            elif isinstance(expected, list):
                results[header] = {
                    "present": actual_value in expected,
                    "value": actual_value,
                    "expected": expected
                }
            else:
                results[header] = {
                    "present": actual_value == expected,
                    "value": actual_value,
                    "expected": expected
                }
        
        return results
```

#### Phase 3: Identity Management Testing
```python
class AuthenticationTesting:
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.test_credentials = {
            "valid": {"username": "test_user", "password": "test_password"},
            "invalid": {"username": "invalid", "password": "wrong"}
        }
    
    def test_authentication_bypass(self):
        """Test for authentication bypass vulnerabilities"""
        
        bypass_attempts = [
            # SQL injection in authentication
            {"username": "admin'--", "password": "anything"},
            {"username": "admin' OR '1'='1'--", "password": ""},
            {"username": "admin", "password": "' OR '1'='1'--"},
            
            # NoSQL injection
            {"username": {"$ne": None}, "password": {"$ne": None}},
            
            # Empty/null values
            {"username": "", "password": ""},
            {"username": None, "password": None},
            
            # Common default credentials
            {"username": "admin", "password": "admin"},
            {"username": "admin", "password": "password"},
            {"username": "admin", "password": "123456"},
            {"username": "root", "password": "root"},
        ]
        
        results = []
        for attempt in bypass_attempts:
            try:
                response = requests.post(
                    f"{self.base_url}/api/auth/login",
                    json=attempt,
                    timeout=5
                )
                
                result = {
                    "attempt": attempt,
                    "status_code": response.status_code,
                    "success": response.status_code == 200,
                    "response_contains_token": "access_token" in response.text
                }
                
                if result["success"] or result["response_contains_token"]:
                    result["vulnerability"] = "CRITICAL: Authentication bypass possible"
                
                results.append(result)
                
            except Exception as e:
                results.append({
                    "attempt": attempt,
                    "error": str(e)
                })
        
        return results
    
    def test_session_management(self):
        """Test session management security"""
        
        # Get valid token
        login_response = requests.post(
            f"{self.base_url}/api/auth/login",
            json=self.test_credentials["valid"]
        )
        
        if login_response.status_code != 200:
            return {"error": "Could not obtain valid session for testing"}
        
        token = login_response.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        tests = {
            "token_in_url": self.test_token_in_url(token),
            "session_fixation": self.test_session_fixation(token),
            "concurrent_sessions": self.test_concurrent_sessions(),
            "session_timeout": self.test_session_timeout(headers),
            "logout_effectiveness": self.test_logout(headers)
        }
        
        return tests
    
    def test_token_in_url(self, token: str) -> dict:
        """Test if token can be passed in URL parameters"""
        
        # Attempt to use token as URL parameter
        response = requests.get(
            f"{self.base_url}/api/work-orders?token={token}"
        )
        
        return {
            "vulnerable": response.status_code == 200,
            "details": "Token accepted in URL parameter" if response.status_code == 200 else "Token not accepted in URL"
        }
    
    def test_brute_force_protection(self):
        """Test brute force protection mechanisms"""
        
        # Attempt multiple failed logins
        failed_attempts = 0
        lockout_detected = False
        
        for i in range(10):  # Try 10 failed attempts
            response = requests.post(
                f"{self.base_url}/api/auth/login",
                json={"username": "admin", "password": f"wrong_password_{i}"}
            )
            
            if response.status_code == 429:  # Rate limited
                lockout_detected = True
                break
            elif response.status_code == 401:
                failed_attempts += 1
            else:
                break
        
        return {
            "failed_attempts_before_lockout": failed_attempts,
            "lockout_detected": lockout_detected,
            "vulnerability": "No brute force protection" if not lockout_detected else None
        }
```

#### Phase 4: Input Validation Testing
```python
class InputValidationTesting:
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.test_payloads = self.load_test_payloads()
    
    def load_test_payloads(self):
        """Load common attack payloads"""
        return {
            "sql_injection": [
                "' OR '1'='1'--",
                "'; DROP TABLE work_orders;--",
                "' UNION SELECT 1,2,3,4,5--",
                "admin'/**/OR/**/1=1--",
                "1; DELETE FROM users WHERE 1=1--"
            ],
            "xss": [
                "<script>alert('XSS')</script>",
                "<img src=x onerror=alert('XSS')>",
                "javascript:alert('XSS')",
                "<svg onload=alert('XSS')>",
                "'\"><script>alert('XSS')</script>"
            ],
            "command_injection": [
                "; ls -la",
                "| cat /etc/passwd",
                "&& whoami",
                "`id`",
                "$(whoami)"
            ],
            "path_traversal": [
                "../../../etc/passwd",
                "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
                "....//....//....//etc/passwd",
                "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd"
            ],
            "ldap_injection": [
                "*)(uid=*))(|(uid=*",
                "*)(|(password=*))",
                "admin)(&(password=*))"
            ]
        }
    
    def test_work_order_injection(self):
        """Test work order creation for injection vulnerabilities"""
        
        results = []
        
        # Get authentication token first
        auth_response = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"username": "test_user", "password": "test_password"}
        )
        
        if auth_response.status_code != 200:
            return {"error": "Authentication failed for injection testing"}
        
        token = auth_response.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test each payload type
        for payload_type, payloads in self.test_payloads.items():
            for payload in payloads:
                test_data = {
                    "store_number": payload if payload_type in ["sql_injection", "command_injection"] else "1234",
                    "customer_name": payload if payload_type == "xss" else "Test Customer",
                    "service_code": 2861,
                    "instructions": payload if payload_type in ["xss", "command_injection"] else "Test instructions"
                }
                
                try:
                    response = requests.post(
                        f"{self.base_url}/api/work-orders/",
                        json=test_data,
                        headers=headers,
                        timeout=10
                    )
                    
                    result = {
                        "payload_type": payload_type,
                        "payload": payload,
                        "status_code": response.status_code,
                        "response_length": len(response.content),
                        "vulnerability_indicators": self.check_vulnerability_indicators(response, payload_type)
                    }
                    
                    results.append(result)
                    
                except Exception as e:
                    results.append({
                        "payload_type": payload_type,
                        "payload": payload,
                        "error": str(e)
                    })
        
        return results
    
    def check_vulnerability_indicators(self, response, payload_type: str) -> list:
        """Check response for vulnerability indicators"""
        
        indicators = []
        response_text = response.text.lower()
        
        if payload_type == "sql_injection":
            sql_errors = [
                "sql syntax",
                "mysql error",
                "sqlite error",
                "database error",
                "column.*doesn't exist",
                "table.*doesn't exist"
            ]
            
            for error in sql_errors:
                if re.search(error, response_text):
                    indicators.append(f"SQL error detected: {error}")
        
        elif payload_type == "xss":
            if response.status_code == 200 and any(xss in response_text for xss in ["<script>", "alert(", "javascript:"]):
                indicators.append("XSS payload reflected in response")
        
        elif payload_type == "command_injection":
            command_outputs = ["root:", "uid=", "gid=", "etc/passwd"]
            for output in command_outputs:
                if output in response_text:
                    indicators.append(f"Command execution output detected: {output}")
        
        # Check for timing-based injection (response time > 5 seconds)
        if hasattr(response, 'elapsed') and response.elapsed.total_seconds() > 5:
            indicators.append("Possible time-based injection (slow response)")
        
        return indicators
    
    def test_file_upload_vulnerabilities(self):
        """Test file upload functionality for security issues"""
        
        # Get authentication
        auth_response = requests.post(
            f"{self.base_url}/api/auth/login",
            json={"username": "test_user", "password": "test_password"}
        )
        
        if auth_response.status_code != 200:
            return {"error": "Authentication failed for file upload testing"}
        
        token = auth_response.json().get("access_token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test malicious file uploads
        malicious_files = [
            # Executable files
            ("malware.exe", b"MZ\x90\x00\x03\x00\x00\x00", "application/x-msdownload"),
            
            # Script files
            ("shell.php", b"<?php system($_GET['cmd']); ?>", "application/x-php"),
            ("script.jsp", b"<% Runtime.getRuntime().exec(request.getParameter(\"cmd\")); %>", "application/x-jsp"),
            
            # Path traversal
            ("../../../evil.txt", b"malicious content", "text/plain"),
            
            # Large files (DoS)
            ("large.txt", b"A" * (10 * 1024 * 1024), "text/plain"),  # 10MB
            
            # Zip bombs
            ("bomb.zip", self.create_zip_bomb(), "application/zip"),
        ]
        
        results = []
        
        for filename, content, mime_type in malicious_files:
            try:
                files = {"file": (filename, content, mime_type)}
                
                response = requests.post(
                    f"{self.base_url}/api/upload/",
                    files=files,
                    headers=headers,
                    timeout=30
                )
                
                result = {
                    "filename": filename,
                    "status_code": response.status_code,
                    "accepted": response.status_code == 200,
                    "response": response.text[:500] if response.text else ""
                }
                
                if result["accepted"]:
                    result["vulnerability"] = f"CRITICAL: Malicious file {filename} accepted"
                
                results.append(result)
                
            except Exception as e:
                results.append({
                    "filename": filename,
                    "error": str(e)
                })
        
        return results
    
    def create_zip_bomb(self) -> bytes:
        """Create a simple zip bomb for testing"""
        import zipfile
        import io
        
        # Create a zip file with highly compressed content
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add a file with repetitive content that compresses well
            zip_file.writestr("bomb.txt", "0" * (1024 * 1024))  # 1MB of zeros
        
        return zip_buffer.getvalue()
```

## Automated Vulnerability Scanning

### OWASP ZAP Integration
```python
class ZAPScanner:
    def __init__(self):
        self.zap_url = "http://localhost:8080"
        self.target_url = "http://localhost:3000"
        self.api_key = None  # Set if ZAP requires API key
    
    def start_zap_scan(self):
        """Start automated ZAP scan of FossaWork V2"""
        
        # ZAP API commands
        zap_commands = [
            # Spider the application
            f"curl '{self.zap_url}/JSON/spider/action/scan/?url={self.target_url}'",
            
            # Wait for spider to complete
            "sleep 30",
            
            # Active scan
            f"curl '{self.zap_url}/JSON/ascan/action/scan/?url={self.target_url}'",
            
            # Wait for active scan
            "sleep 60",
            
            # Generate report
            f"curl '{self.zap_url}/JSON/core/view/htmlreport/' > zap_report.html"
        ]
        
        scan_script = """#!/bin/bash
# Automated ZAP scan for FossaWork V2

echo "Starting ZAP scan of FossaWork V2..."

# Check if ZAP is running
if ! curl -s {zap_url}/JSON/core/view/version/ > /dev/null; then
    echo "Error: ZAP is not running on {zap_url}"
    echo "Start ZAP with: zap.sh -daemon -port 8080"
    exit 1
fi

# Configure ZAP
echo "Configuring ZAP for FossaWork V2..."

# Set target in scope
curl -s '{zap_url}/JSON/core/action/includeInContext/?contextName=Default&regex={target_url}.*'

# Configure authentication if needed
# curl -s '{zap_url}/JSON/authentication/action/setAuthenticationMethod/?contextId=0&authMethodName=formBasedAuthentication'

# Start spider
echo "Starting spider scan..."
spider_id=$(curl -s '{zap_url}/JSON/spider/action/scan/?url={target_url}' | jq -r '.scan')
echo "Spider scan ID: $spider_id"

# Monitor spider progress
while true; do
    progress=$(curl -s "{zap_url}/JSON/spider/view/status/?scanId=$spider_id" | jq -r '.status')
    echo "Spider progress: $progress%"
    if [ "$progress" = "100" ]; then
        break
    fi
    sleep 10
done

echo "Spider completed. Starting active scan..."

# Start active scan
scan_id=$(curl -s '{zap_url}/JSON/ascan/action/scan/?url={target_url}' | jq -r '.scan')
echo "Active scan ID: $scan_id"

# Monitor active scan progress
while true; do
    progress=$(curl -s "{zap_url}/JSON/ascan/view/status/?scanId=$scan_id" | jq -r '.status')
    echo "Active scan progress: $progress%"
    if [ "$progress" = "100" ]; then
        break
    fi
    sleep 30
done

echo "Active scan completed. Generating reports..."

# Generate HTML report
curl -s '{zap_url}/JSON/core/view/htmlreport/' > fossawork_zap_report.html

# Generate JSON report for processing
curl -s '{zap_url}/JSON/core/view/alerts/' > fossawork_zap_alerts.json

# Generate XML report
curl -s '{zap_url}/OTHER/core/other/xmlreport/' > fossawork_zap_report.xml

echo "ZAP scan complete. Reports generated:"
echo "- fossawork_zap_report.html"
echo "- fossawork_zap_alerts.json" 
echo "- fossawork_zap_report.xml"

# Process results
python3 process_zap_results.py fossawork_zap_alerts.json
        """.format(
            zap_url=self.zap_url,
            target_url=self.target_url
        )
        
        with open("zap_scan.sh", "w") as f:
            f.write(scan_script)
        
        os.chmod("zap_scan.sh", 0o755)
        
        return "zap_scan.sh"
    
    def process_zap_results(self, alerts_file: str):
        """Process ZAP scan results"""
        
        with open(alerts_file, 'r') as f:
            alerts_data = json.load(f)
        
        # Categorize alerts by risk level
        risk_categories = {
            "High": [],
            "Medium": [],
            "Low": [],
            "Informational": []
        }
        
        for alert in alerts_data.get("alerts", []):
            risk_level = alert.get("risk", "Informational")
            risk_categories[risk_level].append({
                "name": alert.get("alert"),
                "description": alert.get("desc"),
                "solution": alert.get("solution"),
                "instances": len(alert.get("instances", []))
            })
        
        # Generate summary report
        summary = {
            "scan_date": datetime.now().isoformat(),
            "total_alerts": len(alerts_data.get("alerts", [])),
            "risk_breakdown": {level: len(alerts) for level, alerts in risk_categories.items()},
            "detailed_findings": risk_categories
        }
        
        with open("zap_summary_report.json", "w") as f:
            json.dump(summary, f, indent=2)
        
        return summary
```

### Custom Security Scanner
```python
class FossaWorkSecurityScanner:
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.frontend_url = "http://localhost:3000"
        self.findings = []
    
    def run_comprehensive_scan(self):
        """Run comprehensive security scan"""
        
        print("Starting FossaWork V2 Security Scan...")
        
        # Information gathering
        self.findings.extend(self.scan_information_disclosure())
        
        # Authentication testing
        self.findings.extend(self.scan_authentication())
        
        # Input validation
        self.findings.extend(self.scan_input_validation())
        
        # Session management
        self.findings.extend(self.scan_session_management())
        
        # Business logic
        self.findings.extend(self.scan_business_logic())
        
        # Infrastructure
        self.findings.extend(self.scan_infrastructure())
        
        # Generate report
        return self.generate_security_report()
    
    def scan_information_disclosure(self):
        """Scan for information disclosure vulnerabilities"""
        
        findings = []
        
        # Check for exposed configuration files
        config_files = [
            ".env",
            "config.json",
            "package.json",
            "requirements.txt",
            "docker-compose.yml",
            ".git/config",
            "backup.sql",
            "database.db"
        ]
        
        for config_file in config_files:
            try:
                response = requests.get(f"{self.frontend_url}/{config_file}", timeout=5)
                if response.status_code == 200:
                    findings.append({
                        "type": "Information Disclosure",
                        "severity": "Medium",
                        "title": f"Exposed Configuration File: {config_file}",
                        "description": f"Configuration file {config_file} is accessible via web browser",
                        "url": f"{self.frontend_url}/{config_file}",
                        "recommendation": f"Block access to {config_file} in web server configuration"
                    })
            except:
                pass
        
        # Check for exposed database files
        db_files = ["fossawork_v2.db", "database.sqlite", "app.db"]
        for db_file in db_files:
            try:
                response = requests.get(f"{self.frontend_url}/{db_file}", timeout=5)
                if response.status_code == 200 and len(response.content) > 1000:
                    findings.append({
                        "type": "Information Disclosure",
                        "severity": "Critical",
                        "title": f"Exposed Database File: {db_file}",
                        "description": f"Database file {db_file} is downloadable via web browser",
                        "url": f"{self.frontend_url}/{db_file}",
                        "recommendation": "Immediately block access to database files"
                    })
            except:
                pass
        
        # Check error message disclosure
        error_endpoints = [
            "/api/work-orders/99999999",
            "/api/nonexistent",
            "/api/auth/login",  # with invalid data
        ]
        
        for endpoint in error_endpoints:
            try:
                if endpoint == "/api/auth/login":
                    response = requests.post(f"{self.base_url}{endpoint}", json={"invalid": "data"})
                else:
                    response = requests.get(f"{self.base_url}{endpoint}")
                
                if self.contains_sensitive_info(response.text):
                    findings.append({
                        "type": "Information Disclosure",
                        "severity": "Low",
                        "title": "Sensitive Information in Error Messages",
                        "description": "Error messages contain sensitive information like file paths or database details",
                        "url": f"{self.base_url}{endpoint}",
                        "recommendation": "Implement generic error messages for production"
                    })
            except:
                pass
        
        return findings
    
    def contains_sensitive_info(self, text: str) -> bool:
        """Check if text contains sensitive information"""
        
        sensitive_patterns = [
            r'/Users/[^/]+/',           # File paths
            r'File ".*\.py"',           # Python file paths
            r'Traceback',               # Stack traces
            r'database.*error',         # Database errors
            r'SQL.*error',              # SQL errors
        ]
        
        for pattern in sensitive_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        
        return False
    
    def scan_business_logic(self):
        """Scan for business logic vulnerabilities"""
        
        findings = []
        
        # Test privilege escalation
        # This would require creating test accounts with different privileges
        # and testing access to admin functions
        
        # Test data validation bypass
        # Test negative values, extreme values, etc.
        
        # Test workflow bypass
        # Can user skip required steps in work order process?
        
        return findings
    
    def generate_security_report(self):
        """Generate comprehensive security report"""
        
        # Group findings by severity
        severity_groups = {"Critical": [], "High": [], "Medium": [], "Low": [], "Informational": []}
        
        for finding in self.findings:
            severity = finding.get("severity", "Informational")
            severity_groups[severity].append(finding)
        
        # Calculate risk score
        risk_score = (
            len(severity_groups["Critical"]) * 10 +
            len(severity_groups["High"]) * 7 +
            len(severity_groups["Medium"]) * 4 +
            len(severity_groups["Low"]) * 1
        )
        
        report = {
            "scan_info": {
                "target": "FossaWork V2",
                "scan_date": datetime.now().isoformat(),
                "scanner": "FossaWork Security Scanner v1.0",
                "total_findings": len(self.findings)
            },
            "executive_summary": {
                "risk_score": risk_score,
                "risk_level": self.calculate_risk_level(risk_score),
                "critical_issues": len(severity_groups["Critical"]),
                "high_issues": len(severity_groups["High"]),
                "medium_issues": len(severity_groups["Medium"]),
                "low_issues": len(severity_groups["Low"])
            },
            "detailed_findings": severity_groups,
            "recommendations": self.generate_recommendations(severity_groups)
        }
        
        # Save report
        with open(f"fossawork_security_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json", "w") as f:
            json.dump(report, f, indent=2)
        
        return report
    
    def calculate_risk_level(self, risk_score: int) -> str:
        """Calculate overall risk level"""
        
        if risk_score >= 30:
            return "Critical"
        elif risk_score >= 20:
            return "High"
        elif risk_score >= 10:
            return "Medium"
        elif risk_score > 0:
            return "Low"
        else:
            return "Minimal"
    
    def generate_recommendations(self, severity_groups: dict) -> list:
        """Generate prioritized recommendations"""
        
        recommendations = []
        
        if severity_groups["Critical"]:
            recommendations.append({
                "priority": "Immediate",
                "action": "Address all Critical severity vulnerabilities immediately",
                "timeline": "24 hours"
            })
        
        if severity_groups["High"]:
            recommendations.append({
                "priority": "High",
                "action": "Implement fixes for High severity vulnerabilities",
                "timeline": "1 week"
            })
        
        # Add specific recommendations based on findings
        common_issues = self.identify_common_issues(severity_groups)
        for issue in common_issues:
            recommendations.append(issue)
        
        return recommendations
    
    def identify_common_issues(self, severity_groups: dict) -> list:
        """Identify common security issues"""
        
        all_findings = []
        for findings in severity_groups.values():
            all_findings.extend(findings)
        
        recommendations = []
        
        # Check for authentication issues
        auth_issues = [f for f in all_findings if "authentication" in f.get("title", "").lower()]
        if auth_issues:
            recommendations.append({
                "priority": "High",
                "action": "Implement proper authentication controls",
                "details": "Multiple authentication-related vulnerabilities found"
            })
        
        # Check for input validation issues
        input_issues = [f for f in all_findings if any(term in f.get("title", "").lower() 
                                                     for term in ["injection", "xss", "validation"])]
        if input_issues:
            recommendations.append({
                "priority": "High", 
                "action": "Implement comprehensive input validation",
                "details": "Multiple input validation vulnerabilities found"
            })
        
        return recommendations
```

## Manual Testing Techniques

### Authentication Testing Procedures
```python
class ManualAuthenticationTests:
    """Manual testing procedures for authentication vulnerabilities"""
    
    @staticmethod
    def test_password_policy():
        """Test password policy enforcement"""
        
        test_cases = [
            {"password": "123", "description": "Too short"},
            {"password": "password", "description": "Common password"},
            {"password": "12345678", "description": "Only numbers"},
            {"password": "abcdefgh", "description": "Only lowercase"},
            {"password": "ABCDEFGH", "description": "Only uppercase"},
            {"password": "Password1", "description": "Good password"}
        ]
        
        print("=== PASSWORD POLICY TESTING ===")
        print("Test each password during user registration/password change:")
        
        for i, test in enumerate(test_cases, 1):
            print(f"{i}. Password: '{test['password']}' ({test['description']})")
            print(f"   Expected: {'Accept' if test['password'] == 'Password1' else 'Reject'}")
            print(f"   Test URL: POST /api/auth/register")
            print(f"   Test Data: {{'username': 'test{i}', 'password': '{test['password']}'}}")
            print()
    
    @staticmethod
    def test_account_lockout():
        """Test account lockout mechanisms"""
        
        print("=== ACCOUNT LOCKOUT TESTING ===")
        print("1. Create test account: testuser / validpassword")
        print("2. Attempt login with wrong password multiple times:")
        
        for i in range(1, 11):
            print(f"   Attempt {i}: POST /api/auth/login")
            print(f"   Data: {{'username': 'testuser', 'password': 'wrong{i}'}}")
            print(f"   Record: Response code and timing")
        
        print("3. After lockout, attempt with correct password")
        print("4. Wait 15 minutes, attempt with correct password")
        print("5. Document lockout threshold and duration")
    
    @staticmethod
    def test_session_fixation():
        """Test for session fixation vulnerabilities"""
        
        print("=== SESSION FIXATION TESTING ===")
        print("1. Access application before authentication")
        print("2. Note any session tokens/cookies")
        print("3. Login with valid credentials")
        print("4. Check if session tokens changed after authentication")
        print("5. Vulnerability exists if tokens remain the same")
    
    @staticmethod
    def test_concurrent_sessions():
        """Test concurrent session handling"""
        
        print("=== CONCURRENT SESSION TESTING ===")
        print("1. Login with valid credentials in Browser 1")
        print("2. Login with same credentials in Browser 2") 
        print("3. Check if both sessions remain active")
        print("4. Perform actions in Browser 1")
        print("5. Check if Browser 2 session is still valid")
        print("6. Document concurrent session behavior")
```

### Input Validation Testing Procedures
```python
class ManualInputValidationTests:
    """Manual testing procedures for input validation"""
    
    @staticmethod
    def test_sql_injection_manual():
        """Manual SQL injection testing steps"""
        
        print("=== MANUAL SQL INJECTION TESTING ===")
        
        injection_points = [
            {
                "endpoint": "/api/work-orders/search",
                "parameter": "store_number",
                "method": "GET",
                "payloads": [
                    "1234' OR '1'='1'--",
                    "1234'; DROP TABLE work_orders;--",
                    "1234' UNION SELECT 1,2,3,4--"
                ]
            },
            {
                "endpoint": "/api/auth/login", 
                "parameter": "username",
                "method": "POST",
                "payloads": [
                    "admin'--",
                    "admin' OR '1'='1'--",
                    "' OR 1=1 LIMIT 1--"
                ]
            }
        ]
        
        for point in injection_points:
            print(f"\nTesting: {point['endpoint']}")
            print(f"Method: {point['method']}")
            print(f"Parameter: {point['parameter']}")
            
            for payload in point['payloads']:
                print(f"\nPayload: {payload}")
                if point['method'] == 'GET':
                    print(f"URL: {point['endpoint']}?{point['parameter']}={payload}")
                else:
                    print(f"POST Data: {{'{point['parameter']}': '{payload}'}}")
                print("Check for:")
                print("- Database error messages")
                print("- Unexpected data in response")
                print("- Application errors")
                print("- Response timing delays")
    
    @staticmethod
    def test_xss_manual():
        """Manual XSS testing procedures"""
        
        print("=== MANUAL XSS TESTING ===")
        
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
            "<svg onload=alert('XSS')>",
            "'\"><script>alert('XSS')</script>"
        ]
        
        test_fields = [
            {"endpoint": "/api/work-orders/", "field": "customer_name"},
            {"endpoint": "/api/work-orders/", "field": "instructions"},
            {"endpoint": "/api/settings/", "field": "notification_email"}
        ]
        
        for field in test_fields:
            print(f"\nTesting: {field['endpoint']} - {field['field']}")
            
            for payload in xss_payloads:
                print(f"\nPayload: {payload}")
                print(f"1. Submit payload in {field['field']} field")
                print(f"2. Save/submit the form")
                print(f"3. Navigate to page where data is displayed")
                print(f"4. Check if payload executes in browser")
                print(f"5. Check if payload is reflected in response")
    
    @staticmethod
    def test_file_upload_manual():
        """Manual file upload testing procedures"""
        
        print("=== MANUAL FILE UPLOAD TESTING ===")
        
        test_files = [
            {
                "name": "test.php",
                "content": "<?php echo 'PHP executed'; ?>",
                "type": "Script execution test"
            },
            {
                "name": "test.txt.php",
                "content": "<?php system($_GET['cmd']); ?>", 
                "type": "Double extension test"
            },
            {
                "name": "../../../evil.txt",
                "content": "Path traversal content",
                "type": "Path traversal test"
            },
            {
                "name": "large_file.txt",
                "content": "A" * (10 * 1024 * 1024),  # 10MB
                "type": "Large file DoS test"
            }
        ]
        
        print("File Upload Test Procedure:")
        print("1. Locate file upload functionality")
        print("2. For each test file:")
        
        for i, test_file in enumerate(test_files, 1):
            print(f"\n   Test {i}: {test_file['type']}")
            print(f"   File: {test_file['name']}")
            print(f"   Content size: {len(test_file['content'])} bytes")
            print(f"   Steps:")
            print(f"   - Create file with specified content")
            print(f"   - Attempt upload")
            print(f"   - Check if upload succeeds")
            print(f"   - If successful, check file location")
            print(f"   - Test direct access to uploaded file")
```

## Web Application Security Testing

### OWASP Top 10 Testing for FossaWork V2
```python
class OWASP_Top10_Testing:
    """Test for OWASP Top 10 vulnerabilities in FossaWork V2"""
    
    def test_a01_broken_access_control(self):
        """A01:2021 – Broken Access Control"""
        
        test_plan = {
            "vulnerability": "A01:2021 – Broken Access Control",
            "description": "Users can access data/functions they shouldn't",
            "fossawork_risks": [
                "User accessing other users' work orders",
                "Non-admin accessing admin functions", 
                "Horizontal privilege escalation",
                "Direct object reference vulnerabilities"
            ],
            "test_cases": [
                {
                    "test": "Horizontal privilege escalation",
                    "steps": [
                        "Login as User A",
                        "Note User A's work order IDs", 
                        "Login as User B",
                        "Attempt to access User A's work orders by ID",
                        "Check if access is denied"
                    ],
                    "expected": "Access should be denied",
                    "endpoints": ["/api/work-orders/{id}", "/api/settings/{user_id}"]
                },
                {
                    "test": "Admin function access",
                    "steps": [
                        "Login as regular user",
                        "Attempt to access admin endpoints",
                        "Try to modify system settings",
                        "Check for proper authorization"
                    ],
                    "expected": "All admin functions should be blocked",
                    "endpoints": ["/api/admin/*", "/api/users/*", "/api/system/*"]
                },
                {
                    "test": "Direct object reference",
                    "steps": [
                        "Login as user",
                        "Identify object IDs in requests",
                        "Modify IDs to access other objects",
                        "Test with sequential IDs"
                    ],
                    "expected": "Access should be restricted to owned objects",
                    "endpoints": ["All API endpoints with ID parameters"]
                }
            ]
        }
        
        return test_plan
    
    def test_a02_cryptographic_failures(self):
        """A02:2021 – Cryptographic Failures"""
        
        test_plan = {
            "vulnerability": "A02:2021 – Cryptographic Failures", 
            "description": "Inadequate protection of sensitive data",
            "fossawork_current_issues": [
                "CRITICAL: Plain text credential storage",
                "No encryption at rest for database",
                "Weak session management"
            ],
            "test_cases": [
                {
                    "test": "Credential storage encryption",
                    "steps": [
                        "Locate credential files (data/users/*/credentials.json)",
                        "Examine file contents",
                        "Check if passwords are encrypted",
                        "Verify encryption strength if present"
                    ],
                    "current_status": "FAIL - Plain text storage",
                    "remediation": "Implement AES-256 encryption"
                },
                {
                    "test": "Data transmission encryption",
                    "steps": [
                        "Monitor network traffic during login",
                        "Check if HTTPS is enforced",
                        "Verify no sensitive data in URLs",
                        "Test SSL/TLS configuration"
                    ],
                    "tools": ["Wireshark", "SSL Labs SSL Test", "testssl.sh"]
                },
                {
                    "test": "Database encryption",
                    "steps": [
                        "Examine SQLite database file",
                        "Check if database is encrypted",
                        "Test database access without application"
                    ],
                    "current_status": "FAIL - No encryption at rest"
                }
            ]
        }
        
        return test_plan
    
    def test_a03_injection(self):
        """A03:2021 – Injection"""
        
        test_plan = {
            "vulnerability": "A03:2021 – Injection",
            "description": "Malicious data sent to interpreter",
            "fossawork_injection_points": [
                "Work order creation/search",
                "User authentication",
                "Filter parameter processing",
                "Log search functionality"
            ],
            "test_cases": [
                {
                    "test": "SQL Injection in work orders",
                    "injection_points": [
                        "/api/work-orders/search?store_number=",
                        "/api/work-orders/ (POST data)",
                        "/api/dispensers/search?customer="
                    ],
                    "payloads": [
                        "' OR '1'='1'--",
                        "'; DROP TABLE work_orders;--",
                        "' UNION SELECT username,password FROM users--"
                    ],
                    "detection_methods": [
                        "Database error messages",
                        "Unexpected data in responses",
                        "Boolean-based blind testing",
                        "Time-based blind testing"
                    ]
                },
                {
                    "test": "NoSQL Injection (if MongoDB used)",
                    "payloads": [
                        "{'$ne': null}",
                        "{'$gt': ''}",
                        "{'$regex': '.*'}"
                    ]
                },
                {
                    "test": "Command Injection",
                    "injection_points": [
                        "File upload functionality",
                        "Export/import features",
                        "System settings"
                    ],
                    "payloads": [
                        "; ls -la",
                        "| cat /etc/passwd", 
                        "&& whoami",
                        "`id`"
                    ]
                }
            ]
        }
        
        return test_plan
    
    def test_a04_insecure_design(self):
        """A04:2021 – Insecure Design"""
        
        test_plan = {
            "vulnerability": "A04:2021 – Insecure Design",
            "description": "Missing or ineffective control design",
            "fossawork_design_issues": [
                "Insufficient rate limiting",
                "No account lockout mechanism", 
                "Weak session management",
                "Missing input validation layers"
            ],
            "test_cases": [
                {
                    "test": "Rate limiting effectiveness",
                    "steps": [
                        "Script rapid requests to login endpoint",
                        "Test API rate limiting", 
                        "Check for lockout mechanisms",
                        "Test bypass techniques"
                    ],
                    "tools": ["curl", "Python requests", "Burp Intruder"]
                },
                {
                    "test": "Business logic flaws",
                    "areas_to_test": [
                        "Work order approval process",
                        "User role assignments",
                        "Data export limitations",
                        "Concurrent access handling"
                    ]
                }
            ]
        }
        
        return test_plan
    
    def test_a05_security_misconfiguration(self):
        """A05:2021 – Security Misconfiguration"""
        
        test_plan = {
            "vulnerability": "A05:2021 – Security Misconfiguration",
            "description": "Insecure default configurations",
            "fossawork_configuration_checks": [
                "Debug mode in production",
                "Default credentials",
                "Unnecessary features enabled",
                "Missing security headers"
            ],
            "test_cases": [
                {
                    "test": "Debug mode detection",
                    "indicators": [
                        "Detailed error messages",
                        "Stack traces in responses",
                        "Development endpoints accessible",
                        "Console.log statements visible"
                    ]
                },
                {
                    "test": "Security headers",
                    "required_headers": [
                        "X-Content-Type-Options: nosniff",
                        "X-Frame-Options: DENY",
                        "X-XSS-Protection: 1; mode=block",
                        "Strict-Transport-Security",
                        "Content-Security-Policy"
                    ],
                    "test_url": "http://localhost:3000"
                },
                {
                    "test": "Unnecessary features",
                    "check_for": [
                        "Directory browsing enabled",
                        "Default test pages",
                        "Development tools accessible",
                        "Unused endpoints active"
                    ]
                }
            ]
        }
        
        return test_plan
```

## API Security Testing

### REST API Security Testing Framework
```python
class APISecurityTesting:
    def __init__(self):
        self.base_url = "http://localhost:8000/api"
        self.auth_token = None
    
    def test_api_authentication(self):
        """Test API authentication mechanisms"""
        
        test_results = []
        
        # Test 1: Unauthenticated access
        protected_endpoints = [
            "/work-orders/",
            "/dispensers/",
            "/automation/",
            "/settings/",
            "/notifications/"
        ]
        
        for endpoint in protected_endpoints:
            response = requests.get(f"{self.base_url}{endpoint}")
            
            result = {
                "endpoint": endpoint,
                "requires_auth": response.status_code == 401,
                "status_code": response.status_code,
                "vulnerability": None
            }
            
            if response.status_code == 200:
                result["vulnerability"] = "CRITICAL: Endpoint accessible without authentication"
            
            test_results.append(result)
        
        # Test 2: Token validation
        invalid_tokens = [
            "invalid_token",
            "Bearer invalid",
            "Bearer ",
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid.signature",  # Invalid JWT
            "Bearer token_with_wrong_format"
        ]
        
        for token in invalid_tokens:
            headers = {"Authorization": token}
            response = requests.get(f"{self.base_url}/work-orders/", headers=headers)
            
            test_results.append({
                "test": "Invalid token validation",
                "token": token[:20] + "...",
                "properly_rejected": response.status_code == 401,
                "status_code": response.status_code
            })
        
        return test_results
    
    def test_api_authorization(self):
        """Test API authorization controls"""
        
        # This requires setting up test users with different roles
        test_scenarios = [
            {
                "user_role": "regular_user",
                "test_endpoints": [
                    {"endpoint": "/admin/users/", "should_allow": False},
                    {"endpoint": "/admin/settings/", "should_allow": False},
                    {"endpoint": "/work-orders/", "should_allow": True},
                    {"endpoint": "/settings/personal/", "should_allow": True}
                ]
            },
            {
                "user_role": "admin_user", 
                "test_endpoints": [
                    {"endpoint": "/admin/users/", "should_allow": True},
                    {"endpoint": "/admin/settings/", "should_allow": True},
                    {"endpoint": "/work-orders/", "should_allow": True}
                ]
            }
        ]
        
        # Implementation would require test user creation
        return test_scenarios
    
    def test_api_input_validation(self):
        """Test API input validation"""
        
        validation_tests = []
        
        # Test work order creation with invalid data
        invalid_payloads = [
            # Missing required fields
            {"customer_name": "Test"},  # Missing store_number, service_code
            
            # Invalid data types
            {"store_number": "invalid", "service_code": "not_a_number"},
            
            # Boundary value testing
            {"store_number": "0000", "service_code": 0},  # Minimum values
            {"store_number": "9999", "service_code": 99999},  # Maximum values
            
            # Special characters
            {"customer_name": "<script>alert('xss')</script>"},
            {"instructions": "'; DROP TABLE work_orders; --"},
            
            # Extremely large values
            {"customer_name": "A" * 10000},
            {"instructions": "B" * 100000}
        ]
        
        for payload in invalid_payloads:
            try:
                response = requests.post(
                    f"{self.base_url}/work-orders/",
                    json=payload,
                    headers={"Authorization": f"Bearer {self.auth_token}"}
                )
                
                validation_tests.append({
                    "payload": str(payload)[:100] + "..." if len(str(payload)) > 100 else str(payload),
                    "status_code": response.status_code,
                    "properly_validated": response.status_code in [400, 422],
                    "response_excerpt": response.text[:200] if response.text else ""
                })
                
            except Exception as e:
                validation_tests.append({
                    "payload": str(payload)[:100],
                    "error": str(e)
                })
        
        return validation_tests
    
    def test_api_rate_limiting(self):
        """Test API rate limiting"""
        
        # Test rapid requests to login endpoint
        login_url = f"{self.base_url}/auth/login"
        rapid_requests = []
        
        start_time = time.time()
        for i in range(20):  # 20 rapid requests
            try:
                response = requests.post(
                    login_url,
                    json={"username": "test", "password": "test"},
                    timeout=5
                )
                
                rapid_requests.append({
                    "request_number": i + 1,
                    "status_code": response.status_code,
                    "timestamp": time.time() - start_time,
                    "rate_limited": response.status_code == 429
                })
                
                # Stop if rate limited
                if response.status_code == 429:
                    break
                    
            except Exception as e:
                rapid_requests.append({
                    "request_number": i + 1,
                    "error": str(e)
                })
        
        # Analyze results
        rate_limited_requests = [r for r in rapid_requests if r.get("rate_limited")]
        
        return {
            "total_requests": len(rapid_requests),
            "rate_limited_after": len(rate_limited_requests),
            "rate_limiting_active": len(rate_limited_requests) > 0,
            "detailed_results": rapid_requests
        }
    
    def test_api_data_exposure(self):
        """Test for excessive data exposure in API responses"""
        
        # Get a work order and check for excessive data
        response = requests.get(
            f"{self.base_url}/work-orders/",
            headers={"Authorization": f"Bearer {self.auth_token}"}
        )
        
        if response.status_code != 200:
            return {"error": "Could not retrieve work orders for testing"}
        
        work_orders = response.json()
        if not work_orders:
            return {"error": "No work orders available for testing"}
        
        # Analyze first work order for sensitive data exposure
        first_order = work_orders[0] if isinstance(work_orders, list) else work_orders
        
        # Check for potentially sensitive fields
        sensitive_fields = [
            "password", "secret", "token", "key", "hash",
            "ssn", "social_security", "credit_card", "payment"
        ]
        
        exposed_sensitive = []
        for field in first_order.keys():
            if any(sensitive in field.lower() for sensitive in sensitive_fields):
                exposed_sensitive.append(field)
        
        # Check for internal system fields
        internal_fields = [
            "created_by_id", "internal_notes", "system_flags",
            "debug_info", "raw_data", "metadata"
        ]
        
        exposed_internal = []
        for field in first_order.keys():
            if any(internal in field.lower() for internal in internal_fields):
                exposed_internal.append(field)
        
        return {
            "total_fields": len(first_order.keys()),
            "all_fields": list(first_order.keys()),
            "sensitive_fields_exposed": exposed_sensitive,
            "internal_fields_exposed": exposed_internal,
            "excessive_exposure": len(exposed_sensitive) > 0 or len(exposed_internal) > 0
        }
```

## Infrastructure Testing

### Network Security Testing
```bash
#!/bin/bash
# Network security testing script for FossaWork V2

echo "=== FOSSAWORK V2 NETWORK SECURITY TESTING ==="

# Port scanning
echo "1. Port Scanning..."
echo "Scanning localhost for open ports..."

# Basic port scan
if command -v nmap &> /dev/null; then
    nmap -sS -O localhost
else
    echo "nmap not available, using netstat..."
    netstat -tuln | grep LISTEN
fi

# Service enumeration
echo "2. Service Enumeration..."
echo "Frontend (React): Port 3000"
curl -I http://localhost:3000 2>/dev/null | head -5

echo "Backend (FastAPI): Port 8000" 
curl -I http://localhost:8000 2>/dev/null | head -5

# SSL/TLS testing (if HTTPS enabled)
echo "3. SSL/TLS Testing..."
if command -v testssl.sh &> /dev/null; then
    testssl.sh http://localhost:3000
    testssl.sh http://localhost:8000
else
    echo "testssl.sh not available"
    echo "Manual check: Verify HTTPS configuration"
fi

# Firewall testing
echo "4. Firewall Testing..."
echo "Checking for exposed services..."

# Test external accessibility
external_ports=(22 23 80 443 3000 8000 3306 5432)
for port in "${external_ports[@]}"; do
    if timeout 3 bash -c "</dev/tcp/localhost/$port" 2>/dev/null; then
        echo "Port $port is accessible"
    fi
done

echo "=== NETWORK TESTING COMPLETE ==="
```

### Infrastructure Configuration Assessment
```python
class InfrastructureAssessment:
    def __init__(self):
        self.findings = []
    
    def assess_docker_security(self):
        """Assess Docker configuration security"""
        
        if not self.is_docker_running():
            return {"status": "Docker not detected"}
        
        findings = []
        
        # Check for privileged containers
        try:
            result = subprocess.run(
                ["docker", "ps", "--format", "table {{.Names}}\t{{.Command}}"],
                capture_output=True, text=True
            )
            
            if "--privileged" in result.stdout:
                findings.append({
                    "severity": "High",
                    "issue": "Privileged container detected",
                    "recommendation": "Remove --privileged flag if not necessary"
                })
        except:
            pass
        
        # Check for containers running as root
        try:
            result = subprocess.run(
                ["docker", "exec", "fossawork_backend", "whoami"],
                capture_output=True, text=True
            )
            
            if result.stdout.strip() == "root":
                findings.append({
                    "severity": "Medium",
                    "issue": "Container running as root user",
                    "recommendation": "Create non-root user in container"
                })
        except:
            pass
        
        return {"findings": findings}
    
    def assess_file_permissions(self):
        """Assess file system permissions"""
        
        findings = []
        
        # Check sensitive file permissions
        sensitive_files = [
            "backend/.env",
            "backend/fossawork_v2.db",
            "backend/data/users/*/credentials.json"
        ]
        
        for file_pattern in sensitive_files:
            files = glob.glob(file_pattern)
            for file_path in files:
                try:
                    stat_info = os.stat(file_path)
                    permissions = oct(stat_info.st_mode)[-3:]
                    
                    # Check if file is world-readable
                    if permissions[2] in ['4', '5', '6', '7']:
                        findings.append({
                            "severity": "High",
                            "issue": f"World-readable sensitive file: {file_path}",
                            "permissions": permissions,
                            "recommendation": "chmod 600 for sensitive files"
                        })
                    
                    # Check if file is group-readable for credentials
                    if "credentials.json" in file_path and permissions[1] in ['4', '5', '6', '7']:
                        findings.append({
                            "severity": "Medium", 
                            "issue": f"Group-readable credentials file: {file_path}",
                            "permissions": permissions,
                            "recommendation": "chmod 600 for credential files"
                        })
                        
                except Exception as e:
                    findings.append({
                        "severity": "Low",
                        "issue": f"Could not check permissions for {file_path}",
                        "error": str(e)
                    })
        
        return {"findings": findings}
    
    def assess_database_security(self):
        """Assess database security configuration"""
        
        findings = []
        
        # Check SQLite database permissions
        db_path = "backend/fossawork_v2.db"
        if os.path.exists(db_path):
            try:
                stat_info = os.stat(db_path)
                permissions = oct(stat_info.st_mode)[-3:]
                
                if permissions != "600":
                    findings.append({
                        "severity": "High",
                        "issue": f"Database file permissions too permissive: {permissions}",
                        "recommendation": "chmod 600 for database file"
                    })
                
                # Check if database is encrypted
                with open(db_path, 'rb') as f:
                    header = f.read(16)
                    if header.startswith(b'SQLite format 3'):
                        findings.append({
                            "severity": "High",
                            "issue": "Database is not encrypted",
                            "recommendation": "Implement database encryption (SQLCipher)"
                        })
                        
            except Exception as e:
                findings.append({
                    "severity": "Medium",
                    "issue": f"Could not assess database security: {str(e)}"
                })
        
        return {"findings": findings}
    
    def is_docker_running(self):
        """Check if Docker is running"""
        try:
            result = subprocess.run(
                ["docker", "version"],
                capture_output=True, text=True
            )
            return result.returncode == 0
        except:
            return False
```

## Reporting and Remediation

### Penetration Testing Report Template
```python
class PenetrationTestingReport:
    def __init__(self):
        self.report_data = {
            "executive_summary": {},
            "scope_and_methodology": {},
            "findings": [],
            "risk_assessment": {},
            "remediation_recommendations": [],
            "technical_details": {},
            "appendices": {}
        }
    
    def generate_executive_summary(self, findings):
        """Generate executive summary"""
        
        # Count findings by severity
        severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
        for finding in findings:
            severity_counts[finding.get("severity", "Low")] += 1
        
        # Calculate overall risk score
        risk_score = (
            severity_counts["Critical"] * 10 +
            severity_counts["High"] * 7 +
            severity_counts["Medium"] * 4 +
            severity_counts["Low"] * 1
        )
        
        # Determine risk level
        if risk_score >= 30:
            risk_level = "Critical"
        elif risk_score >= 20:
            risk_level = "High"
        elif risk_score >= 10:
            risk_level = "Medium"
        else:
            risk_level = "Low"
        
        self.report_data["executive_summary"] = {
            "assessment_date": datetime.now().strftime("%B %d, %Y"),
            "target_application": "FossaWork V2",
            "overall_risk_level": risk_level,
            "total_findings": len(findings),
            "severity_breakdown": severity_counts,
            "key_findings": self.extract_key_findings(findings),
            "immediate_actions_required": self.get_immediate_actions(findings),
            "business_impact": self.assess_business_impact(risk_level)
        }
    
    def extract_key_findings(self, findings):
        """Extract most critical findings for executive summary"""
        
        critical_findings = [f for f in findings if f.get("severity") == "Critical"]
        high_findings = [f for f in findings if f.get("severity") == "High"]
        
        key_findings = []
        
        # Add all critical findings
        for finding in critical_findings[:3]:  # Top 3 critical
            key_findings.append({
                "title": finding.get("title"),
                "severity": "Critical",
                "impact": finding.get("business_impact", "High")
            })
        
        # Add top high findings if space
        remaining_slots = 5 - len(key_findings)
        for finding in high_findings[:remaining_slots]:
            key_findings.append({
                "title": finding.get("title"),
                "severity": "High", 
                "impact": finding.get("business_impact", "Medium")
            })
        
        return key_findings
    
    def get_immediate_actions(self, findings):
        """Get immediate actions required"""
        
        critical_findings = [f for f in findings if f.get("severity") == "Critical"]
        
        immediate_actions = []
        
        # Credential encryption (known critical issue)
        if any("credential" in f.get("title", "").lower() for f in critical_findings):
            immediate_actions.append({
                "action": "Encrypt stored credentials immediately",
                "timeline": "24 hours",
                "priority": "Critical"
            })
        
        # Authentication issues
        if any("authentication" in f.get("title", "").lower() for f in critical_findings):
            immediate_actions.append({
                "action": "Implement proper API authentication",
                "timeline": "48 hours",
                "priority": "Critical"
            })
        
        # SQL injection
        if any("injection" in f.get("title", "").lower() for f in critical_findings):
            immediate_actions.append({
                "action": "Fix SQL injection vulnerabilities",
                "timeline": "72 hours", 
                "priority": "Critical"
            })
        
        return immediate_actions
    
    def assess_business_impact(self, risk_level):
        """Assess business impact of findings"""
        
        impact_assessments = {
            "Critical": {
                "data_breach_risk": "High - Sensitive work order data and credentials at risk",
                "operational_impact": "Severe - Complete system compromise possible",
                "compliance_impact": "High - GDPR/SOC2 violations likely",
                "reputation_impact": "Severe - Customer trust and business relationships at risk"
            },
            "High": {
                "data_breach_risk": "Medium - Some data exposure possible",
                "operational_impact": "Moderate - Service disruption possible",
                "compliance_impact": "Medium - Some compliance requirements not met",
                "reputation_impact": "Moderate - Customer confidence may be affected"
            },
            "Medium": {
                "data_breach_risk": "Low - Limited exposure potential",
                "operational_impact": "Minor - Minimal service impact",
                "compliance_impact": "Low - Minor compliance gaps",
                "reputation_impact": "Low - Minimal reputation impact"
            },
            "Low": {
                "data_breach_risk": "Minimal - Very limited exposure",
                "operational_impact": "None - No service impact expected",
                "compliance_impact": "Minimal - Best practice improvements",
                "reputation_impact": "None - No reputation impact"
            }
        }
        
        return impact_assessments.get(risk_level, impact_assessments["Low"])
    
    def generate_remediation_plan(self, findings):
        """Generate prioritized remediation plan"""
        
        # Group findings by severity
        severity_groups = {"Critical": [], "High": [], "Medium": [], "Low": []}
        for finding in findings:
            severity = finding.get("severity", "Low")
            severity_groups[severity].append(finding)
        
        remediation_plan = []
        
        # Phase 1: Critical issues (0-1 week)
        if severity_groups["Critical"]:
            remediation_plan.append({
                "phase": "Phase 1 - Emergency Fixes",
                "timeline": "0-1 week",
                "priority": "Critical",
                "items": [
                    {
                        "title": finding.get("title"),
                        "effort": "High",
                        "complexity": "Medium",
                        "recommendation": finding.get("recommendation")
                    }
                    for finding in severity_groups["Critical"]
                ]
            })
        
        # Phase 2: High issues (1-4 weeks)
        if severity_groups["High"]:
            remediation_plan.append({
                "phase": "Phase 2 - Security Improvements",
                "timeline": "1-4 weeks",
                "priority": "High",
                "items": [
                    {
                        "title": finding.get("title"),
                        "effort": "Medium",
                        "complexity": "Medium",
                        "recommendation": finding.get("recommendation")
                    }
                    for finding in severity_groups["High"]
                ]
            })
        
        # Phase 3: Medium issues (1-3 months)
        if severity_groups["Medium"]:
            remediation_plan.append({
                "phase": "Phase 3 - Security Hardening",
                "timeline": "1-3 months",
                "priority": "Medium",
                "items": [
                    {
                        "title": finding.get("title"),
                        "effort": "Low",
                        "complexity": "Low",
                        "recommendation": finding.get("recommendation")
                    }
                    for finding in severity_groups["Medium"]
                ]
            })
        
        return remediation_plan
    
    def export_report(self, format="json"):
        """Export report in specified format"""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if format == "json":
            filename = f"fossawork_pentest_report_{timestamp}.json"
            with open(filename, "w") as f:
                json.dump(self.report_data, f, indent=2)
        
        elif format == "html":
            filename = f"fossawork_pentest_report_{timestamp}.html"
            html_content = self.generate_html_report()
            with open(filename, "w") as f:
                f.write(html_content)
        
        return filename
    
    def generate_html_report(self):
        """Generate HTML report"""
        
        html_template = """
<!DOCTYPE html>
<html>
<head>
    <title>FossaWork V2 Penetration Testing Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .critical { color: #ff0000; font-weight: bold; }
        .high { color: #ff6600; font-weight: bold; }
        .medium { color: #ffaa00; font-weight: bold; }
        .low { color: #00aa00; font-weight: bold; }
        .section { margin: 20px 0; }
        .finding { margin: 15px 0; padding: 10px; border-left: 4px solid #ccc; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>FossaWork V2 Penetration Testing Report</h1>
    
    <div class="section">
        <h2>Executive Summary</h2>
        <p><strong>Assessment Date:</strong> {assessment_date}</p>
        <p><strong>Overall Risk Level:</strong> <span class="{risk_class}">{risk_level}</span></p>
        <p><strong>Total Findings:</strong> {total_findings}</p>
        
        <h3>Severity Breakdown</h3>
        <table>
            <tr><th>Severity</th><th>Count</th></tr>
            <tr><td class="critical">Critical</td><td>{critical_count}</td></tr>
            <tr><td class="high">High</td><td>{high_count}</td></tr>
            <tr><td class="medium">Medium</td><td>{medium_count}</td></tr>
            <tr><td class="low">Low</td><td>{low_count}</td></tr>
        </table>
    </div>
    
    <div class="section">
        <h2>Key Findings</h2>
        {key_findings_html}
    </div>
    
    <div class="section">
        <h2>Immediate Actions Required</h2>
        {immediate_actions_html}
    </div>
    
    <div class="section">
        <h2>Detailed Findings</h2>
        {detailed_findings_html}
    </div>
    
</body>
</html>
        """
        
        # Populate template variables
        summary = self.report_data["executive_summary"]
        
        # Generate HTML sections
        key_findings_html = ""
        for finding in summary.get("key_findings", []):
            severity_class = finding["severity"].lower()
            key_findings_html += f'<div class="finding"><span class="{severity_class}">{finding["severity"]}</span>: {finding["title"]}</div>'
        
        immediate_actions_html = ""
        for action in summary.get("immediate_actions_required", []):
            immediate_actions_html += f'<div class="finding"><strong>{action["action"]}</strong><br>Timeline: {action["timeline"]}</div>'
        
        detailed_findings_html = ""
        for finding in self.report_data.get("findings", []):
            severity_class = finding.get("severity", "low").lower()
            detailed_findings_html += f'''
            <div class="finding">
                <h4><span class="{severity_class}">{finding.get("severity", "Low")}</span>: {finding.get("title", "Unknown")}</h4>
                <p><strong>Description:</strong> {finding.get("description", "No description")}</p>
                <p><strong>Recommendation:</strong> {finding.get("recommendation", "No recommendation")}</p>
            </div>
            '''
        
        return html_template.format(
            assessment_date=summary.get("assessment_date", "Unknown"),
            risk_level=summary.get("overall_risk_level", "Unknown"),
            risk_class=summary.get("overall_risk_level", "low").lower(),
            total_findings=summary.get("total_findings", 0),
            critical_count=summary.get("severity_breakdown", {}).get("Critical", 0),
            high_count=summary.get("severity_breakdown", {}).get("High", 0),
            medium_count=summary.get("severity_breakdown", {}).get("Medium", 0),
            low_count=summary.get("severity_breakdown", {}).get("Low", 0),
            key_findings_html=key_findings_html,
            immediate_actions_html=immediate_actions_html,
            detailed_findings_html=detailed_findings_html
        )
```

## Training Exercises and Scenarios

### Practical Penetration Testing Lab
```python
class PenetrationTestingLab:
    """Hands-on penetration testing exercises"""
    
    def __init__(self):
        self.lab_exercises = self.create_lab_exercises()
    
    def create_lab_exercises(self):
        """Create progressive penetration testing exercises"""
        
        return [
            {
                "exercise_number": 1,
                "title": "Information Gathering and Reconnaissance",
                "difficulty": "Beginner",
                "estimated_time": "30 minutes",
                "objectives": [
                    "Perform passive information gathering",
                    "Identify application technologies",
                    "Map application structure",
                    "Discover hidden endpoints"
                ],
                "tasks": [
                    {
                        "task": "Technology Fingerprinting",
                        "instructions": [
                            "Use curl to examine HTTP headers",
                            "Identify frontend and backend technologies",
                            "Note version information if available"
                        ],
                        "commands": [
                            "curl -I http://localhost:3000",
                            "curl -I http://localhost:8000/docs"
                        ],
                        "expected_findings": [
                            "React frontend on port 3000",
                            "FastAPI backend on port 8000",
                            "API documentation endpoint"
                        ]
                    },
                    {
                        "task": "Directory and Endpoint Discovery",
                        "instructions": [
                            "Use dirb or manual testing to find directories",
                            "Test common API endpoints",
                            "Document all discovered URLs"
                        ],
                        "tools": ["dirb", "gobuster", "manual testing"],
                        "wordlists": ["/usr/share/wordlists/dirb/common.txt"]
                    }
                ],
                "deliverables": [
                    "Technology stack documentation",
                    "Application map with all discovered endpoints",
                    "Initial attack surface assessment"
                ]
            },
            {
                "exercise_number": 2,
                "title": "Authentication Security Testing",
                "difficulty": "Intermediate",
                "estimated_time": "45 minutes",
                "objectives": [
                    "Test authentication mechanisms",
                    "Identify authentication bypass vulnerabilities",
                    "Assess session management security"
                ],
                "tasks": [
                    {
                        "task": "Brute Force Testing",
                        "instructions": [
                            "Test account lockout mechanisms",
                            "Attempt brute force attacks",
                            "Measure response times"
                        ],
                        "setup": [
                            "Create test account: testuser/password123",
                            "Prepare list of common passwords"
                        ],
                        "tools": ["hydra", "custom Python script"],
                        "success_criteria": [
                            "Identify if lockout exists",
                            "Determine lockout threshold",
                            "Document timing differences"
                        ]
                    },
                    {
                        "task": "SQL Injection in Authentication",
                        "instructions": [
                            "Test SQL injection in login form",
                            "Try authentication bypass payloads",
                            "Document any database errors"
                        ],
                        "payloads": [
                            "admin'--",
                            "admin' OR '1'='1'--",
                            "' OR 1=1 LIMIT 1--"
                        ]
                    }
                ]
            },
            {
                "exercise_number": 3,
                "title": "Input Validation and Injection Testing",
                "difficulty": "Advanced",
                "estimated_time": "60 minutes",
                "objectives": [
                    "Identify and exploit injection vulnerabilities",
                    "Test all input vectors",
                    "Demonstrate impact of successful exploits"
                ],
                "tasks": [
                    {
                        "task": "Comprehensive SQL Injection Testing",
                        "instructions": [
                            "Test all input fields for SQL injection",
                            "Use both error-based and blind techniques",
                            "Attempt data extraction"
                        ],
                        "test_points": [
                            "Work order creation form",
                            "Search functionality",
                            "Filter parameters",
                            "URL parameters"
                        ],
                        "techniques": [
                            "Error-based injection",
                            "Boolean-based blind injection",
                            "Time-based blind injection",
                            "Union-based injection"
                        ]
                    },
                    {
                        "task": "Cross-Site Scripting (XSS) Testing",
                        "instructions": [
                            "Test for reflected XSS in all input fields",
                            "Test for stored XSS in persistent data",
                            "Create proof-of-concept payloads"
                        ],
                        "payloads": [
                            "<script>alert('XSS')</script>",
                            "<img src=x onerror=alert('XSS')>",
                            "javascript:alert('XSS')"
                        ]
                    }
                ]
            }
        ]
    
    def run_exercise(self, exercise_number):
        """Run specific lab exercise"""
        
        exercise = next((ex for ex in self.lab_exercises if ex["exercise_number"] == exercise_number), None)
        
        if not exercise:
            return {"error": f"Exercise {exercise_number} not found"}
        
        print(f"=== EXERCISE {exercise_number}: {exercise['title']} ===")
        print(f"Difficulty: {exercise['difficulty']}")
        print(f"Estimated Time: {exercise['estimated_time']}")
        print()
        
        print("OBJECTIVES:")
        for obj in exercise["objectives"]:
            print(f"  - {obj}")
        print()
        
        print("TASKS:")
        for i, task in enumerate(exercise["tasks"], 1):
            print(f"{i}. {task['task']}")
            
            if "instructions" in task:
                print("   Instructions:")
                for instruction in task["instructions"]:
                    print(f"     - {instruction}")
            
            if "commands" in task:
                print("   Commands to run:")
                for command in task["commands"]:
                    print(f"     $ {command}")
            
            if "payloads" in task:
                print("   Test payloads:")
                for payload in task["payloads"]:
                    print(f"     {payload}")
            
            print()
        
        print("DELIVERABLES:")
        for deliverable in exercise["deliverables"]:
            print(f"  - {deliverable}")
        
        return exercise

# Interactive penetration testing trainer
def interactive_pentest_trainer():
    """Interactive penetration testing training"""
    
    lab = PenetrationTestingLab()
    
    print("=== FOSSAWORK V2 PENETRATION TESTING LAB ===")
    print("Available exercises:")
    
    for exercise in lab.lab_exercises:
        print(f"{exercise['exercise_number']}. {exercise['title']} ({exercise['difficulty']})")
    
    print()
    exercise_num = input("Select exercise number (1-3): ")
    
    try:
        lab.run_exercise(int(exercise_num))
    except ValueError:
        print("Invalid exercise number")

# Run interactive trainer
if __name__ == "__main__":
    interactive_pentest_trainer()
```

## Assessment and Certification

### Penetration Testing Competency Assessment
```python
class PenetrationTestingAssessment:
    def __init__(self):
        self.assessment_criteria = {
            "methodology": {
                "weight": 25,
                "subcriteria": {
                    "planning_and_scoping": 5,
                    "information_gathering": 5,
                    "vulnerability_identification": 5,
                    "exploitation": 5,
                    "post_exploitation": 5
                }
            },
            "technical_skills": {
                "weight": 35,
                "subcriteria": {
                    "manual_testing": 10,
                    "tool_usage": 10,
                    "vulnerability_analysis": 10,
                    "exploit_development": 5
                }
            },
            "reporting": {
                "weight": 25,
                "subcriteria": {
                    "finding_documentation": 10,
                    "risk_assessment": 5,
                    "remediation_recommendations": 10
                }
            },
            "ethics_and_professionalism": {
                "weight": 15,
                "subcriteria": {
                    "scope_adherence": 5,
                    "data_protection": 5,
                    "responsible_disclosure": 5
                }
            }
        }
    
    def practical_assessment(self):
        """Practical penetration testing assessment"""
        
        return {
            "scenario": "FossaWork V2 Security Assessment",
            "time_limit": "4 hours",
            "requirements": [
                "Perform comprehensive security assessment",
                "Document all findings with evidence",
                "Provide risk ratings and remediation advice",
                "Present findings to stakeholders"
            ],
            "evaluation_criteria": [
                "Thoroughness of testing",
                "Quality of vulnerability identification",
                "Accuracy of risk assessment", 
                "Clarity of reporting",
                "Professional presentation"
            ],
            "deliverables": [
                "Executive summary report",
                "Technical findings documentation",
                "Remediation roadmap",
                "Presentation slides"
            ],
            "minimum_score": 80
        }

### Knowledge Assessment Questions
1. What are the phases of penetration testing methodology?
2. How do you test for SQL injection vulnerabilities?
3. What is the difference between authentication and authorization testing?
4. How do you assess the business impact of security findings?
5. What are the ethical considerations in penetration testing?
6. How do you test for XSS vulnerabilities?
7. What tools would you use for automated vulnerability scanning?
8. How do you prioritize security findings for remediation?
9. What is the difference between black box and white box testing?
10. How do you test API security?

### Certification Requirements
- [ ] Complete all training modules with 85% minimum score
- [ ] Successfully complete hands-on lab exercises
- [ ] Conduct supervised penetration test of FossaWork V2
- [ ] Produce professional penetration testing report
- [ ] Present findings to technical and business stakeholders
- [ ] Demonstrate ethical hacking principles
- [ ] Stay current with security vulnerabilities and techniques

---

**Remember**: 
- Always get written authorization before testing
- Stay within defined scope at all times
- Document everything thoroughly
- Report critical findings immediately
- Protect all evidence and findings
- Follow responsible disclosure practices

**Next Steps**:
1. Complete security training program overview
2. Schedule practical penetration testing exercises
3. Implement findings from security assessments
4. Establish regular security testing schedule