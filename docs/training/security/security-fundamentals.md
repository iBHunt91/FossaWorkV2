# Security Fundamentals Training
*FossaWork V2 Development & Operations Team*

## Learning Objectives
By the end of this training, team members will:
- Understand core security principles and their application
- Recognize common security threats and vulnerabilities
- Apply security best practices in daily work
- Know when and how to escalate security concerns

## 1. Security Principles

### The CIA Triad
**Confidentiality, Integrity, Availability**

#### Confidentiality
- **Definition**: Ensuring information is accessible only to authorized individuals
- **FossaWork V2 Examples**:
  - WorkFossa credentials stored securely
  - User data isolation (`data/users/{userId}/`)
  - API endpoint authentication
  - Database encryption at rest

**❌ Confidentiality Violations:**
```python
# NEVER do this - credentials in logs
logger.info(f"Login attempt: {username}:{password}")

# NEVER do this - sensitive data in URLs
api_call = f"/api/users?password={user_password}"
```

**✅ Confidentiality Best Practices:**
```python
# Mask sensitive data in logs
logger.info(f"Login attempt for user: {username[:3]}***")

# Use request bodies for sensitive data
payload = {"username": username, "password": password}
response = requests.post("/api/auth/login", json=payload)
```

#### Integrity
- **Definition**: Ensuring data accuracy and preventing unauthorized modification
- **FossaWork V2 Examples**:
  - Input validation on all forms
  - Database constraints and validation
  - File permission checks
  - Checksums for critical files

**❌ Integrity Violations:**
```python
# NEVER do this - direct SQL without validation
query = f"SELECT * FROM users WHERE id = {user_id}"
cursor.execute(query)  # SQL injection risk
```

**✅ Integrity Best Practices:**
```python
# Use parameterized queries
query = "SELECT * FROM users WHERE id = ?"
cursor.execute(query, (user_id,))

# Validate all inputs
def validate_user_id(user_id):
    if not isinstance(user_id, int) or user_id <= 0:
        raise ValueError("Invalid user ID")
    return user_id
```

#### Availability
- **Definition**: Ensuring systems and data are accessible when needed
- **FossaWork V2 Examples**:
  - Automated backups and recovery procedures
  - Rate limiting to prevent DoS attacks
  - Health checks and monitoring
  - Graceful error handling

### Defense in Depth
**Multiple layers of security controls**

1. **Physical Security**: Secure development environments
2. **Network Security**: HTTPS, VPN, firewall rules
3. **Application Security**: Authentication, authorization, input validation
4. **Data Security**: Encryption, backup, access controls
5. **Operational Security**: Monitoring, incident response, training

## 2. Common Threat Landscape

### OWASP Top 10 (Relevant to FossaWork V2)

#### A01: Broken Access Control
**What it is**: Users can access data/functions they shouldn't
**FossaWork V2 Risk**: User accessing other users' work orders

```python
# ❌ Vulnerable code
@app.get("/api/work-orders/{order_id}")
async def get_work_order(order_id: int):
    # No check if user owns this work order!
    return database.get_work_order(order_id)

# ✅ Secure code
@app.get("/api/work-orders/{order_id}")
async def get_work_order(order_id: int, current_user: User = Depends(get_current_user)):
    work_order = database.get_work_order(order_id)
    if work_order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return work_order
```

#### A02: Cryptographic Failures
**What it is**: Inadequate protection of sensitive data
**FossaWork V2 Risk**: Plain text credential storage (CURRENT ISSUE)

```python
# ❌ Current vulnerable implementation
credentials = {
    "username": "admin",
    "password": "plaintext_password"  # CRITICAL ISSUE
}
json.dump(credentials, open("credentials.json", "w"))

# ✅ Secure implementation needed
from cryptography.fernet import Fernet
key = Fernet.generate_key()
cipher_suite = Fernet(key)

encrypted_password = cipher_suite.encrypt(password.encode())
credentials = {
    "username": "admin",
    "password": encrypted_password.decode()
}
```

#### A03: Injection
**What it is**: Malicious data sent to interpreter
**FossaWork V2 Risk**: SQL injection in database queries

```python
# ❌ SQL Injection vulnerable
def get_user_data(username):
    query = f"SELECT * FROM users WHERE username = '{username}'"
    # Attack: username = "'; DROP TABLE users; --"
    return execute_query(query)

# ✅ Parameterized queries
def get_user_data(username):
    query = "SELECT * FROM users WHERE username = ?"
    return execute_query(query, (username,))
```

#### A07: Identification and Authentication Failures
**What it is**: Weak authentication mechanisms
**FossaWork V2 Risk**: Weak session management

```python
# ❌ Weak authentication
def authenticate(username, password):
    if username == "admin" and password == "password":
        return True  # Hardcoded credentials!
    return False

# ✅ Strong authentication
def authenticate(username, password):
    user = get_user_by_username(username)
    if not user:
        return False
    
    # Use proper password hashing
    return bcrypt.checkpw(password.encode(), user.password_hash)
```

## 3. Security in Daily Work

### For Developers

#### Secure Coding Checklist
- [ ] Validate all user inputs
- [ ] Use parameterized queries
- [ ] Implement proper error handling
- [ ] Never log sensitive data
- [ ] Use HTTPS for all communications
- [ ] Implement proper session management
- [ ] Follow principle of least privilege

#### Code Review Security Focus
```python
# Look for these patterns in code reviews:

# 1. Input validation
def process_user_input(data):
    # Check: Is input validated?
    if not validate_input(data):
        raise ValueError("Invalid input")

# 2. Authentication checks
@require_authentication
def sensitive_operation():
    # Check: Is authentication required?
    pass

# 3. Error handling
try:
    risky_operation()
except Exception as e:
    # Check: Are errors handled securely?
    logger.error("Operation failed", exc_info=False)  # Don't log stack traces in prod
    return {"error": "Operation failed"}  # Generic error message
```

