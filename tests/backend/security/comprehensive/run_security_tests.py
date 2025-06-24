#!/usr/bin/env python3
"""
Security Test Suite Runner
Runs all comprehensive security tests with detailed reporting
"""

import os
import sys
import subprocess
import time
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))


class SecurityTestRunner:
    """Runs comprehensive security test suite"""
    
    def __init__(self):
        self.test_dir = Path(__file__).parent
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "total_tests": 0,
            "passed": 0,
            "failed": 0,
            "skipped": 0,
            "duration": 0,
            "test_results": {},
            "security_score": 0,
        }
    
    def run_test_module(self, module_name: str, description: str) -> Tuple[bool, str]:
        """Run a single test module"""
        print(f"\n{'='*60}")
        print(f"Running {description}...")
        print(f"{'='*60}")
        
        test_file = self.test_dir / f"{module_name}.py"
        if not test_file.exists():
            return False, f"Test file not found: {test_file}"
        
        start_time = time.time()
        
        # Run pytest on the module
        cmd = [
            sys.executable, "-m", "pytest",
            str(test_file),
            "-v",  # Verbose
            "--tb=short",  # Short traceback
            "--no-header",  # No header
            "-ra",  # Show all test outcomes
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=str(self.test_dir.parent.parent.parent.parent)
            )
            
            duration = time.time() - start_time
            
            # Parse results
            output = result.stdout + result.stderr
            passed = output.count(" PASSED")
            failed = output.count(" FAILED")
            skipped = output.count(" SKIPPED")
            
            self.results["test_results"][module_name] = {
                "description": description,
                "passed": passed,
                "failed": failed,
                "skipped": skipped,
                "duration": duration,
                "success": result.returncode == 0,
                "output": output if result.returncode != 0 else "All tests passed"
            }
            
            self.results["total_tests"] += passed + failed + skipped
            self.results["passed"] += passed
            self.results["failed"] += failed
            self.results["skipped"] += skipped
            
            if result.returncode == 0:
                print(f"✅ {description}: All tests passed ({passed} tests in {duration:.2f}s)")
                return True, "Success"
            else:
                print(f"❌ {description}: {failed} tests failed")
                print(f"Output:\n{output}")
                return False, output
                
        except Exception as e:
            error_msg = f"Error running tests: {str(e)}"
            print(f"❌ {error_msg}")
            self.results["test_results"][module_name] = {
                "description": description,
                "error": error_msg,
                "success": False
            }
            return False, error_msg
    
    def run_all_tests(self):
        """Run all security tests"""
        print(f"\n{'#'*60}")
        print("COMPREHENSIVE SECURITY TEST SUITE")
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'#'*60}")
        
        start_time = time.time()
        
        # Define test modules
        test_modules = [
            ("test_authentication_bypass", "Authentication Bypass Tests"),
            ("test_security_headers", "Security Headers Verification"),
            ("test_n_plus_one_queries", "N+1 Query Detection"),
            ("test_input_validation", "Input Validation & XSS/SQL Injection"),
            ("test_rate_limiting", "Rate Limiting & DDoS Protection"),
            ("test_cors_configuration", "CORS Configuration Security"),
        ]
        
        # Run each test module
        all_passed = True
        for module, description in test_modules:
            passed, _ = self.run_test_module(module, description)
            if not passed:
                all_passed = False
        
        # Calculate total duration
        self.results["duration"] = time.time() - start_time
        
        # Calculate security score
        if self.results["total_tests"] > 0:
            self.results["security_score"] = (
                self.results["passed"] / self.results["total_tests"] * 100
            )
        
        # Print summary
        self.print_summary()
        
        # Save results
        self.save_results()
        
        return all_passed
    
    def print_summary(self):
        """Print test summary"""
        print(f"\n{'#'*60}")
        print("SECURITY TEST SUMMARY")
        print(f"{'#'*60}")
        
        print(f"\nTotal Tests: {self.results['total_tests']}")
        print(f"✅ Passed: {self.results['passed']}")
        print(f"❌ Failed: {self.results['failed']}")
        print(f"⏭️  Skipped: {self.results['skipped']}")
        print(f"\nDuration: {self.results['duration']:.2f} seconds")
        print(f"Security Score: {self.results['security_score']:.1f}%")
        
        if self.results['failed'] > 0:
            print(f"\n{'⚠️  WARNING: Security vulnerabilities detected!'}")
            print("\nFailed Tests:")
            for module, result in self.results["test_results"].items():
                if not result.get("success", True):
                    print(f"  - {result['description']}: {result.get('failed', 0)} failures")
        else:
            print(f"\n{'✅ All security tests passed!'}")
        
        # Security recommendations based on score
        score = self.results['security_score']
        print("\nSecurity Assessment:")
        if score == 100:
            print("🏆 Excellent: All security tests passed")
        elif score >= 90:
            print("✅ Good: Minor security issues to address")
        elif score >= 80:
            print("⚠️  Fair: Several security issues need attention")
        elif score >= 70:
            print("🚨 Poor: Significant security vulnerabilities present")
        else:
            print("❌ Critical: Major security overhaul required")
    
    def save_results(self):
        """Save test results to JSON file"""
        results_file = self.test_dir / f"security_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        with open(results_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        
        print(f"\nResults saved to: {results_file}")
    
    def run_specific_test(self, test_name: str):
        """Run a specific test by name"""
        print(f"\nRunning specific test: {test_name}")
        
        # Map test names to modules
        test_map = {
            "auth": "test_authentication_bypass",
            "headers": "test_security_headers",
            "n+1": "test_n_plus_one_queries",
            "input": "test_input_validation",
            "rate": "test_rate_limiting",
            "cors": "test_cors_configuration",
        }
        
        module = test_map.get(test_name, test_name)
        if module in test_map.values() or Path(self.test_dir / f"{module}.py").exists():
            return self.run_test_module(module, f"Specific test: {module}")
        else:
            print(f"Unknown test: {test_name}")
            print(f"Available tests: {', '.join(test_map.keys())}")
            return False, "Unknown test"


def main():
    """Main entry point"""
    runner = SecurityTestRunner()
    
    # Check command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "--help":
            print("Usage: python run_security_tests.py [test_name]")
            print("\nAvailable tests:")
            print("  auth    - Authentication bypass tests")
            print("  headers - Security headers tests")
            print("  n+1     - N+1 query detection tests")
            print("  input   - Input validation tests")
            print("  rate    - Rate limiting tests")
            print("  cors    - CORS configuration tests")
            print("\nRun without arguments to run all tests")
            sys.exit(0)
        else:
            # Run specific test
            success, _ = runner.run_specific_test(sys.argv[1])
            sys.exit(0 if success else 1)
    
    # Run all tests
    all_passed = runner.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()