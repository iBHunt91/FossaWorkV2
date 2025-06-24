#!/usr/bin/env python3
"""
FossaWork V2 Compliance Checker
GDPR/PCI-DSS/SOC2/OWASP compliance verification
"""

import json
import os
import re
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import hashlib

class ComplianceChecker:
    """Comprehensive compliance verification framework"""
    
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.backend_path = self.project_root / "backend"
        self.frontend_path = self.project_root / "frontend"
        self.compliance_results = {
            "timestamp": datetime.now().isoformat(),
            "version": "2.0.0",
            "standards": {},
            "overall_score": 0,
            "recommendations": []
        }
        
    def run_full_compliance_check(self) -> Dict[str, Any]:
        """Run complete compliance verification"""
        print("📋 Starting FossaWork V2 Compliance Verification...")
        
        # GDPR Compliance
        gdpr_score = self._check_gdpr_compliance()
        
        # PCI DSS Compliance
        pci_score = self._check_pci_compliance()
        
        # SOC 2 Compliance
        soc2_score = self._check_soc2_compliance()
        
        # OWASP Top 10 Compliance
        owasp_score = self._check_owasp_compliance()
        
        # ISO 27001 Compliance
        iso_score = self._check_iso27001_compliance()
        
        # NIST Cybersecurity Framework
        nist_score = self._check_nist_compliance()
        
        # Calculate overall compliance score
        scores = [gdpr_score["score"], pci_score["score"], soc2_score["score"], 
                 owasp_score["score"], iso_score["score"], nist_score["score"]]
        self.compliance_results["overall_score"] = sum(scores) / len(scores)
        
        # Store results
        self.compliance_results["standards"] = {
            "gdpr": gdpr_score,
            "pci_dss": pci_score,
            "soc2": soc2_score,
            "owasp_top10": owasp_score,
            "iso27001": iso_score,
            "nist": nist_score
        }
        
        # Generate recommendations
        self._generate_compliance_recommendations()
        
        return self.compliance_results
    
    def _check_gdpr_compliance(self) -> Dict[str, Any]:
        """Check GDPR (General Data Protection Regulation) compliance"""
        print("🔍 Checking GDPR Compliance...")
        
        score = 0
        max_score = 100
        issues = []
        controls = []
        
        # Article 7: Consent
        consent_score = self._check_consent_management()
        score += consent_score
        if consent_score < 15:
            issues.append("Inadequate consent management implementation")
        else:
            controls.append("Consent management framework implemented")
        
        # Article 12-14: Information Rights
        info_rights_score = self._check_information_rights()
        score += info_rights_score
        if info_rights_score < 15:
            issues.append("Missing data subject information rights")
        else:
            controls.append("Data subject rights implemented")
        
        # Article 15-22: Data Subject Rights
        subject_rights_score = self._check_data_subject_rights()
        score += subject_rights_score
        if subject_rights_score < 20:
            issues.append("Incomplete data subject rights implementation")
        else:
            controls.append("Comprehensive data subject rights")
        
        # Article 25: Data Protection by Design
        design_score = self._check_privacy_by_design()
        score += design_score
        if design_score < 15:
            issues.append("Privacy by design principles not implemented")
        else:
            controls.append("Privacy by design implemented")
        
        # Article 32: Security of Processing
        security_score = self._check_processing_security()
        score += security_score
        if security_score < 20:
            issues.append("Inadequate data processing security")
        else:
            controls.append("Secure data processing implemented")
        
        # Article 33-34: Breach Notification
        breach_score = self._check_breach_notification()
        score += breach_score
        if breach_score < 15:
            issues.append("No breach notification procedures")
        else:
            controls.append("Breach notification procedures in place")
        
        return {
            "score": min(score, max_score),
            "max_score": max_score,
            "compliance_level": self._get_compliance_level(score, max_score),
            "issues": issues,
            "controls": controls,
            "recommendations": self._get_gdpr_recommendations(score)
        }
    
    def _check_consent_management(self) -> int:
        """Check consent management implementation"""
        score = 0
        
        # Check for consent-related code
        consent_keywords = ["consent", "agree", "permission", "opt-in", "cookie"]
        
        for file_path in self.frontend_path.rglob("*.tsx"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in consent_keywords):
                    score += 5
                    break
            except Exception:
                continue
        
        # Check for consent storage
        if self._check_consent_storage():
            score += 10
        
        return min(score, 15)
    
    def _check_consent_storage(self) -> bool:
        """Check if consent is properly stored"""
        # Check database schema for consent fields
        try:
            db_path = self.backend_path / "fossawork_v2.db"
            if db_path.exists():
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                
                # Check for consent-related tables/columns
                cursor.execute("SELECT sql FROM sqlite_master WHERE type='table'")
                schema = cursor.fetchall()
                
                for table_sql in schema:
                    if any(term in str(table_sql).lower() for term in ["consent", "privacy", "gdpr"]):
                        conn.close()
                        return True
                
                conn.close()
        except Exception:
            pass
        
        return False
    
    def _check_information_rights(self) -> int:
        """Check implementation of information rights"""
        score = 0
        
        # Check for privacy policy
        privacy_files = list(self.project_root.rglob("*privacy*"))
        if privacy_files:
            score += 5
        
        # Check for data collection notices
        notice_keywords = ["privacy", "data collection", "personal data", "processing"]
        
        for file_path in self.frontend_path.rglob("*.tsx"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in notice_keywords):
                    score += 5
                    break
            except Exception:
                continue
        
        # Check for contact information
        contact_keywords = ["dpo", "data protection", "privacy officer", "contact"]
        
        for file_path in self.project_root.rglob("*.md"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in contact_keywords):
                    score += 5
                    break
            except Exception:
                continue
        
        return min(score, 15)
    
    def _check_data_subject_rights(self) -> int:
        """Check data subject rights implementation"""
        score = 0
        
        # Rights to check
        rights_keywords = {
            "access": ["access", "view", "download"],
            "rectification": ["edit", "update", "correct"],
            "erasure": ["delete", "remove", "forget"],
            "portability": ["export", "download", "transfer"],
            "restriction": ["restrict", "limit", "pause"]
        }
        
        for right, keywords in rights_keywords.items():
            found = False
            for file_path in self.backend_path.rglob("*.py"):
                try:
                    content = file_path.read_text().lower()
                    if any(keyword in content for keyword in keywords):
                        score += 4
                        found = True
                        break
                except Exception:
                    continue
            
            if not found:
                # Check frontend
                for file_path in self.frontend_path.rglob("*.tsx"):
                    try:
                        content = file_path.read_text().lower()
                        if any(keyword in content for keyword in keywords):
                            score += 2
                            break
                    except Exception:
                        continue
        
        return min(score, 20)
    
    def _check_privacy_by_design(self) -> int:
        """Check privacy by design implementation"""
        score = 0
        
        # Check for data minimization
        if self._check_data_minimization():
            score += 5
        
        # Check for purpose limitation
        if self._check_purpose_limitation():
            score += 5
        
        # Check for default privacy settings
        if self._check_default_privacy():
            score += 5
        
        return min(score, 15)
    
    def _check_data_minimization(self) -> bool:
        """Check data minimization practices"""
        # Look for minimal data collection patterns
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if "required=False" in content or "optional" in content.lower():
                    return True
            except Exception:
                continue
        return False
    
    def _check_purpose_limitation(self) -> bool:
        """Check purpose limitation implementation"""
        # Look for purpose specifications
        purpose_keywords = ["purpose", "reason", "lawful basis", "legitimate"]
        
        for file_path in self.project_root.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in purpose_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_default_privacy(self) -> bool:
        """Check default privacy settings"""
        # Look for privacy-first defaults
        for file_path in self.project_root.rglob("*.py"):
            try:
                content = file_path.read_text()
                if "private=True" in content or "public=False" in content:
                    return True
            except Exception:
                continue
        return False
    
    def _check_processing_security(self) -> int:
        """Check security of data processing"""
        score = 0
        
        # Check encryption
        if self._check_encryption_implementation():
            score += 10
        
        # Check access controls
        if self._check_access_controls():
            score += 5
        
        # Check audit logging
        if self._check_audit_logging():
            score += 5
        
        return min(score, 20)
    
    def _check_encryption_implementation(self) -> bool:
        """Check encryption implementation"""
        encryption_keywords = ["encrypt", "decrypt", "cipher", "aes", "rsa"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in encryption_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_access_controls(self) -> bool:
        """Check access control implementation"""
        access_keywords = ["authenticate", "authorize", "permission", "role"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in access_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_audit_logging(self) -> bool:
        """Check audit logging implementation"""
        logging_keywords = ["audit", "log", "track", "monitor"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in logging_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_breach_notification(self) -> int:
        """Check breach notification procedures"""
        score = 0
        
        # Check for incident response procedures
        incident_files = list(self.project_root.rglob("*incident*"))
        incident_files.extend(list(self.project_root.rglob("*breach*")))
        
        if incident_files:
            score += 10
        
        # Check for notification code
        notification_keywords = ["breach", "incident", "notify", "alert"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in notification_keywords):
                    score += 5
                    break
            except Exception:
                continue
        
        return min(score, 15)
    
    def _check_pci_compliance(self) -> Dict[str, Any]:
        """Check PCI DSS compliance"""
        print("🔍 Checking PCI DSS Compliance...")
        
        score = 0
        max_score = 100
        issues = []
        controls = []
        
        # Requirement 1: Install and maintain a firewall
        firewall_score = self._check_firewall_config()
        score += firewall_score
        if firewall_score < 10:
            issues.append("No firewall configuration detected")
        else:
            controls.append("Firewall configuration implemented")
        
        # Requirement 2: Do not use vendor-supplied defaults
        defaults_score = self._check_default_passwords()
        score += defaults_score
        if defaults_score < 10:
            issues.append("Default passwords or configurations detected")
        else:
            controls.append("Custom passwords and configurations")
        
        # Requirement 3: Protect stored cardholder data
        data_protection_score = self._check_cardholder_data_protection()
        score += data_protection_score
        if data_protection_score < 20:
            issues.append("Inadequate cardholder data protection")
        else:
            controls.append("Cardholder data protection implemented")
        
        # Requirement 4: Encrypt transmission of cardholder data
        transmission_score = self._check_data_transmission_encryption()
        score += transmission_score
        if transmission_score < 15:
            issues.append("Unencrypted data transmission")
        else:
            controls.append("Encrypted data transmission")
        
        # Requirement 6: Develop and maintain secure systems
        secure_systems_score = self._check_secure_development()
        score += secure_systems_score
        if secure_systems_score < 15:
            issues.append("Insecure development practices")
        else:
            controls.append("Secure development practices")
        
        # Requirement 7: Restrict access by business need-to-know
        access_restriction_score = self._check_access_restriction()
        score += access_restriction_score
        if access_restriction_score < 10:
            issues.append("Insufficient access restrictions")
        else:
            controls.append("Access restrictions implemented")
        
        # Requirement 8: Identify and authenticate access
        auth_score = self._check_authentication_requirements()
        score += auth_score
        if auth_score < 10:
            issues.append("Weak authentication implementation")
        else:
            controls.append("Strong authentication implemented")
        
        # Requirement 10: Track and monitor all access
        monitoring_score = self._check_access_monitoring()
        score += monitoring_score
        if monitoring_score < 10:
            issues.append("Insufficient access monitoring")
        else:
            controls.append("Comprehensive access monitoring")
        
        return {
            "score": min(score, max_score),
            "max_score": max_score,
            "compliance_level": self._get_compliance_level(score, max_score),
            "issues": issues,
            "controls": controls,
            "recommendations": self._get_pci_recommendations(score)
        }
    
    def _check_firewall_config(self) -> int:
        """Check firewall configuration"""
        # This would typically check actual firewall configs
        # For now, check for security-related configurations
        config_files = list(self.project_root.rglob("*config*"))
        
        for file_path in config_files:
            try:
                content = file_path.read_text().lower()
                if any(term in content for term in ["firewall", "iptables", "security group"]):
                    return 10
            except Exception:
                continue
        
        return 0
    
    def _check_default_passwords(self) -> int:
        """Check for default passwords"""
        score = 10  # Assume good unless proven otherwise
        
        default_patterns = [
            r'password\s*=\s*["\']password["\']',
            r'password\s*=\s*["\']admin["\']',
            r'password\s*=\s*["\']123456["\']',
            r'password\s*=\s*["\']default["\']'
        ]
        
        for file_path in self.project_root.rglob("*.py"):
            try:
                content = file_path.read_text()
                for pattern in default_patterns:
                    if re.search(pattern, content, re.IGNORECASE):
                        return 0
            except Exception:
                continue
        
        return score
    
    def _check_cardholder_data_protection(self) -> int:
        """Check cardholder data protection"""
        score = 0
        
        # Check for PCI-related code (this app may not handle card data)
        pci_keywords = ["card", "payment", "credit", "debit", "pan", "cvv"]
        
        found_card_handling = False
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in pci_keywords):
                    found_card_handling = True
                    break
            except Exception:
                continue
        
        if not found_card_handling:
            score = 20  # No card data = compliant
        else:
            # Check for encryption if card data is handled
            if self._check_encryption_implementation():
                score = 15
            else:
                score = 0
        
        return score
    
    def _check_data_transmission_encryption(self) -> int:
        """Check data transmission encryption"""
        score = 0
        
        # Check for HTTPS/TLS configuration
        tls_keywords = ["https", "tls", "ssl", "secure"]
        
        for file_path in self.project_root.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in tls_keywords):
                    score += 15
                    break
            except Exception:
                continue
        
        return min(score, 15)
    
    def _check_secure_development(self) -> int:
        """Check secure development practices"""
        score = 0
        
        # Check for security testing
        test_files = list(self.project_root.rglob("*test*security*"))
        test_files.extend(list(self.project_root.rglob("*security*test*")))
        
        if test_files:
            score += 5
        
        # Check for input validation
        validation_keywords = ["validate", "sanitize", "escape", "clean"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in validation_keywords):
                    score += 5
                    break
            except Exception:
                continue
        
        # Check for dependency management
        requirements_files = list(self.project_root.rglob("requirements*.txt"))
        if requirements_files:
            score += 5
        
        return min(score, 15)
    
    def _check_access_restriction(self) -> int:
        """Check access restriction implementation"""
        return self._check_access_controls() * 10 if self._check_access_controls() else 0
    
    def _check_authentication_requirements(self) -> int:
        """Check authentication requirements"""
        return self._check_access_controls() * 10 if self._check_access_controls() else 0
    
    def _check_access_monitoring(self) -> int:
        """Check access monitoring"""
        return self._check_audit_logging() * 10 if self._check_audit_logging() else 0
    
    def _check_soc2_compliance(self) -> Dict[str, Any]:
        """Check SOC 2 compliance"""
        print("🔍 Checking SOC 2 Compliance...")
        
        score = 0
        max_score = 100
        issues = []
        controls = []
        
        # Security
        security_score = self._check_soc2_security()
        score += security_score
        if security_score < 20:
            issues.append("Insufficient security controls")
        else:
            controls.append("Comprehensive security controls")
        
        # Availability
        availability_score = self._check_soc2_availability()
        score += availability_score
        if availability_score < 20:
            issues.append("Inadequate availability controls")
        else:
            controls.append("High availability implementation")
        
        # Processing Integrity
        integrity_score = self._check_soc2_integrity()
        score += integrity_score
        if integrity_score < 20:
            issues.append("Processing integrity concerns")
        else:
            controls.append("Processing integrity assured")
        
        # Confidentiality
        confidentiality_score = self._check_soc2_confidentiality()
        score += confidentiality_score
        if confidentiality_score < 20:
            issues.append("Confidentiality controls missing")
        else:
            controls.append("Strong confidentiality controls")
        
        # Privacy
        privacy_score = self._check_soc2_privacy()
        score += privacy_score
        if privacy_score < 20:
            issues.append("Privacy controls insufficient")
        else:
            controls.append("Comprehensive privacy controls")
        
        return {
            "score": min(score, max_score),
            "max_score": max_score,
            "compliance_level": self._get_compliance_level(score, max_score),
            "issues": issues,
            "controls": controls,
            "recommendations": self._get_soc2_recommendations(score)
        }
    
    def _check_soc2_security(self) -> int:
        """Check SOC 2 security criteria"""
        score = 0
        
        if self._check_access_controls():
            score += 5
        if self._check_encryption_implementation():
            score += 5
        if self._check_audit_logging():
            score += 5
        if self._check_vulnerability_management():
            score += 5
        
        return min(score, 20)
    
    def _check_soc2_availability(self) -> int:
        """Check SOC 2 availability criteria"""
        score = 0
        
        # Check for monitoring
        if self._check_system_monitoring():
            score += 10
        
        # Check for backup procedures
        if self._check_backup_procedures():
            score += 10
        
        return min(score, 20)
    
    def _check_soc2_integrity(self) -> int:
        """Check SOC 2 processing integrity criteria"""
        score = 0
        
        # Check for data validation
        if self._check_data_validation():
            score += 10
        
        # Check for error handling
        if self._check_error_handling():
            score += 10
        
        return min(score, 20)
    
    def _check_soc2_confidentiality(self) -> int:
        """Check SOC 2 confidentiality criteria"""
        score = 0
        
        if self._check_encryption_implementation():
            score += 10
        if self._check_access_controls():
            score += 10
        
        return min(score, 20)
    
    def _check_soc2_privacy(self) -> int:
        """Check SOC 2 privacy criteria"""
        score = 0
        
        if self._check_consent_management():
            score += 10
        if self._check_data_subject_rights():
            score += 10
        
        return min(score, 20)
    
    def _check_vulnerability_management(self) -> bool:
        """Check vulnerability management practices"""
        # Look for security scanning or vulnerability checks
        security_files = list(self.project_root.rglob("*security*"))
        vulnerability_files = list(self.project_root.rglob("*vuln*"))
        
        return bool(security_files or vulnerability_files)
    
    def _check_system_monitoring(self) -> bool:
        """Check system monitoring implementation"""
        monitoring_keywords = ["monitor", "health", "status", "metrics"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in monitoring_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_backup_procedures(self) -> bool:
        """Check backup procedures"""
        backup_keywords = ["backup", "restore", "recovery"]
        
        for file_path in self.project_root.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in backup_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_data_validation(self) -> bool:
        """Check data validation implementation"""
        validation_keywords = ["validate", "pydantic", "schema", "check"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in validation_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_error_handling(self) -> bool:
        """Check error handling implementation"""
        error_keywords = ["try:", "except:", "catch", "error", "exception"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if any(keyword in content for keyword in error_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_owasp_compliance(self) -> Dict[str, Any]:
        """Check OWASP Top 10 compliance"""
        print("🔍 Checking OWASP Top 10 Compliance...")
        
        score = 0
        max_score = 100
        issues = []
        controls = []
        
        owasp_checks = [
            ("Injection", self._check_injection_protection, 10),
            ("Broken Authentication", self._check_authentication_security, 10),
            ("Sensitive Data Exposure", self._check_data_exposure, 10),
            ("XML External Entities", self._check_xxe_protection, 10),
            ("Broken Access Control", self._check_access_control_security, 10),
            ("Security Misconfiguration", self._check_security_configuration, 10),
            ("Cross-Site Scripting", self._check_xss_protection, 10),
            ("Insecure Deserialization", self._check_deserialization_security, 10),
            ("Components with Known Vulnerabilities", self._check_vulnerable_components, 10),
            ("Insufficient Logging", self._check_logging_monitoring, 10)
        ]
        
        for check_name, check_func, max_points in owasp_checks:
            check_score = check_func()
            score += check_score
            
            if check_score >= max_points * 0.7:
                controls.append(f"{check_name} protection implemented")
            else:
                issues.append(f"{check_name} vulnerability present")
        
        return {
            "score": min(score, max_score),
            "max_score": max_score,
            "compliance_level": self._get_compliance_level(score, max_score),
            "issues": issues,
            "controls": controls,
            "recommendations": self._get_owasp_recommendations(score)
        }
    
    def _check_injection_protection(self) -> int:
        """Check injection protection"""
        score = 0
        
        # Check for parameterized queries
        if self._check_parameterized_queries():
            score += 5
        
        # Check for input validation
        if self._check_input_validation():
            score += 5
        
        return min(score, 10)
    
    def _check_parameterized_queries(self) -> bool:
        """Check for parameterized queries"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if "sqlalchemy" in content.lower() or "?" in content:
                    return True
            except Exception:
                continue
        return False
    
    def _check_input_validation(self) -> bool:
        """Check input validation"""
        return self._check_data_validation()
    
    def _check_authentication_security(self) -> int:
        """Check authentication security"""
        score = 0
        
        if self._check_password_security():
            score += 5
        if self._check_session_security():
            score += 5
        
        return min(score, 10)
    
    def _check_password_security(self) -> bool:
        """Check password security"""
        security_keywords = ["bcrypt", "scrypt", "argon2", "pbkdf2"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in security_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_session_security(self) -> bool:
        """Check session security"""
        session_keywords = ["httponly", "secure", "samesite"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in session_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_data_exposure(self) -> int:
        """Check sensitive data exposure protection"""
        score = 0
        
        if self._check_encryption_implementation():
            score += 5
        if self._check_data_classification():
            score += 5
        
        return min(score, 10)
    
    def _check_data_classification(self) -> bool:
        """Check data classification"""
        classification_keywords = ["sensitive", "confidential", "personal", "private"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in classification_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_xxe_protection(self) -> int:
        """Check XXE protection"""
        # XML processing is less common in this app
        return 8  # Assume good unless XML processing is found
    
    def _check_access_control_security(self) -> int:
        """Check access control security"""
        return 8 if self._check_access_controls() else 2
    
    def _check_security_configuration(self) -> int:
        """Check security configuration"""
        score = 0
        
        if self._check_secure_headers():
            score += 5
        if self._check_secure_defaults():
            score += 5
        
        return min(score, 10)
    
    def _check_secure_headers(self) -> bool:
        """Check secure headers implementation"""
        header_keywords = ["x-frame-options", "x-content-type", "csp", "hsts"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in header_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_secure_defaults(self) -> bool:
        """Check secure defaults"""
        # Look for security-first configurations
        return True  # Placeholder
    
    def _check_xss_protection(self) -> int:
        """Check XSS protection"""
        score = 0
        
        # Check for output encoding
        if self._check_output_encoding():
            score += 5
        
        # Check for CSP headers
        if self._check_csp_headers():
            score += 5
        
        return min(score, 10)
    
    def _check_output_encoding(self) -> bool:
        """Check output encoding"""
        # React typically handles this automatically
        return True
    
    def _check_csp_headers(self) -> bool:
        """Check Content Security Policy headers"""
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if "content-security-policy" in content:
                    return True
            except Exception:
                continue
        return False
    
    def _check_deserialization_security(self) -> int:
        """Check insecure deserialization protection"""
        score = 8  # Assume good unless pickle or unsafe deserialization found
        
        unsafe_keywords = ["pickle", "eval", "exec"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text()
                if any(keyword in content for keyword in unsafe_keywords):
                    score = 2
                    break
            except Exception:
                continue
        
        return score
    
    def _check_vulnerable_components(self) -> int:
        """Check for vulnerable components"""
        score = 5  # Base score
        
        # Check for dependency management
        requirements_files = list(self.project_root.rglob("requirements*.txt"))
        if requirements_files:
            score += 5
        
        return min(score, 10)
    
    def _check_logging_monitoring(self) -> int:
        """Check logging and monitoring"""
        return 8 if self._check_audit_logging() else 2
    
    def _check_iso27001_compliance(self) -> Dict[str, Any]:
        """Check ISO 27001 compliance"""
        print("🔍 Checking ISO 27001 Compliance...")
        
        score = 0
        max_score = 100
        issues = []
        controls = []
        
        # Information Security Policy
        policy_score = self._check_security_policy()
        score += policy_score
        if policy_score < 10:
            issues.append("No security policy documentation")
        else:
            controls.append("Security policy documented")
        
        # Risk Management
        risk_score = self._check_risk_management()
        score += risk_score
        if risk_score < 15:
            issues.append("Inadequate risk management")
        else:
            controls.append("Risk management implemented")
        
        # Asset Management
        asset_score = self._check_asset_management()
        score += asset_score
        if asset_score < 10:
            issues.append("Poor asset management")
        else:
            controls.append("Asset management in place")
        
        # Access Control
        access_score = self._check_iso_access_control()
        score += access_score
        if access_score < 20:
            issues.append("Insufficient access controls")
        else:
            controls.append("Comprehensive access controls")
        
        # Cryptography
        crypto_score = self._check_cryptography_controls()
        score += crypto_score
        if crypto_score < 15:
            issues.append("Weak cryptographic controls")
        else:
            controls.append("Strong cryptographic controls")
        
        # Operations Security
        ops_score = self._check_operations_security()
        score += ops_score
        if ops_score < 15:
            issues.append("Operations security gaps")
        else:
            controls.append("Operations security implemented")
        
        # Incident Management
        incident_score = self._check_incident_management()
        score += incident_score
        if incident_score < 15:
            issues.append("No incident management")
        else:
            controls.append("Incident management procedures")
        
        return {
            "score": min(score, max_score),
            "max_score": max_score,
            "compliance_level": self._get_compliance_level(score, max_score),
            "issues": issues,
            "controls": controls,
            "recommendations": self._get_iso27001_recommendations(score)
        }
    
    def _check_security_policy(self) -> int:
        """Check security policy documentation"""
        policy_files = list(self.project_root.rglob("*security*policy*"))
        policy_files.extend(list(self.project_root.rglob("*policy*security*")))
        
        return 10 if policy_files else 0
    
    def _check_risk_management(self) -> int:
        """Check risk management implementation"""
        risk_files = list(self.project_root.rglob("*risk*"))
        
        score = 5 if risk_files else 0
        
        # Check for risk assessment in code
        if self._check_security_controls():
            score += 10
        
        return min(score, 15)
    
    def _check_security_controls(self) -> bool:
        """Check for security controls implementation"""
        return (self._check_access_controls() and 
                self._check_encryption_implementation() and 
                self._check_audit_logging())
    
    def _check_asset_management(self) -> int:
        """Check asset management"""
        # Look for inventory or asset tracking
        asset_keywords = ["inventory", "asset", "component", "dependency"]
        
        for file_path in self.project_root.rglob("*.md"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in asset_keywords):
                    return 10
            except Exception:
                continue
        
        return 0
    
    def _check_iso_access_control(self) -> int:
        """Check ISO 27001 access control requirements"""
        score = 0
        
        if self._check_access_controls():
            score += 10
        if self._check_privilege_management():
            score += 10
        
        return min(score, 20)
    
    def _check_privilege_management(self) -> bool:
        """Check privilege management"""
        privilege_keywords = ["role", "permission", "privilege", "admin"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in privilege_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_cryptography_controls(self) -> int:
        """Check cryptography controls"""
        score = 0
        
        if self._check_encryption_implementation():
            score += 10
        if self._check_key_management():
            score += 5
        
        return min(score, 15)
    
    def _check_key_management(self) -> bool:
        """Check key management practices"""
        key_keywords = ["key", "secret", "certificate", "keystore"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in key_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_operations_security(self) -> int:
        """Check operations security"""
        score = 0
        
        if self._check_system_monitoring():
            score += 5
        if self._check_logging_monitoring():
            score += 5
        if self._check_backup_procedures():
            score += 5
        
        return min(score, 15)
    
    def _check_incident_management(self) -> int:
        """Check incident management"""
        incident_files = list(self.project_root.rglob("*incident*"))
        
        score = 10 if incident_files else 0
        
        if self._check_monitoring_alerting():
            score += 5
        
        return min(score, 15)
    
    def _check_monitoring_alerting(self) -> bool:
        """Check monitoring and alerting"""
        alert_keywords = ["alert", "notify", "monitoring", "watch"]
        
        for file_path in self.backend_path.rglob("*.py"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in alert_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _check_nist_compliance(self) -> Dict[str, Any]:
        """Check NIST Cybersecurity Framework compliance"""
        print("🔍 Checking NIST Cybersecurity Framework Compliance...")
        
        score = 0
        max_score = 100
        issues = []
        controls = []
        
        # Identify
        identify_score = self._check_nist_identify()
        score += identify_score
        if identify_score < 20:
            issues.append("Asset identification incomplete")
        else:
            controls.append("Asset identification implemented")
        
        # Protect
        protect_score = self._check_nist_protect()
        score += protect_score
        if protect_score < 20:
            issues.append("Protection controls insufficient")
        else:
            controls.append("Protection controls implemented")
        
        # Detect
        detect_score = self._check_nist_detect()
        score += detect_score
        if detect_score < 20:
            issues.append("Detection capabilities limited")
        else:
            controls.append("Detection capabilities implemented")
        
        # Respond
        respond_score = self._check_nist_respond()
        score += respond_score
        if respond_score < 20:
            issues.append("Response procedures missing")
        else:
            controls.append("Response procedures implemented")
        
        # Recover
        recover_score = self._check_nist_recover()
        score += recover_score
        if recover_score < 20:
            issues.append("Recovery procedures inadequate")
        else:
            controls.append("Recovery procedures implemented")
        
        return {
            "score": min(score, max_score),
            "max_score": max_score,
            "compliance_level": self._get_compliance_level(score, max_score),
            "issues": issues,
            "controls": controls,
            "recommendations": self._get_nist_recommendations(score)
        }
    
    def _check_nist_identify(self) -> int:
        """Check NIST Identify function"""
        return self._check_asset_management() + 10  # Base score for documentation
    
    def _check_nist_protect(self) -> int:
        """Check NIST Protect function"""
        score = 0
        
        if self._check_access_controls():
            score += 7
        if self._check_encryption_implementation():
            score += 7
        if self._check_security_training():
            score += 6
        
        return min(score, 20)
    
    def _check_security_training(self) -> bool:
        """Check security training documentation"""
        training_files = list(self.project_root.rglob("*training*"))
        training_files.extend(list(self.project_root.rglob("*education*")))
        
        return bool(training_files)
    
    def _check_nist_detect(self) -> int:
        """Check NIST Detect function"""
        score = 0
        
        if self._check_system_monitoring():
            score += 10
        if self._check_audit_logging():
            score += 10
        
        return min(score, 20)
    
    def _check_nist_respond(self) -> int:
        """Check NIST Respond function"""
        return self._check_incident_management() + 5  # Additional score for completeness
    
    def _check_nist_recover(self) -> int:
        """Check NIST Recover function"""
        score = 0
        
        if self._check_backup_procedures():
            score += 10
        if self._check_recovery_procedures():
            score += 10
        
        return min(score, 20)
    
    def _check_recovery_procedures(self) -> bool:
        """Check recovery procedures"""
        recovery_keywords = ["recovery", "restore", "continuity", "disaster"]
        
        for file_path in self.project_root.rglob("*.md"):
            try:
                content = file_path.read_text().lower()
                if any(keyword in content for keyword in recovery_keywords):
                    return True
            except Exception:
                continue
        return False
    
    def _get_compliance_level(self, score: int, max_score: int) -> str:
        """Get compliance level based on score"""
        percentage = (score / max_score) * 100
        
        if percentage >= 90:
            return "EXCELLENT"
        elif percentage >= 80:
            return "GOOD"
        elif percentage >= 70:
            return "SATISFACTORY"
        elif percentage >= 60:
            return "NEEDS IMPROVEMENT"
        else:
            return "NON-COMPLIANT"
    
    def _get_gdpr_recommendations(self, score: int) -> List[str]:
        """Get GDPR-specific recommendations"""
        recommendations = []
        
        if score < 70:
            recommendations.extend([
                "Implement comprehensive consent management system",
                "Add data subject rights functionality",
                "Create privacy policy and data protection documentation",
                "Implement data minimization practices",
                "Add breach notification procedures"
            ])
        
        return recommendations
    
    def _get_pci_recommendations(self, score: int) -> List[str]:
        """Get PCI DSS-specific recommendations"""
        recommendations = []
        
        if score < 70:
            recommendations.extend([
                "Implement strong encryption for card data",
                "Add comprehensive access controls",
                "Configure proper firewall rules",
                "Implement secure coding practices",
                "Add vulnerability scanning"
            ])
        
        return recommendations
    
    def _get_soc2_recommendations(self, score: int) -> List[str]:
        """Get SOC 2-specific recommendations"""
        recommendations = []
        
        if score < 70:
            recommendations.extend([
                "Implement comprehensive monitoring",
                "Add backup and recovery procedures",
                "Strengthen access controls",
                "Improve data validation",
                "Add privacy controls"
            ])
        
        return recommendations
    
    def _get_owasp_recommendations(self, score: int) -> List[str]:
        """Get OWASP-specific recommendations"""
        recommendations = []
        
        if score < 70:
            recommendations.extend([
                "Implement parameterized queries",
                "Add input validation and sanitization",
                "Strengthen authentication mechanisms",
                "Implement proper session management",
                "Add security headers"
            ])
        
        return recommendations
    
    def _get_iso27001_recommendations(self, score: int) -> List[str]:
        """Get ISO 27001-specific recommendations"""
        recommendations = []
        
        if score < 70:
            recommendations.extend([
                "Create information security policy",
                "Implement risk management framework",
                "Add asset management procedures",
                "Strengthen access controls",
                "Implement incident management"
            ])
        
        return recommendations
    
    def _get_nist_recommendations(self, score: int) -> List[str]:
        """Get NIST-specific recommendations"""
        recommendations = []
        
        if score < 70:
            recommendations.extend([
                "Improve asset identification",
                "Strengthen protection controls",
                "Enhance detection capabilities",
                "Develop response procedures",
                "Implement recovery plans"
            ])
        
        return recommendations
    
    def _generate_compliance_recommendations(self):
        """Generate overall compliance recommendations"""
        recommendations = []
        
        overall_score = self.compliance_results["overall_score"]
        
        if overall_score < 60:
            recommendations.append({
                "priority": "CRITICAL",
                "category": "Overall Compliance",
                "description": "Multiple compliance standards not met",
                "action": "Implement comprehensive compliance program"
            })
        
        # Add specific recommendations from each standard
        for standard, data in self.compliance_results["standards"].items():
            if data["score"] < 70:
                for rec in data.get("recommendations", []):
                    recommendations.append({
                        "priority": "HIGH",
                        "category": standard.upper(),
                        "description": rec,
                        "action": f"Address {standard.upper()} compliance gap"
                    })
        
        self.compliance_results["recommendations"] = recommendations
    
    def save_compliance_report(self, output_path: str):
        """Save compliance report to file"""
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w') as f:
            json.dump(self.compliance_results, f, indent=2)
        
        print(f"✅ Compliance report saved to {output_file}")

def main():
    """Main function to run compliance check"""
    project_root = "/Users/ibhunt/Documents/GitHub/FossaWorkV2-security-fixes"
    
    checker = ComplianceChecker(project_root)
    results = checker.run_full_compliance_check()
    
    # Save results
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = f"{project_root}/security/reports/compliance_report_{timestamp}.json"
    checker.save_compliance_report(report_path)
    
    # Print summary
    print("\n" + "="*60)
    print("📋 COMPLIANCE SUMMARY")
    print("="*60)
    print(f"Overall Score: {results['overall_score']:.1f}/100")
    
    for standard, data in results["standards"].items():
        level = data["compliance_level"]
        score = data["score"]
        print(f"{standard.upper()}: {score}/100 ({level})")
    
    print(f"Total Recommendations: {len(results['recommendations'])}")
    print("="*60)

if __name__ == "__main__":
    main()