### For Operations Team

#### Deployment Security
1. **Environment Separation**: Never use production credentials in development
2. **Secret Management**: Use environment variables, never hardcode
3. **Access Control**: Limit who can deploy to production
4. **Monitoring**: Set up alerts for security events

#### Incident Response
1. **Immediate**: Contain the threat
2. **Assessment**: Determine scope and impact
3. **Communication**: Follow escalation procedures
4. **Recovery**: Restore normal operations
5. **Lessons Learned**: Update procedures

## 4. FossaWork V2 Specific Security

### Current Security Issues (CRITICAL)
1. **Plain text credential storage** - Immediate fix required
2. **Missing API authentication** - High priority
3. **Insufficient input validation** - Medium priority
4. **Overly permissive CORS** - Medium priority

### Security Architecture
```
[Frontend] → [API Gateway] → [Backend Services] → [Database]
     ↓              ↓              ↓              ↓
[CSP Headers]  [Rate Limiting] [Input Validation] [Encryption]
[HTTPS]        [Authentication] [Authorization]   [Backups]
```

### Data Flow Security
1. **User Input**: Validated at frontend AND backend
2. **API Calls**: Authenticated with JWT tokens
3. **Database**: Parameterized queries, encrypted at rest
4. **File Storage**: User isolation, permission checks

## 5. Interactive Exercises

### Exercise 1: Spot the Vulnerability
```python
# Find the security issues in this code:
def login(request):
    username = request.form['username']
    password = request.form['password']
    
    query = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"
    result = db.execute(query)
    
    if result:
        session['user'] = username
        logger.info(f"User {username} logged in with password {password}")
        return redirect('/dashboard')
    else:
        return "Invalid credentials"

# Issues:
# 1. SQL injection vulnerability
# 2. Plain text password comparison
# 3. Sensitive data in logs
# 4. No rate limiting
# 5. Generic error messages reveal nothing
```

### Exercise 2: Secure the Function
```python
# Your task: Make this function secure
def update_user_profile(user_id, new_data):
    # Add security measures here
    pass

# Consider:
# - Input validation
# - Authorization (can user update this profile?)
# - Data sanitization
# - Audit logging
# - Error handling
```

### Exercise 3: Security Design Review
**Scenario**: Adding a new feature to export work order data
**Questions to consider**:
1. Who should have access to this feature?
2. What data should be included/excluded?
3. How do we prevent data leakage?
4. What logging is needed?
5. How do we handle large exports?

## 6. Compliance Requirements

### GDPR Considerations
- **Right to be forgotten**: User data deletion procedures
- **Data minimization**: Only collect necessary data
- **Consent**: Clear opt-ins for data processing
- **Breach notification**: 72-hour reporting requirement

### SOC2 Requirements
- **Access controls**: Who can access what
- **Change management**: Controlled deployment process
- **Monitoring**: Audit trails and logging
- **Incident response**: Documented procedures

## 7. Security Tools and Resources

### Static Analysis Tools
- **Python**: `bandit`, `safety`, `semgrep`
- **JavaScript**: `eslint-plugin-security`, `npm audit`
- **General**: `sonarqube`, `snyk`

### Dynamic Testing Tools
- **OWASP ZAP**: Web application scanner
- **Burp Suite**: Manual penetration testing
- **SQLMap**: SQL injection testing

### Monitoring Tools
- **Log Analysis**: `ELK Stack`, `Splunk`
- **Network Monitoring**: `Wireshark`, `tcpdump`
- **Application Monitoring**: `New Relic`, `DataDog`

## 8. Escalation Procedures

### When to Escalate
- **Immediate**: Active security incident
- **High**: Vulnerability in production code
- **Medium**: Security policy violations
- **Low**: Security questions or training needs

### Escalation Contacts
1. **Security Team Lead**: First contact for all security issues
2. **Development Manager**: For code-related security concerns
3. **Operations Manager**: For infrastructure security issues
4. **Legal/Compliance**: For regulatory concerns

### Communication Guidelines
- Use secure channels for sensitive discussions
- Include relevant technical details
- Document all actions taken
- Follow up with lessons learned

## 9. Assessment and Certification

### Knowledge Check
1. What are the three components of the CIA triad?
2. Name three ways to prevent SQL injection
3. What should you do if you discover a security vulnerability?
4. How should sensitive data be stored in FossaWork V2?
5. What are the current critical security issues in FossaWork V2?

### Practical Assessment
- Code review exercise with security focus
- Incident response simulation
- Security design review participation
- Vulnerability identification exercise

### Certification Requirements
- [ ] Complete all training modules
- [ ] Pass knowledge assessment (80% minimum)
- [ ] Participate in practical exercises
- [ ] Demonstrate understanding in code reviews
- [ ] Stay current with security updates

## 10. Continuous Learning

### Regular Updates
- Monthly security newsletters
- Quarterly vulnerability assessments
- Annual penetration testing
- Ongoing threat intelligence briefings

### Resources for Learning
- **OWASP**: Free security resources and training
- **NIST Cybersecurity Framework**: Government guidelines
- **SANS**: Professional security training
- **CVE Database**: Latest vulnerability information

### Internal Knowledge Sharing
- Security brown bag sessions
- Post-incident reviews
- Secure coding workshops
- Threat modeling exercises

---

**Remember**: Security is everyone's responsibility. When in doubt, ask questions and escalate concerns. It's better to be cautious than to deal with a security incident.

**Next Steps**: 
1. Complete the secure coding guide training
2. Review current FossaWork V2 security issues
3. Participate in hands-on vulnerability exercises
4. Schedule regular security check-ins with your team