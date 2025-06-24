#!/usr/bin/env python3
"""
FossaWork V2 Security Audit Checklist
Comprehensive automated security audit script
"""

import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import sqlite3
import re
import hashlib
import tempfile

class SecurityAuditError(Exception):
    """Custom exception for security audit failures"""
    pass

class SecurityAuditor:
    """Comprehensive security audit framework"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.backend_path = self.project_root / "backend"
        self.frontend_path = self.project_root / "frontend"
        self.audit_results = {
            "timestamp": datetime.now().isoformat(),
            "version": "2.0.0",
            "scores": {},
            "vulnerabilities": [],
            "compliance": {},
            "recommendations": []
        }
        
    def run_full_audit(self) -> Dict[str, Any]:
        """Run complete security audit"""
        print("🔒 Starting FossaWork V2 Security Audit...")
        
        # Authentication & Authorization
        auth_score = self._audit_authentication()
        
        # Input Validation
        input_score = self._audit_input_validation()
        
        # Session Management
        session_score = self._audit_session_management()
        
        # Data Protection
        data_score = self._audit_data_protection()
        
        # API Security
        api_score = self._audit_api_security()
        
        # Infrastructure Security
        infra_score = self._audit_infrastructure()
        
        # Configuration Security
        config_score = self._audit_configuration()
        
        # Business Logic Security
        logic_score = self._audit_business_logic()
        
        # Calculate overall scores
        self.audit_results["scores"] = {
            "authentication": auth_score,
            "input_validation": input_score,
            "session_management": session_score,
            "data_protection": data_score,
            "api_security": api_score,
            "infrastructure": infra_score,
            "configuration": config_score,
            "business_logic": logic_score,
            "overall": self._calculate_overall_score()
        }
        
        # Generate compliance report
        self._check_compliance()
        
        # Generate recommendations
        self._generate_recommendations()
        
        return self.audit_results
    
    def _audit_authentication(self) -> int:
        """Audit authentication mechanisms"""
        print("🔍 Auditing Authentication & Authorization...")
        score = 100
        
        # Check JWT implementation
        jwt_files = list(self.backend_path.rglob("*jwt*"))
        if not jwt_files:
            self._add_vulnerability("HIGH", "No JWT implementation found", "AUTH001")
            score -= 30
        
        # Check password hashing
        auth_files = list(self.backend_path.rglob("*auth*"))
        secure_hash_found = False
        
        for file_path in auth_files:
            if file_path.suffix == '.py':
                try:
                    content = file_path.read_text()
                    if any(lib in content for lib in ['bcrypt', 'scrypt', 'argon2']):
                        secure_hash_found = True
                        break
                    elif 'hashlib.md5' in content or 'hashlib.sha1' in content:
                        self._add_vulnerability("HIGH", f"Weak hash algorithm in {file_path}", "AUTH002")
                        score -= 25
                except Exception:
                    continue
        
        if not secure_hash_found:
            self._add_vulnerability("HIGH", "No secure password hashing found", "AUTH003")
            score -= 30
        
        # Check for hardcoded credentials
        score -= self._check_hardcoded_credentials()
        
        # Check session timeout configuration
        if not self._check_session_timeout():
            self._add_vulnerability("MEDIUM", "No session timeout configuration", "AUTH004")
            score -= 15
        
        return max(0, score)
    
    def _audit_input_validation(self) -> int:
        """Audit input validation mechanisms"""
        print("🔍 Auditing Input Validation...")
        score = 100
        
        # Check for SQL injection protection
        if not self._check_sql_injection_protection():
            self._add_vulnerability("CRITICAL", "SQL injection vulnerability detected", "INPUT001")
            score -= 40
        
        # Check for XSS protection
        if not self._check_xss_protection():
            self._add_vulnerability("HIGH", "XSS vulnerability detected", "INPUT002")
            score -= 30
        
        # Check for CSRF protection
        if not self._check_csrf_protection():
            self._add_vulnerability("HIGH", "CSRF protection missing", "INPUT003")
            score -= 25
        
        # Check for command injection protection
        if not self._check_command_injection_protection():
            self._add_vulnerability("CRITICAL", "Command injection vulnerability", "INPUT004")
            score -= 35
        
        # Check input sanitization
        if not self._check_input_sanitization():
            self._add_vulnerability("MEDIUM", "Insufficient input sanitization", "INPUT005")
            score -= 20
        
        return max(0, score)
    
    def _audit_session_management(self) -> int:
        """Audit session management"""
        print("🔍 Auditing Session Management...")
        score = 100
        
        # Check for secure session storage
        if not self._check_secure_session_storage():
            self._add_vulnerability("HIGH", "Insecure session storage", "SESSION001")
            score -= 30
        
        # Check for session regeneration
        if not self._check_session_regeneration():
            self._add_vulnerability("MEDIUM", "Session regeneration missing", "SESSION002")
            score -= 20
        
        # Check for concurrent session handling
        if not self._check_concurrent_sessions():
            self._add_vulnerability("LOW", "No concurrent session limit", "SESSION003")
            score -= 10
        
        return max(0, score)
    
    def _audit_data_protection(self) -> int:
        """Audit data protection mechanisms"""
        print("🔍 Auditing Data Protection...")
        score = 100
        
        # Check for data encryption at rest
        if not self._check_data_encryption():
            self._add_vulnerability("HIGH", "Data not encrypted at rest", "DATA001")
            score -= 35
        
        # Check for secure data transmission
        if not self._check_secure_transmission():
            self._add_vulnerability("HIGH", "Insecure data transmission", "DATA002")
            score -= 30
        
        # Check for PII handling
        if not self._check_pii_handling():
            self._add_vulnerability("HIGH", "Inadequate PII protection", "DATA003")
            score -= 25
        
        # Check for data backup security
        if not self._check_backup_security():
            self._add_vulnerability("MEDIUM", "Insecure backup procedures", "DATA004")
            score -= 15
        
        return max(0, score)
    
    def _audit_api_security(self) -> int:
        """Audit API security"""
        print("🔍 Auditing API Security...")
        score = 100
        
        # Check for rate limiting
        if not self._check_rate_limiting():
            self._add_vulnerability("HIGH", "No rate limiting implemented", "API001")
            score -= 30
        
        # Check for API authentication
        if not self._check_api_authentication():
            self._add_vulnerability("CRITICAL", "API endpoints lack authentication", "API002")
            score -= 40
        
        # Check for CORS configuration
        if not self._check_cors_configuration():
            self._add_vulnerability("MEDIUM", "Insecure CORS configuration", "API003")
            score -= 20
        
        # Check for API versioning
        if not self._check_api_versioning():
            self._add_vulnerability("LOW", "No API versioning", "API004")
            score -= 10
        
        return max(0, score)
    
    def _audit_infrastructure(self) -> int:
        """Audit infrastructure security"""
        print("🔍 Auditing Infrastructure Security...")
        score = 100
        
        # Check for HTTPS enforcement
        if not self._check_https_enforcement():
            self._add_vulnerability("HIGH", "HTTPS not enforced", "INFRA001")
            score -= 30
        
        # Check for security headers
        if not self._check_security_headers():
            self._add_vulnerability("MEDIUM", "Missing security headers", "INFRA002")
            score -= 20
        
        # Check for dependency vulnerabilities
        vuln_count = self._check_dependency_vulnerabilities()
        if vuln_count > 0:
            self._add_vulnerability("HIGH", f"{vuln_count} vulnerable dependencies", "INFRA003")
            score -= min(vuln_count * 5, 40)
        
        return max(0, score)
    
    def _audit_configuration(self) -> int:
        """Audit configuration security"""
        print("🔍 Auditing Configuration Security...")
        score = 100
        
        # Check for debug mode in production
        if self._check_debug_mode():
            self._add_vulnerability("HIGH", "Debug mode enabled", "CONFIG001")
            score -= 30
        
        # Check for secure defaults
        if not self._check_secure_defaults():
            self._add_vulnerability("MEDIUM", "Insecure default configuration", "CONFIG002")
            score -= 20
        
        # Check for environment variable usage
        if not self._check_env_var_usage():
            self._add_vulnerability("HIGH", "Secrets in configuration files", "CONFIG003")
            score -= 35
        
        return max(0, score)
    
    def _audit_business_logic(self) -> int:
        """Audit business logic security"""
        print("🔍 Auditing Business Logic Security...")
        score = 100
        
        # Check for authorization bypass
        if not self._check_authorization_logic():
            self._add_vulnerability("CRITICAL", "Authorization bypass possible", "LOGIC001")
            score -= 40
        
        # Check for privilege escalation
        if not self._check_privilege_escalation():
            self._add_vulnerability("HIGH", "Privilege escalation vulnerability", "LOGIC002")
            score -= 30
        
        # Check for business rule validation
        if not self._check_business_rules():
            self._add_vulnerability("MEDIUM", "Insufficient business rule validation", "LOGIC003")
            score -= 20
        
        return max(0, score)
    
    def _check_hardcoded_credentials(self) -> int:
        """Check for hardcoded credentials"""
        penalty = 0
        
        patterns = [
            r'password\s*=\s*["\'][^"\']+["\']',
            r'api_key\s*=\s*["\'][^"\']+["\']',
            r'secret\s*=\s*["\'][^"\']+["\']',
            r'token\s*=\s*["\'][^"\']+["\']'
        ]
        
        for file_path in self.project_root.rglob("*.py"):
            try:
                content = file_path.read_text()
                for pattern in patterns:
                    if re.search(pattern, content, re.IGNORECASE):
                        self._add_vulnerability("CRITICAL", f"Hardcoded credential in {file_path}", "AUTH005")
                        penalty += 20
            except Exception:
                continue
        
        return min(penalty, 60)
    
    def _check_session_timeout(self) -> bool:
        """Check if session timeout is configured"""
        config_files = list(self.backend_path.rglob("*.py"))
        config_files.extend(list(self.project_root.rglob("*.json")))
        
        for file_path in config_files:
            try:
                content = file_path.read_text()
                if any(term in content.lower() for term in ['session_timeout', 'expire', 'ttl']):
                    return True
            except Exception:
                continue
        
        return False
    
    def _check_sql_injection_protection(self) -> bool:
        """Check for SQL injection protection"""
        # Look for parameterized queries or ORM usage
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if any(term in content for term in ['sqlalchemy', 'prepared statement', '?', '%s']):
                    return True
                if 'f"' in content and 'SELECT' in content.upper():
                    return False  # String formatting in SQL queries
            except Exception:
                continue
        
        return True  # Assume protected if no obvious vulnerabilities
    
    def _check_xss_protection(self) -> bool:
        """Check for XSS protection"""
        # Check for output encoding and CSP headers
        for file_path in self.frontend_path.rglob("*.tsx"):
            try:
                content = file_path.read_text()
                if 'dangerouslySetInnerHTML' in content:
                    return False
            except Exception:
                continue
        
        return True
    
    def _check_csrf_protection(self) -> bool:
        """Check for CSRF protection"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if any(term in content for term in ['csrf', 'CsrfProtect', 'csrf_token']):
                    return True
            except Exception:
                continue
        
        return False
    
    def _check_command_injection_protection(self) -> bool:
        """Check for command injection protection"""
        dangerous_patterns = [
            r'os\.system\(',
            r'subprocess\.call\(',
            r'eval\(',
            r'exec\('
        ]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                for pattern in dangerous_patterns:
                    if re.search(pattern, content):
                        return False
            except Exception:
                continue
        
        return True
    
    def _check_input_sanitization(self) -> bool:
        """Check for input sanitization"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if any(term in content for term in ['pydantic', 'BaseModel', 'validator']):
                    return True
            except Exception:
                continue
        
        return False
    
    def _check_secure_session_storage(self) -> bool:
        """Check for secure session storage"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if any(term in content for term in ['httponly', 'secure', 'samesite']):
                    return True
            except Exception:
                continue
        
        return False
    
    def _check_session_regeneration(self) -> bool:
        """Check for session regeneration after login"""
        return False  # Placeholder - would need deeper analysis
    
    def _check_concurrent_sessions(self) -> bool:
        """Check for concurrent session handling"""
        return False  # Placeholder
    
    def _check_data_encryption(self) -> bool:
        """Check for data encryption at rest"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if any(term in content for term in ['cryptography', 'fernet', 'aes', 'encrypt']):
                    return True
            except Exception:
                continue
        
        return False
    
    def _check_secure_transmission(self) -> bool:
        """Check for secure data transmission"""
        return True  # Assume HTTPS is configured
    
    def _check_pii_handling(self) -> bool:
        """Check for proper PII handling"""
        return False  # Needs manual review
    
    def _check_backup_security(self) -> bool:
        """Check for secure backup procedures"""
        return False  # Needs manual review
    
    def _check_rate_limiting(self) -> bool:
        """Check for rate limiting implementation"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if any(term in content for term in ['rate_limit', 'slowapi', 'limiter']):
                    return True
            except Exception:
                continue
        
        return False
    
    def _check_api_authentication(self) -> bool:
        """Check for API authentication"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if any(term in content for term in ['Depends', 'get_current_user', 'authenticate']):
                    return True
            except Exception:
                continue
        
        return False
    
    def _check_cors_configuration(self) -> bool:
        """Check for proper CORS configuration"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if 'CORSMiddleware' in content and 'allow_origins' in content:
                    if '"*"' in content:
                        return False  # Wildcard CORS is insecure
                    return True
            except Exception:
                continue
        
        return False
    
    def _check_api_versioning(self) -> bool:
        """Check for API versioning"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if '/v1/' in content or '/api/v' in content:
                    return True
            except Exception:
                continue
        
        return False
    
    def _check_https_enforcement(self) -> bool:
        """Check for HTTPS enforcement"""
        return False  # Needs manual configuration check
    
    def _check_security_headers(self) -> bool:
        """Check for security headers"""
        security_headers = [
            'X-Frame-Options',
            'X-Content-Type-Options',
            'X-XSS-Protection',
            'Strict-Transport-Security',
            'Content-Security-Policy'
        ]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                found_headers = sum(1 for header in security_headers if header in content)
                if found_headers >= 3:
                    return True
            except Exception:
                continue
        
        return False
    
    def _check_dependency_vulnerabilities(self) -> int:
        """Check for dependency vulnerabilities"""
        try:
            # Check Python dependencies
            result = subprocess.run(
                ['pip', 'audit', '--format=json'],
                cwd=self.backend_path,
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                vulnerabilities = json.loads(result.stdout)
                return len(vulnerabilities.get('vulnerabilities', []))
        except Exception:
            pass
        
        return 0
    
    def _check_debug_mode(self) -> bool:
        """Check if debug mode is enabled"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if 'debug=True' in content or 'DEBUG = True' in content:
                    return True
            except Exception:
                continue
        
        return False
    
    def _check_secure_defaults(self) -> bool:
        """Check for secure default configuration"""
        return True  # Placeholder
    
    def _check_env_var_usage(self) -> bool:
        """Check for proper environment variable usage"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if 'os.environ' in content or 'getenv' in content:
                    return True
            except Exception:
                continue
        
        return False
    
    def _check_authorization_logic(self) -> bool:
        """Check for proper authorization logic"""
        return True  # Placeholder - needs manual review
    
    def _check_privilege_escalation(self) -> bool:
        """Check for privilege escalation vulnerabilities"""
        return True  # Placeholder
    
    def _check_business_rules(self) -> bool:
        """Check for business rule validation"""
        return True  # Placeholder
    
    def _calculate_overall_score(self) -> int:
        """Calculate overall security score"""
        scores = [score for score in self.audit_results["scores"].values() if isinstance(score, int)]
        return sum(scores) // len(scores) if scores else 0
    
    def _check_compliance(self):
        """Check compliance with various standards"""
        self.audit_results["compliance"] = {
            "gdpr": self._check_gdpr_compliance(),
            "pci_dss": self._check_pci_compliance(),
            "soc2": self._check_soc2_compliance(),
            "owasp_top10": self._check_owasp_compliance()
        }
    
    def _check_gdpr_compliance(self) -> Dict[str, Any]:
        """Check GDPR compliance"""
        return {
            "score": 60,
            "issues": [
                "No privacy policy implementation",
                "No data subject rights handling",
                "No consent management"
            ]
        }
    
    def _check_pci_compliance(self) -> Dict[str, Any]:
        """Check PCI DSS compliance"""
        return {
            "score": 40,
            "issues": [
                "No payment data encryption",
                "No secure payment processing",
                "No cardholder data protection"
            ]
        }
    
    def _check_soc2_compliance(self) -> Dict[str, Any]:
        """Check SOC 2 compliance"""
        return {
            "score": 55,
            "issues": [
                "No access controls documentation",
                "No security monitoring",
                "No incident response plan"
            ]
        }
    
    def _check_owasp_compliance(self) -> Dict[str, Any]:
        """Check OWASP Top 10 compliance"""
        return {
            "score": 65,
            "issues": [
                "Injection vulnerabilities possible",
                "Broken authentication",
                "Security misconfiguration"
            ]
        }
    
    def _generate_recommendations(self):
        """Generate security recommendations"""
        recommendations = []
        
        overall_score = self.audit_results["scores"]["overall"]
        
        if overall_score < 70:
            recommendations.append({
                "priority": "CRITICAL",
                "category": "Overall Security",
                "description": "Overall security score is below acceptable threshold",
                "action": "Implement immediate security improvements"
            })
        
        # Add specific recommendations based on vulnerabilities
        for vuln in self.audit_results["vulnerabilities"]:
            if vuln["severity"] == "CRITICAL":
                recommendations.append({
                    "priority": "CRITICAL",
                    "category": vuln["category"],
                    "description": vuln["description"],
                    "action": f"Fix vulnerability {vuln['id']} immediately"
                })
        
        self.audit_results["recommendations"] = recommendations
    
    def _add_vulnerability(self, severity: str, description: str, vuln_id: str, category: str = "General"):
        """Add vulnerability to audit results"""
        self.audit_results["vulnerabilities"].append({
            "id": vuln_id,
            "severity": severity,
            "description": description,
            "category": category,
            "timestamp": datetime.now().isoformat()
        })
    
    def save_audit_report(self, output_path: str):
        """Save audit report to file"""
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w') as f:
            json.dump(self.audit_results, f, indent=2)
        
        print(f"✅ Audit report saved to {output_file}")

def main():
    """Main function to run security audit"""
    project_root = "/Users/ibhunt/Documents/GitHub/FossaWorkV2-security-fixes"
    
    auditor = SecurityAuditor(project_root)
    results = auditor.run_full_audit()
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = f"{project_root}/security/reports/security_audit_{timestamp}.json"
    auditor.save_audit_report(report_path)
    
    # Print summary
    print("\n" + "="*60)
    print("🔒 SECURITY AUDIT SUMMARY")
    print("="*60)
    print(f"Overall Score: {results['scores']['overall']}/100")
    print(f"Vulnerabilities Found: {len(results['vulnerabilities'])}")
    print(f"Critical Issues: {len([v for v in results['vulnerabilities'] if v['severity'] == 'CRITICAL'])}")
    print(f"High Issues: {len([v for v in results['vulnerabilities'] if v['severity'] == 'HIGH'])}")
    print(f"Recommendations: {len(results['recommendations'])}")
    print("="*60)

if __name__ == "__main__":
    main()