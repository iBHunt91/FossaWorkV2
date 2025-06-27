#!/usr/bin/env python3
"""
Run all scheduling system tests with coverage report
"""

import sys
import subprocess
import os
from pathlib import Path

# Get the backend directory
backend_dir = Path(__file__).parent.parent.parent.parent / "backend"
os.chdir(backend_dir)

# Add backend to Python path
sys.path.insert(0, str(backend_dir))

def run_tests():
    """Run all scheduling tests with coverage"""
    print("=" * 60)
    print("🧪 Running Scheduling System Tests")
    print("=" * 60)
    
    # Test commands
    test_commands = [
        # Unit tests
        {
            "name": "Database Models",
            "cmd": ["pytest", "tests/backend/scheduling/test_scraping_models.py", "-v", "--tb=short"]
        },
        {
            "name": "API Endpoints",
            "cmd": ["pytest", "tests/backend/scheduling/test_scraping_schedules_api.py", "-v", "--tb=short"]
        },
        {
            "name": "Scheduler Daemon",
            "cmd": ["pytest", "tests/backend/scheduling/test_scheduler_daemon.py", "-v", "--tb=short"]
        },
        {
            "name": "Integration Tests",
            "cmd": ["pytest", "tests/integration/scheduling/test_scheduling_integration.py", "-v", "--tb=short"]
        }
    ]
    
    # Run tests with coverage
    coverage_cmd = [
        "coverage", "run", "--source=app,scheduler_daemon",
        "-m", "pytest", 
        "tests/backend/scheduling/",
        "tests/integration/scheduling/",
        "-v", "--tb=short"
    ]
    
    print("\n📊 Running all tests with coverage...\n")
    
    try:
        # Run tests with coverage
        result = subprocess.run(coverage_cmd, capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print(result.stderr)
        
        if result.returncode == 0:
            print("\n✅ All tests passed!")
            
            # Generate coverage report
            print("\n📈 Coverage Report:")
            subprocess.run(["coverage", "report", "-m", "--include=*scheduling*,*scraping*,scheduler_daemon*"])
            
            # Generate HTML coverage report
            subprocess.run(["coverage", "html", "--include=*scheduling*,*scraping*,scheduler_daemon*"])
            print("\n📁 HTML coverage report generated in htmlcov/")
            
        else:
            print("\n❌ Some tests failed!")
            return 1
            
    except FileNotFoundError:
        print("\n⚠️  Coverage not installed. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "coverage"])
        print("\n🔄 Please run the script again.")
        return 1
    
    # Run individual test suites for detailed output
    print("\n" + "=" * 60)
    print("📋 Detailed Test Results by Category")
    print("=" * 60)
    
    for test_info in test_commands:
        print(f"\n🔍 {test_info['name']}:")
        print("-" * 40)
        
        result = subprocess.run(test_info['cmd'], capture_output=True, text=True)
        
        # Extract summary line
        lines = result.stdout.split('\n')
        for line in lines:
            if "passed" in line or "failed" in line or "error" in line:
                print(f"   {line.strip()}")
        
        if result.returncode != 0:
            print(f"   ❌ Failed")
        else:
            print(f"   ✅ Passed")
    
    return 0


def run_specific_test(test_name):
    """Run a specific test file"""
    test_files = {
        "models": "tests/backend/scheduling/test_scraping_models.py",
        "api": "tests/backend/scheduling/test_scraping_schedules_api.py",
        "daemon": "tests/backend/scheduling/test_scheduler_daemon.py",
        "integration": "tests/integration/scheduling/test_scheduling_integration.py"
    }
    
    if test_name not in test_files:
        print(f"❌ Unknown test: {test_name}")
        print(f"Available tests: {', '.join(test_files.keys())}")
        return 1
    
    print(f"🧪 Running {test_name} tests...")
    cmd = ["pytest", test_files[test_name], "-v", "--tb=short"]
    return subprocess.run(cmd).returncode


def main():
    """Main entry point"""
    if len(sys.argv) > 1:
        # Run specific test
        return run_specific_test(sys.argv[1])
    else:
        # Run all tests
        return run_tests()


if __name__ == "__main__":
    sys.exit(main())