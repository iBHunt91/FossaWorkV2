#!/usr/bin/env python3
"""
Security Audit Workflow Script
Combines multiple security tools with Claude SDK for comprehensive security analysis
"""

import asyncio
import json
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging

# Add backend to path for imports
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SecurityAuditWorkflow:
    """Comprehensive security audit workflow"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent.parent
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "vulnerabilities": [],
            "security_issues": [],
            "recommendations": [],
            "summary": {}
        }
    
    async def run_safety_check(self) -> Dict[str, Any]:
        """Run safety to check for vulnerable dependencies"""
        logger.info("🔍 Running safety check for vulnerable dependencies...")
        
        try:
            # Run safety check
            result = subprocess.run(
                ["safety", "check", "--json", "--continue-on-error"],
                cwd=self.project_root / "backend",
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                logger.info("✅ No vulnerabilities found in dependencies")
                return {"status": "clean", "vulnerabilities": []}
            else:
                vulnerabilities = json.loads(result.stdout)
                logger.warning(f"⚠️ Found {len(vulnerabilities)} vulnerabilities")
                self.results["vulnerabilities"].extend(vulnerabilities)
                return {"status": "vulnerable", "vulnerabilities": vulnerabilities}
                
        except Exception as e:
            logger.error(f"❌ Safety check failed: {e}")
            return {"status": "error", "error": str(e)}
    
    async def run_bandit_scan(self) -> Dict[str, Any]:
        """Run bandit for Python security issues"""
        logger.info("🔍 Running bandit security scan...")
        
        try:
            result = subprocess.run(
                ["bandit", "-r", "backend/", "-f", "json", "--skip", "B101"],
                cwd=self.project_root,
                capture_output=True,
                text=True
            )
            
            if result.stdout:
                bandit_results = json.loads(result.stdout)
                issues = bandit_results.get("results", [])
                
                if issues:
                    logger.warning(f"⚠️ Found {len(issues)} security issues")
                    self.results["security_issues"].extend(issues)
                else:
                    logger.info("✅ No security issues found by bandit")
                    
                return {"status": "completed", "issues": issues}
            else:
                return {"status": "clean", "issues": []}
                
        except Exception as e:
            logger.error(f"❌ Bandit scan failed: {e}")
            return {"status": "error", "error": str(e)}
    
    async def check_secrets(self) -> Dict[str, Any]:
        """Check for hardcoded secrets"""
        logger.info("🔍 Checking for hardcoded secrets...")
        
        try:
            # Run detect-secrets scan
            result = subprocess.run(
                ["detect-secrets", "scan", "--all-files"],
                cwd=self.project_root,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0 and result.stdout:
                secrets_data = json.loads(result.stdout)
                secrets_found = secrets_data.get("results", {})
                
                total_secrets = sum(len(v) for v in secrets_found.values())
                
                if total_secrets > 0:
                    logger.warning(f"⚠️ Found {total_secrets} potential secrets")
                    self.results["security_issues"].append({
                        "type": "hardcoded_secrets",
                        "count": total_secrets,
                        "files": list(secrets_found.keys())
                    })
                else:
                    logger.info("✅ No hardcoded secrets found")
                    
                return {"status": "completed", "secrets_count": total_secrets}
            else:
                return {"status": "clean", "secrets_count": 0}
                
        except Exception as e:
            logger.error(f"❌ Secret detection failed: {e}")
            return {"status": "error", "error": str(e)}
    
    async def check_auth_endpoints(self) -> Dict[str, Any]:
        """Check if API endpoints have proper authentication"""
        logger.info("🔍 Checking API endpoint authentication...")
        
        unprotected_endpoints = []
        
        # Get all route files
        routes_dir = self.project_root / "backend" / "app" / "routes"
        
        for route_file in routes_dir.glob("*.py"):
            if route_file.name == "__init__.py":
                continue
                
            content = route_file.read_text()
            
            # Simple pattern matching for endpoints without authentication
            import re
            
            # Find all route decorators
            route_pattern = r'@router\.(get|post|put|delete|patch)\([^)]+\)'
            routes = re.findall(route_pattern, content, re.MULTILINE)
            
            # Check if routes have authentication dependencies
            for i, route in enumerate(routes):
                # Look for the function definition after the route
                func_start = content.find(route)
                func_end = content.find("\n@", func_start + 1)
                if func_end == -1:
                    func_end = len(content)
                
                func_content = content[func_start:func_end]
                
                # Check for authentication dependencies
                if not any(auth in func_content for auth in ["get_current_user", "Depends(get_current_user)", "require_auth"]):
                    # Extract endpoint path
                    path_match = re.search(r'["\'](/[^"\']+)["\']', func_content)
                    if path_match:
                        endpoint = path_match.group(1)
                        unprotected_endpoints.append({
                            "file": route_file.name,
                            "method": routes[i],
                            "endpoint": endpoint
                        })
        
        if unprotected_endpoints:
            logger.warning(f"⚠️ Found {len(unprotected_endpoints)} unprotected endpoints")
            self.results["security_issues"].append({
                "type": "unprotected_endpoints",
                "endpoints": unprotected_endpoints
            })
        else:
            logger.info("✅ All endpoints appear to have authentication")
            
        return {"status": "completed", "unprotected_count": len(unprotected_endpoints)}
    
    async def check_cors_configuration(self) -> Dict[str, Any]:
        """Check CORS configuration for security issues"""
        logger.info("🔍 Checking CORS configuration...")
        
        # Check main.py for CORS settings
        main_file = self.project_root / "backend" / "app" / "main.py"
        
        if main_file.exists():
            content = main_file.read_text()
            
            cors_issues = []
            
            # Check for overly permissive CORS
            if 'allow_origins=["*"]' in content or "allow_origins=['*']" in content:
                cors_issues.append("CORS allows all origins (*)") 
                
            if "allow_credentials=True" in content and "*" in content:
                cors_issues.append("CORS allows credentials with wildcard origin")
                
            if cors_issues:
                logger.warning(f"⚠️ Found {len(cors_issues)} CORS issues")
                self.results["security_issues"].append({
                    "type": "cors_configuration",
                    "issues": cors_issues
                })
            else:
                logger.info("✅ CORS configuration appears secure")
                
            return {"status": "completed", "issues_count": len(cors_issues)}
        
        return {"status": "error", "error": "main.py not found"}
    
    async def generate_recommendations(self) -> None:
        """Generate security recommendations based on findings"""
        logger.info("📝 Generating security recommendations...")
        
        recommendations = []
        
        # Vulnerability recommendations
        if self.results["vulnerabilities"]:
            recommendations.append({
                "priority": "HIGH",
                "category": "Dependencies",
                "recommendation": "Update vulnerable dependencies immediately",
                "action": "Run: pip install --upgrade [package_name] for each vulnerable package"
            })
        
        # Secret recommendations
        secrets_found = any(issue["type"] == "hardcoded_secrets" for issue in self.results["security_issues"])
        if secrets_found:
            recommendations.append({
                "priority": "CRITICAL",
                "category": "Secrets Management",
                "recommendation": "Remove all hardcoded secrets and use environment variables or a secret management service",
                "action": "1. Remove secrets from code\n2. Add to .env file\n3. Update .gitignore\n4. Rotate compromised secrets"
            })
        
        # Authentication recommendations
        unprotected = any(issue["type"] == "unprotected_endpoints" for issue in self.results["security_issues"])
        if unprotected:
            recommendations.append({
                "priority": "HIGH",
                "category": "API Security",
                "recommendation": "Add authentication to all API endpoints",
                "action": "Add Depends(get_current_user) to all endpoint function parameters"
            })
        
        # CORS recommendations
        cors_issues = any(issue["type"] == "cors_configuration" for issue in self.results["security_issues"])
        if cors_issues:
            recommendations.append({
                "priority": "MEDIUM",
                "category": "CORS Security",
                "recommendation": "Restrict CORS to specific allowed origins",
                "action": "Replace allow_origins=['*'] with specific domain list"
            })
        
        # General recommendations
        recommendations.extend([
            {
                "priority": "MEDIUM",
                "category": "Monitoring",
                "recommendation": "Implement security event monitoring",
                "action": "Use the metrics service to track authentication failures and suspicious activities"
            },
            {
                "priority": "LOW",
                "category": "Documentation",
                "recommendation": "Document security practices",
                "action": "Create SECURITY.md with security policies and incident response procedures"
            }
        ])
        
        self.results["recommendations"] = recommendations
    
    async def generate_summary(self) -> None:
        """Generate audit summary"""
        total_issues = (
            len(self.results["vulnerabilities"]) +
            len(self.results["security_issues"])
        )
        
        critical_count = sum(1 for rec in self.results["recommendations"] if rec["priority"] == "CRITICAL")
        high_count = sum(1 for rec in self.results["recommendations"] if rec["priority"] == "HIGH")
        
        self.results["summary"] = {
            "total_issues": total_issues,
            "critical_issues": critical_count,
            "high_priority_issues": high_count,
            "scan_duration": "N/A",  # Would need to track actual duration
            "status": "FAIL" if critical_count > 0 else ("WARN" if high_count > 0 else "PASS")
        }
    
    async def save_report(self) -> str:
        """Save audit report to file"""
        report_dir = self.project_root / "docs" / "reports"
        report_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = report_dir / f"security_audit_{timestamp}.json"
        
        with open(report_file, "w") as f:
            json.dump(self.results, f, indent=2, default=str)
        
        logger.info(f"📄 Report saved to: {report_file}")
        return str(report_file)
    
    async def run_full_audit(self) -> Dict[str, Any]:
        """Run complete security audit workflow"""
        logger.info("🚀 Starting comprehensive security audit...")
        
        # Run all security checks
        await self.run_safety_check()
        await self.run_bandit_scan()
        await self.check_secrets()
        await self.check_auth_endpoints()
        await self.check_cors_configuration()
        
        # Generate recommendations and summary
        await self.generate_recommendations()
        await self.generate_summary()
        
        # Save report
        report_path = await self.save_report()
        
        # Print summary
        logger.info("\n" + "="*50)
        logger.info("🔒 SECURITY AUDIT SUMMARY")
        logger.info("="*50)
        logger.info(f"Total Issues Found: {self.results['summary']['total_issues']}")
        logger.info(f"Critical Issues: {self.results['summary']['critical_issues']}")
        logger.info(f"High Priority Issues: {self.results['summary']['high_priority_issues']}")
        logger.info(f"Overall Status: {self.results['summary']['status']}")
        logger.info(f"Full Report: {report_path}")
        logger.info("="*50 + "\n")
        
        if self.results["recommendations"]:
            logger.info("📋 TOP RECOMMENDATIONS:")
            for rec in sorted(self.results["recommendations"], key=lambda x: ["CRITICAL", "HIGH", "MEDIUM", "LOW"].index(x["priority"])):
                if rec["priority"] in ["CRITICAL", "HIGH"]:
                    logger.info(f"\n[{rec['priority']}] {rec['category']}")
                    logger.info(f"  → {rec['recommendation']}")
                    logger.info(f"  Action: {rec['action']}")
        
        return self.results


async def main():
    """Main entry point"""
    workflow = SecurityAuditWorkflow()
    await workflow.run_full_audit()


if __name__ == "__main__":
    asyncio.run(main())