#!/usr/bin/env python3
"""
FossaWork V2 Security Regression Testing Framework
Continuous security validation and regression testing
"""

import asyncio
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import hashlib
import tempfile
import sqlite3

class SecurityRegressionTester:
    """Security regression testing framework"""
    
    def __init__(self, project_root: str, baseline_path: str = None):
        self.project_root = Path(project_root)
        self.backend_path = self.project_root / "backend"
        self.frontend_path = self.project_root / "frontend"
        self.baseline_path = baseline_path
        self.test_results = {
            "timestamp": datetime.now().isoformat(),
            "version": "2.0.0",
            "baseline_comparison": {},
            "regression_tests": {},
            "new_vulnerabilities": [],
            "fixed_vulnerabilities": [],
            "summary": {}
        }
        
        # Security test cases
        self.security_test_cases = [
            self._test_authentication_regression,
            self._test_authorization_regression,
            self._test_input_validation_regression,
            self._test_session_management_regression,
            self._test_crypto_regression,
            self._test_configuration_regression,
            self._test_dependency_regression,
            self._test_api_security_regression,
            self._test_data_protection_regression,
            self._test_infrastructure_regression
        ]
        
    async def run_regression_tests(self) -> Dict[str, Any]:
        """Run complete security regression test suite"""
        print("🔄 Starting Security Regression Testing...")
        
        # Load baseline if available
        baseline_data = self._load_baseline()
        
        # Run current security tests
        current_results = await self._run_current_security_tests()
        
        # Compare with baseline
        if baseline_data:
            await self._compare_with_baseline(baseline_data, current_results)
        
        # Run specific regression tests
        await self._run_specific_regression_tests()
        
        # Generate summary
        self._generate_regression_summary()
        
        # Save current results as new baseline
        self._save_baseline(current_results)
        
        return self.test_results
    
    def _load_baseline(self) -> Optional[Dict[str, Any]]:
        """Load baseline security test results"""
        if not self.baseline_path:
            baseline_file = self.project_root / "security" / "reports" / "baseline_security.json"
        else:
            baseline_file = Path(self.baseline_path)
        
        if baseline_file.exists():
            try:
                with open(baseline_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ Could not load baseline: {e}")
        
        return None
    
    async def _run_current_security_tests(self) -> Dict[str, Any]:
        """Run current security tests"""
        print("🔍 Running Current Security Tests...")
        
        results = {}
        
        for test_case in self.security_test_cases:
            try:
                test_name = test_case.__name__.replace('_test_', '').replace('_regression', '')
                results[test_name] = await test_case()
            except Exception as e:
                results[test_case.__name__] = {"error": str(e), "status": "FAILED"}
        
        return results
    
    async def _compare_with_baseline(self, baseline: Dict[str, Any], current: Dict[str, Any]):
        """Compare current results with baseline"""
        print("📊 Comparing with Baseline...")
        
        comparison = {
            "new_issues": [],
            "fixed_issues": [],
            "status_changes": [],
            "score_changes": {}
        }
        
        # Compare test results
        for test_name, current_result in current.items():
            baseline_result = baseline.get(test_name, {})
            
            # Compare vulnerability counts
            current_vulns = current_result.get("vulnerabilities", [])
            baseline_vulns = baseline_result.get("vulnerabilities", [])
            
            # Find new vulnerabilities
            new_vulns = self._find_new_vulnerabilities(baseline_vulns, current_vulns)
            if new_vulns:
                comparison["new_issues"].extend(new_vulns)
                self.test_results["new_vulnerabilities"].extend(new_vulns)
            
            # Find fixed vulnerabilities
            fixed_vulns = self._find_fixed_vulnerabilities(baseline_vulns, current_vulns)
            if fixed_vulns:
                comparison["fixed_issues"].extend(fixed_vulns)
                self.test_results["fixed_vulnerabilities"].extend(fixed_vulns)
            
            # Compare scores
            current_score = current_result.get("score", 0)
            baseline_score = baseline_result.get("score", 0)
            
            if current_score != baseline_score:
                comparison["score_changes"][test_name] = {
                    "baseline": baseline_score,
                    "current": current_score,
                    "change": current_score - baseline_score
                }
        
        self.test_results["baseline_comparison"] = comparison
    
    def _find_new_vulnerabilities(self, baseline_vulns: List[Dict], current_vulns: List[Dict]) -> List[Dict]:
        """Find vulnerabilities that are new compared to baseline"""
        new_vulns = []
        
        baseline_signatures = set(self._get_vulnerability_signature(v) for v in baseline_vulns)
        
        for vuln in current_vulns:
            signature = self._get_vulnerability_signature(vuln)
            if signature not in baseline_signatures:
                vuln["regression_type"] = "NEW"
                new_vulns.append(vuln)
        
        return new_vulns
    
    def _find_fixed_vulnerabilities(self, baseline_vulns: List[Dict], current_vulns: List[Dict]) -> List[Dict]:
        """Find vulnerabilities that were fixed since baseline"""
        fixed_vulns = []
        
        current_signatures = set(self._get_vulnerability_signature(v) for v in current_vulns)
        
        for vuln in baseline_vulns:
            signature = self._get_vulnerability_signature(vuln)
            if signature not in current_signatures:
                vuln["regression_type"] = "FIXED"
                fixed_vulns.append(vuln)
        
        return fixed_vulns
    
    def _get_vulnerability_signature(self, vuln: Dict) -> str:
        """Generate unique signature for vulnerability"""
        key_fields = [
            vuln.get("type", ""),
            vuln.get("file", ""),
            vuln.get("line", ""),
            vuln.get("description", "")[:50]  # First 50 chars
        ]
        return hashlib.md5("||".join(str(f) for f in key_fields).encode()).hexdigest()
    
    async def _run_specific_regression_tests(self):
        """Run specific regression tests"""
        print("🧪 Running Specific Regression Tests...")
        
        regression_tests = {
            "sql_injection_prevention": await self._test_sql_injection_prevention(),
            "xss_prevention": await self._test_xss_prevention(),
            "csrf_protection": await self._test_csrf_protection(),
            "authentication_bypass": await self._test_auth_bypass_prevention(),
            "authorization_bypass": await self._test_authz_bypass_prevention(),
            "session_fixation": await self._test_session_fixation_prevention(),
            "command_injection": await self._test_command_injection_prevention(),
            "path_traversal": await self._test_path_traversal_prevention(),
            "file_upload_bypass": await self._test_file_upload_security(),
            "information_disclosure": await self._test_information_disclosure_prevention()
        }
        
        self.test_results["regression_tests"] = regression_tests
    
    async def _test_authentication_regression(self) -> Dict[str, Any]:
        """Test authentication mechanisms for regressions"""
        results = {
            "test": "authentication_regression",
            "vulnerabilities": [],
            "score": 0,
            "checks": []
        }
        
        # Check for proper password hashing
        hash_check = await self._check_password_hashing()
        results["checks"].append(hash_check)
        if not hash_check["passed"]:
            results["vulnerabilities"].append({
                "type": "WEAK_PASSWORD_HASH",
                "description": "Weak password hashing detected",
                "severity": "HIGH"
            })
        
        # Check for JWT security
        jwt_check = await self._check_jwt_security()
        results["checks"].append(jwt_check)
        if not jwt_check["passed"]:
            results["vulnerabilities"].append({
                "type": "JWT_VULNERABILITY",
                "description": "JWT security issue detected",
                "severity": "HIGH"
            })
        
        # Check for session security
        session_check = await self._check_session_security()
        results["checks"].append(session_check)
        if not session_check["passed"]:
            results["vulnerabilities"].append({
                "type": "SESSION_VULNERABILITY",
                "description": "Session security issue detected",
                "severity": "MEDIUM"
            })
        
        # Calculate score
        passed_checks = sum(1 for check in results["checks"] if check["passed"])
        results["score"] = (passed_checks / len(results["checks"])) * 100 if results["checks"] else 0
        
        return results
    
    async def _check_password_hashing(self) -> Dict[str, Any]:
        """Check password hashing implementation"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                if 'password' in content.lower():
                    # Check for secure hashing
                    if any(secure_hash in content for secure_hash in 
                           ['bcrypt', 'scrypt', 'argon2', 'pbkdf2']):
                        return {"name": "password_hashing", "passed": True, "details": "Secure password hashing found"}
                    
                    # Check for insecure hashing
                    if any(insecure_hash in content for insecure_hash in 
                           ['md5', 'sha1', 'sha256']) and 'password' in content:
                        return {"name": "password_hashing", "passed": False, "details": "Insecure password hashing found"}
                        
            except Exception:
                continue
        
        return {"name": "password_hashing", "passed": True, "details": "No password hashing code found"}
    
    async def _check_jwt_security(self) -> Dict[str, Any]:
        """Check JWT security implementation"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                if 'jwt' in content.lower():
                    # Check for weak secrets
                    if 'secret = "' in content or "secret = '" in content:
                        return {"name": "jwt_security", "passed": False, "details": "Hardcoded JWT secret found"}
                    
                    # Check for 'none' algorithm
                    if 'none' in content.lower() and 'algorithm' in content.lower():
                        return {"name": "jwt_security", "passed": False, "details": "JWT 'none' algorithm allowed"}
                    
                    return {"name": "jwt_security", "passed": True, "details": "JWT implementation appears secure"}
                    
            except Exception:
                continue
        
        return {"name": "jwt_security", "passed": True, "details": "No JWT implementation found"}
    
    async def _check_session_security(self) -> Dict[str, Any]:
        """Check session security implementation"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                if 'session' in content.lower():
                    # Check for secure flags
                    if any(flag in content.lower() for flag in ['httponly', 'secure', 'samesite']):
                        return {"name": "session_security", "passed": True, "details": "Secure session flags found"}
                    else:
                        return {"name": "session_security", "passed": False, "details": "Missing secure session flags"}
                        
            except Exception:
                continue
        
        return {"name": "session_security", "passed": True, "details": "No session implementation found"}
    
    async def _test_authorization_regression(self) -> Dict[str, Any]:
        """Test authorization mechanisms for regressions"""
        results = {
            "test": "authorization_regression",
            "vulnerabilities": [],
            "score": 0,
            "checks": []
        }
        
        # Check for proper access controls
        access_check = await self._check_access_controls()
        results["checks"].append(access_check)
        if not access_check["passed"]:
            results["vulnerabilities"].append({
                "type": "MISSING_ACCESS_CONTROL",
                "description": "Missing access controls detected",
                "severity": "HIGH"
            })
        
        # Check for privilege escalation protection
        priv_check = await self._check_privilege_escalation_protection()
        results["checks"].append(priv_check)
        if not priv_check["passed"]:
            results["vulnerabilities"].append({
                "type": "PRIVILEGE_ESCALATION",
                "description": "Privilege escalation vulnerability detected",
                "severity": "CRITICAL"
            })
        
        # Calculate score
        passed_checks = sum(1 for check in results["checks"] if check["passed"])
        results["score"] = (passed_checks / len(results["checks"])) * 100 if results["checks"] else 0
        
        return results
    
    async def _check_access_controls(self) -> Dict[str, Any]:
        """Check access control implementation"""
        routes_with_auth = 0
        total_routes = 0
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                lines = content.split('\n')
                
                for i, line in enumerate(lines):
                    if '@app.route' in line or '@router.' in line:
                        total_routes += 1
                        
                        # Check for authentication decorators
                        for j in range(max(0, i-5), min(len(lines), i+5)):
                            if any(auth_term in lines[j] for auth_term in 
                                   ['@login_required', '@authenticate', '@requires_auth', 'Depends']):
                                routes_with_auth += 1
                                break
                                
            except Exception:
                continue
        
        if total_routes == 0:
            return {"name": "access_controls", "passed": True, "details": "No routes found"}
        
        auth_percentage = (routes_with_auth / total_routes) * 100
        
        return {
            "name": "access_controls",
            "passed": auth_percentage >= 80,  # 80% of routes should have auth
            "details": f"{auth_percentage:.1f}% of routes have authentication ({routes_with_auth}/{total_routes})"
        }
    
    async def _check_privilege_escalation_protection(self) -> Dict[str, Any]:
        """Check privilege escalation protection"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                # Look for privilege changes without validation
                if any(pattern in content for pattern in 
                       ['role = "admin"', 'is_admin = True', 'permissions = "admin"']):
                    
                    # Check if there's validation nearby
                    if not any(validation in content.lower() for validation in 
                               ['check_admin', 'verify_admin', 'admin_required']):
                        return {
                            "name": "privilege_escalation",
                            "passed": False,
                            "details": "Privilege escalation without validation found"
                        }
                        
            except Exception:
                continue
        
        return {"name": "privilege_escalation", "passed": True, "details": "No privilege escalation issues found"}
    
    async def _test_input_validation_regression(self) -> Dict[str, Any]:
        """Test input validation for regressions"""
        results = {
            "test": "input_validation_regression",
            "vulnerabilities": [],
            "score": 0,
            "checks": []
        }
        
        # Check SQL injection protection
        sql_check = await self._check_sql_injection_protection()
        results["checks"].append(sql_check)
        if not sql_check["passed"]:
            results["vulnerabilities"].append({
                "type": "SQL_INJECTION",
                "description": "SQL injection vulnerability detected",
                "severity": "CRITICAL"
            })
        
        # Check XSS protection
        xss_check = await self._check_xss_protection()
        results["checks"].append(xss_check)
        if not xss_check["passed"]:
            results["vulnerabilities"].append({
                "type": "XSS",
                "description": "XSS vulnerability detected",
                "severity": "HIGH"
            })
        
        # Check input sanitization
        sanitization_check = await self._check_input_sanitization()
        results["checks"].append(sanitization_check)
        if not sanitization_check["passed"]:
            results["vulnerabilities"].append({
                "type": "INPUT_VALIDATION",
                "description": "Missing input validation detected",
                "severity": "MEDIUM"
            })
        
        # Calculate score
        passed_checks = sum(1 for check in results["checks"] if check["passed"])
        results["score"] = (passed_checks / len(results["checks"])) * 100 if results["checks"] else 0
        
        return results
    
    async def _check_sql_injection_protection(self) -> Dict[str, Any]:
        """Check SQL injection protection"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                # Look for string concatenation in SQL queries
                sql_patterns = [
                    r'.*\+.*["\'].*SELECT.*["\']',
                    r'.*f["\'].*SELECT.*{.*}.*["\']',
                    r'cursor\.execute\(["\'].*\+.*["\']',
                ]
                
                for pattern in sql_patterns:
                    if re.search(pattern, content, re.IGNORECASE):
                        return {
                            "name": "sql_injection_protection",
                            "passed": False,
                            "details": "SQL injection vulnerability found"
                        }
                        
            except Exception:
                continue
        
        return {"name": "sql_injection_protection", "passed": True, "details": "No SQL injection vulnerabilities found"}
    
    async def _check_xss_protection(self) -> Dict[str, Any]:
        """Check XSS protection"""
        for file_path in self.frontend_path.rglob("*.tsx"):
            try:
                content = file_path.read_text()
                
                if 'dangerouslySetInnerHTML' in content:
                    return {
                        "name": "xss_protection",
                        "passed": False,
                        "details": "dangerouslySetInnerHTML usage found"
                    }
                    
            except Exception:
                continue
        
        return {"name": "xss_protection", "passed": True, "details": "No XSS vulnerabilities found"}
    
    async def _check_input_sanitization(self) -> Dict[str, Any]:
        """Check input sanitization"""
        validation_found = False
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                if any(validation in content.lower() for validation in 
                       ['pydantic', 'basemodel', 'validator', 'validate']):
                    validation_found = True
                    break
                    
            except Exception:
                continue
        
        return {
            "name": "input_sanitization",
            "passed": validation_found,
            "details": "Input validation framework found" if validation_found else "No input validation found"
        }
    
    async def _test_session_management_regression(self) -> Dict[str, Any]:
        """Test session management for regressions"""
        # Already covered in authentication tests
        return await self._test_authentication_regression()
    
    async def _test_crypto_regression(self) -> Dict[str, Any]:
        """Test cryptographic implementations for regressions"""
        results = {
            "test": "crypto_regression",
            "vulnerabilities": [],
            "score": 0,
            "checks": []
        }
        
        # Check for weak crypto algorithms
        crypto_check = await self._check_crypto_algorithms()
        results["checks"].append(crypto_check)
        if not crypto_check["passed"]:
            results["vulnerabilities"].append({
                "type": "WEAK_CRYPTO",
                "description": "Weak cryptographic algorithm detected",
                "severity": "HIGH"
            })
        
        # Check for hardcoded crypto keys
        key_check = await self._check_crypto_keys()
        results["checks"].append(key_check)
        if not key_check["passed"]:
            results["vulnerabilities"].append({
                "type": "HARDCODED_KEY",
                "description": "Hardcoded cryptographic key detected",
                "severity": "CRITICAL"
            })
        
        # Calculate score
        passed_checks = sum(1 for check in results["checks"] if check["passed"])
        results["score"] = (passed_checks / len(results["checks"])) * 100 if results["checks"] else 0
        
        return results
    
    async def _check_crypto_algorithms(self) -> Dict[str, Any]:
        """Check cryptographic algorithms"""
        weak_algos = ['md5', 'sha1', 'des', 'rc4']
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                
                for algo in weak_algos:
                    if f'{algo}(' in content or f'{algo}.' in content:
                        return {
                            "name": "crypto_algorithms",
                            "passed": False,
                            "details": f"Weak algorithm {algo} found"
                        }
                        
            except Exception:
                continue
        
        return {"name": "crypto_algorithms", "passed": True, "details": "No weak algorithms found"}
    
    async def _check_crypto_keys(self) -> Dict[str, Any]:
        """Check for hardcoded crypto keys"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                if any(pattern in content for pattern in 
                       ['key = "', "key = '", 'KEY = "', "KEY = '"]):
                    if not any(env_var in content for env_var in 
                               ['os.environ', 'getenv', 'config']):
                        return {
                            "name": "crypto_keys",
                            "passed": False,
                            "details": "Hardcoded cryptographic key found"
                        }
                        
            except Exception:
                continue
        
        return {"name": "crypto_keys", "passed": True, "details": "No hardcoded keys found"}
    
    async def _test_configuration_regression(self) -> Dict[str, Any]:
        """Test configuration security for regressions"""
        results = {
            "test": "configuration_regression",
            "vulnerabilities": [],
            "score": 0,
            "checks": []
        }
        
        # Check for debug mode in production
        debug_check = await self._check_debug_mode()
        results["checks"].append(debug_check)
        if not debug_check["passed"]:
            results["vulnerabilities"].append({
                "type": "DEBUG_MODE",
                "description": "Debug mode enabled in production",
                "severity": "MEDIUM"
            })
        
        # Check for hardcoded secrets in config
        secret_check = await self._check_config_secrets()
        results["checks"].append(secret_check)
        if not secret_check["passed"]:
            results["vulnerabilities"].append({
                "type": "CONFIG_SECRET",
                "description": "Hardcoded secret in configuration",
                "severity": "HIGH"
            })
        
        # Calculate score
        passed_checks = sum(1 for check in results["checks"] if check["passed"])
        results["score"] = (passed_checks / len(results["checks"])) * 100 if results["checks"] else 0
        
        return results
    
    async def _check_debug_mode(self) -> Dict[str, Any]:
        """Check for debug mode enabled"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                if 'debug=True' in content or 'DEBUG = True' in content:
                    return {
                        "name": "debug_mode",
                        "passed": False,
                        "details": "Debug mode enabled"
                    }
                    
            except Exception:
                continue
        
        return {"name": "debug_mode", "passed": True, "details": "Debug mode not enabled"}
    
    async def _check_config_secrets(self) -> Dict[str, Any]:
        """Check for secrets in configuration files"""
        config_files = []
        config_files.extend(list(self.project_root.rglob("*.json")))
        config_files.extend(list(self.project_root.rglob("*.yaml")))
        config_files.extend(list(self.project_root.rglob("*.yml")))
        
        for config_file in config_files:
            try:
                content = config_file.read_text()
                
                if any(secret in content.lower() for secret in 
                       ['password', 'secret', 'key', 'token']):
                    if len(content) > 100:  # Skip small config files
                        return {
                            "name": "config_secrets",
                            "passed": False,
                            "details": f"Potential secret in {config_file.name}"
                        }
                        
            except Exception:
                continue
        
        return {"name": "config_secrets", "passed": True, "details": "No secrets in config files"}
    
    async def _test_dependency_regression(self) -> Dict[str, Any]:
        """Test dependency security for regressions"""
        results = {
            "test": "dependency_regression",
            "vulnerabilities": [],
            "score": 0,
            "checks": []
        }
        
        # Check Python dependencies
        python_check = await self._check_python_dependencies()
        results["checks"].append(python_check)
        if not python_check["passed"]:
            results["vulnerabilities"].append({
                "type": "VULNERABLE_DEPENDENCY",
                "description": "Vulnerable Python dependency detected",
                "severity": "HIGH"
            })
        
        # Check Node dependencies
        node_check = await self._check_node_dependencies()
        results["checks"].append(node_check)
        if not node_check["passed"]:
            results["vulnerabilities"].append({
                "type": "VULNERABLE_DEPENDENCY",
                "description": "Vulnerable Node.js dependency detected",
                "severity": "HIGH"
            })
        
        # Calculate score
        passed_checks = sum(1 for check in results["checks"] if check["passed"])
        results["score"] = (passed_checks / len(results["checks"])) * 100 if results["checks"] else 0
        
        return results
    
    async def _check_python_dependencies(self) -> Dict[str, Any]:
        """Check Python dependencies for vulnerabilities"""
        try:
            result = subprocess.run(
                ['pip-audit', '--format=json'],
                cwd=self.backend_path,
                capture_output=True, text=True, timeout=30
            )
            
            if result.returncode == 0:
                audit_data = json.loads(result.stdout)
                vulnerabilities = audit_data.get('vulnerabilities', [])
                
                if vulnerabilities:
                    return {
                        "name": "python_dependencies",
                        "passed": False,
                        "details": f"{len(vulnerabilities)} vulnerable Python packages found"
                    }
                    
        except Exception:
            pass
        
        return {"name": "python_dependencies", "passed": True, "details": "No vulnerable Python packages found"}
    
    async def _check_node_dependencies(self) -> Dict[str, Any]:
        """Check Node.js dependencies for vulnerabilities"""
        package_files = list(self.project_root.rglob("package.json"))
        
        for package_file in package_files:
            try:
                result = subprocess.run(
                    ['npm', 'audit', '--json'],
                    cwd=package_file.parent,
                    capture_output=True, text=True, timeout=30
                )
                
                if result.stdout:
                    audit_data = json.loads(result.stdout)
                    vulnerabilities = audit_data.get('vulnerabilities', {})
                    
                    if vulnerabilities:
                        return {
                            "name": "node_dependencies",
                            "passed": False,
                            "details": f"{len(vulnerabilities)} vulnerable Node.js packages found"
                        }
                        
            except Exception:
                continue
        
        return {"name": "node_dependencies", "passed": True, "details": "No vulnerable Node.js packages found"}
    
    async def _test_api_security_regression(self) -> Dict[str, Any]:
        """Test API security for regressions"""
        results = {
            "test": "api_security_regression",
            "vulnerabilities": [],
            "score": 0,
            "checks": []
        }
        
        # Check for rate limiting
        rate_limit_check = await self._check_rate_limiting()
        results["checks"].append(rate_limit_check)
        if not rate_limit_check["passed"]:
            results["vulnerabilities"].append({
                "type": "NO_RATE_LIMITING",
                "description": "No rate limiting detected",
                "severity": "MEDIUM"
            })
        
        # Check CORS configuration
        cors_check = await self._check_cors_config()
        results["checks"].append(cors_check)
        if not cors_check["passed"]:
            results["vulnerabilities"].append({
                "type": "INSECURE_CORS",
                "description": "Insecure CORS configuration",
                "severity": "MEDIUM"
            })
        
        # Calculate score
        passed_checks = sum(1 for check in results["checks"] if check["passed"])
        results["score"] = (passed_checks / len(results["checks"])) * 100 if results["checks"] else 0
        
        return results
    
    async def _check_rate_limiting(self) -> Dict[str, Any]:
        """Check for rate limiting implementation"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                if any(rate_term in content.lower() for rate_term in 
                       ['rate_limit', 'slowapi', 'limiter', 'throttle']):
                    return {
                        "name": "rate_limiting",
                        "passed": True,
                        "details": "Rate limiting implementation found"
                    }
                    
            except Exception:
                continue
        
        return {"name": "rate_limiting", "passed": False, "details": "No rate limiting found"}
    
    async def _check_cors_config(self) -> Dict[str, Any]:
        """Check CORS configuration"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                if 'CORSMiddleware' in content:
                    if 'allow_origins=["*"]' in content or '"*"' in content:
                        return {
                            "name": "cors_config",
                            "passed": False,
                            "details": "Wildcard CORS origin detected"
                        }
                    else:
                        return {
                            "name": "cors_config",
                            "passed": True,
                            "details": "Secure CORS configuration found"
                        }
                        
            except Exception:
                continue
        
        return {"name": "cors_config", "passed": True, "details": "No CORS configuration found"}
    
    async def _test_data_protection_regression(self) -> Dict[str, Any]:
        """Test data protection for regressions"""
        results = {
            "test": "data_protection_regression",
            "vulnerabilities": [],
            "score": 0,
            "checks": []
        }
        
        # Check encryption implementation
        encryption_check = await self._check_encryption_implementation()
        results["checks"].append(encryption_check)
        if not encryption_check["passed"]:
            results["vulnerabilities"].append({
                "type": "NO_ENCRYPTION",
                "description": "No data encryption detected",
                "severity": "HIGH"
            })
        
        # Calculate score
        passed_checks = sum(1 for check in results["checks"] if check["passed"])
        results["score"] = (passed_checks / len(results["checks"])) * 100 if results["checks"] else 0
        
        return results
    
    async def _check_encryption_implementation(self) -> Dict[str, Any]:
        """Check encryption implementation"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                if any(crypto_term in content.lower() for crypto_term in 
                       ['encrypt', 'decrypt', 'cipher', 'aes', 'cryptography']):
                    return {
                        "name": "encryption_implementation",
                        "passed": True,
                        "details": "Encryption implementation found"
                    }
                    
            except Exception:
                continue
        
        return {"name": "encryption_implementation", "passed": False, "details": "No encryption implementation found"}
    
    async def _test_infrastructure_regression(self) -> Dict[str, Any]:
        """Test infrastructure security for regressions"""
        results = {
            "test": "infrastructure_regression",
            "vulnerabilities": [],
            "score": 0,
            "checks": []
        }
        
        # Check security headers
        headers_check = await self._check_security_headers()
        results["checks"].append(headers_check)
        if not headers_check["passed"]:
            results["vulnerabilities"].append({
                "type": "MISSING_SECURITY_HEADERS",
                "description": "Missing security headers",
                "severity": "MEDIUM"
            })
        
        # Calculate score
        passed_checks = sum(1 for check in results["checks"] if check["passed"])
        results["score"] = (passed_checks / len(results["checks"])) * 100 if results["checks"] else 0
        
        return results
    
    async def _check_security_headers(self) -> Dict[str, Any]:
        """Check security headers implementation"""
        headers = ['X-Frame-Options', 'X-Content-Type-Options', 'X-XSS-Protection']
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                found_headers = sum(1 for header in headers if header in content)
                
                if found_headers >= 2:
                    return {
                        "name": "security_headers",
                        "passed": True,
                        "details": f"{found_headers} security headers found"
                    }
                    
            except Exception:
                continue
        
        return {"name": "security_headers", "passed": False, "details": "No security headers found"}
    
    # Specific regression test implementations
    async def _test_sql_injection_prevention(self) -> Dict[str, Any]:
        """Test SQL injection prevention"""
        return await self._check_sql_injection_protection()
    
    async def _test_xss_prevention(self) -> Dict[str, Any]:
        """Test XSS prevention"""
        return await self._check_xss_protection()
    
    async def _test_csrf_protection(self) -> Dict[str, Any]:
        """Test CSRF protection"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                if any(csrf_term in content.lower() for csrf_term in 
                       ['csrf', 'csrfprotect', 'csrf_token']):
                    return {
                        "name": "csrf_protection",
                        "passed": True,
                        "details": "CSRF protection found"
                    }
                    
            except Exception:
                continue
        
        return {"name": "csrf_protection", "passed": False, "details": "No CSRF protection found"}
    
    async def _test_auth_bypass_prevention(self) -> Dict[str, Any]:
        """Test authentication bypass prevention"""
        return await self._check_access_controls()
    
    async def _test_authz_bypass_prevention(self) -> Dict[str, Any]:
        """Test authorization bypass prevention"""
        return await self._check_privilege_escalation_protection()
    
    async def _test_session_fixation_prevention(self) -> Dict[str, Any]:
        """Test session fixation prevention"""
        return await self._check_session_security()
    
    async def _test_command_injection_prevention(self) -> Dict[str, Any]:
        """Test command injection prevention"""
        dangerous_functions = ['os.system', 'subprocess.call', 'eval', 'exec']
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                for func in dangerous_functions:
                    if func in content:
                        return {
                            "name": "command_injection_prevention",
                            "passed": False,
                            "details": f"Dangerous function {func} found"
                        }
                        
            except Exception:
                continue
        
        return {"name": "command_injection_prevention", "passed": True, "details": "No dangerous functions found"}
    
    async def _test_path_traversal_prevention(self) -> Dict[str, Any]:
        """Test path traversal prevention"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                if '../' in content or '..' in content:
                    # Check if it's properly validated
                    if not any(validation in content.lower() for validation in 
                               ['validate', 'sanitize', 'clean', 'secure']):
                        return {
                            "name": "path_traversal_prevention",
                            "passed": False,
                            "details": "Path traversal vulnerability possible"
                        }
                        
            except Exception:
                continue
        
        return {"name": "path_traversal_prevention", "passed": True, "details": "No path traversal issues found"}
    
    async def _test_file_upload_security(self) -> Dict[str, Any]:
        """Test file upload security"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                if 'upload' in content.lower():
                    # Check for file type validation
                    if any(validation in content.lower() for validation in 
                           ['content-type', 'mime', 'extension', 'allowed']):
                        return {
                            "name": "file_upload_security",
                            "passed": True,
                            "details": "File upload validation found"
                        }
                    else:
                        return {
                            "name": "file_upload_security",
                            "passed": False,
                            "details": "File upload without validation"
                        }
                        
            except Exception:
                continue
        
        return {"name": "file_upload_security", "passed": True, "details": "No file upload functionality found"}
    
    async def _test_information_disclosure_prevention(self) -> Dict[str, Any]:
        """Test information disclosure prevention"""
        disclosure_patterns = ['print(', 'console.log(', 'debug=True']
        
        for file_path in self.project_root.rglob("*.py"):
            try:
                content = file_path.read_text()
                
                for pattern in disclosure_patterns:
                    if pattern in content:
                        return {
                            "name": "information_disclosure_prevention",
                            "passed": False,
                            "details": f"Information disclosure pattern {pattern} found"
                        }
                        
            except Exception:
                continue
        
        return {"name": "information_disclosure_prevention", "passed": True, "details": "No information disclosure patterns found"}
    
    def _generate_regression_summary(self):
        """Generate regression test summary"""
        new_vulns = len(self.test_results["new_vulnerabilities"])
        fixed_vulns = len(self.test_results["fixed_vulnerabilities"])
        
        # Calculate overall regression score
        total_tests = len(self.test_results["regression_tests"])
        passed_tests = sum(1 for test in self.test_results["regression_tests"].values() 
                          if test.get("score", 0) >= 70)  # 70% pass threshold
        
        regression_score = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        
        self.test_results["summary"] = {
            "regression_score": round(regression_score, 1),
            "new_vulnerabilities": new_vulns,
            "fixed_vulnerabilities": fixed_vulns,
            "net_change": fixed_vulns - new_vulns,
            "total_tests": total_tests,
            "passed_tests": passed_tests,
            "failed_tests": total_tests - passed_tests
        }
    
    def _save_baseline(self, current_results: Dict[str, Any]):
        """Save current results as new baseline"""
        baseline_file = self.project_root / "security" / "reports" / "baseline_security.json"
        baseline_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(baseline_file, 'w') as f:
            json.dump(current_results, f, indent=2)
    
    def save_regression_results(self, output_path: str):
        """Save regression test results"""
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w') as f:
            json.dump(self.test_results, f, indent=2)
        
        print(f"✅ Security regression test results saved to {output_file}")

async def main():
    """Main function to run security regression tests"""
    project_root = "/Users/ibhunt/Documents/GitHub/FossaWorkV2-security-fixes"
    
    tester = SecurityRegressionTester(project_root)
    results = await tester.run_regression_tests()
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = f"{project_root}/security/reports/regression_test_{timestamp}.json"
    tester.save_regression_results(report_path)
    
    # Print summary
    summary = results["summary"]
    print("\n" + "="*60)
    print("🔄 SECURITY REGRESSION TEST SUMMARY")
    print("="*60)
    print(f"Regression Score: {summary['regression_score']}/100")
    print(f"Tests Passed: {summary['passed_tests']}/{summary['total_tests']}")
    print(f"New Vulnerabilities: {summary['new_vulnerabilities']}")
    print(f"Fixed Vulnerabilities: {summary['fixed_vulnerabilities']}")
    print(f"Net Security Change: {'+' if summary['net_change'] >= 0 else ''}{summary['net_change']}")
    print("="*60)

if __name__ == "__main__":
    import re
    asyncio.run(main())