#!/usr/bin/env python3
"""
Quick Timezone Fixes Test Runner

Convenience script to run the comprehensive timezone test suite from the project root.
This script provides a simple interface to verify that all timezone fixes are working correctly.
"""

import sys
import subprocess
from pathlib import Path


def main():
    """Run the timezone test suite"""
    project_root = Path(__file__).parent
    test_script = project_root / "scripts" / "testing" / "timezone_test_suite.py"
    
    print("🧪 Running Comprehensive Timezone Test Suite...")
    print("=" * 60)
    print("This will test:")
    print("✓ Backend API timestamp formatting (UTC with 'Z' suffix)")
    print("✓ Frontend date utilities and relative time calculations") 
    print("✓ End-to-end integration from schedule updates to display")
    print("✓ Edge cases including DST boundaries and malformed data")
    print("=" * 60)
    print()
    
    try:
        # Run the comprehensive test suite
        result = subprocess.run([sys.executable, str(test_script)], cwd=project_root)
        return result.returncode
        
    except KeyboardInterrupt:
        print("\n⚠️  Test run interrupted by user")
        return 1
        
    except Exception as e:
        print(f"\n❌ Failed to run test suite: {e}")
        return 1


if __name__ == "__main__":
    exit_code = main()
    exit(exit_code)