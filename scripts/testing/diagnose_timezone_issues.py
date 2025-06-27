#!/usr/bin/env python3
"""
Timezone Issues Diagnostic Script
=================================

This script helps diagnose timezone-related issues in the FossaWork V2 application.
It checks system configuration, dependencies, and provides detailed debugging info.
"""

import sys
import os
import platform
import subprocess
from datetime import datetime, timedelta
import json

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../backend')))

def print_section(title):
    """Print a section header"""
    print(f"\n{'='*60}")
    print(f" {title}")
    print('='*60)

def check_system_info():
    """Check basic system information"""
    print_section("SYSTEM INFORMATION")
    
    try:
        print(f"Platform: {platform.platform()}")
        print(f"Python Version: {sys.version}")
        print(f"Architecture: {platform.architecture()}")
        print(f"Machine: {platform.machine()}")
        print(f"Processor: {platform.processor()}")
        
        # Check timezone setting
        if hasattr(os, 'environ'):
            tz = os.environ.get('TZ', 'Not set')
            print(f"TZ Environment Variable: {tz}")
        
        # Get current time in various formats
        now = datetime.now()
        print(f"System Local Time: {now}")
        print(f"System UTC Time: {datetime.utcnow()}")
        
        return True
    except Exception as e:
        print(f"❌ Error checking system info: {e}")
        return False

def check_python_dependencies():
    """Check if required Python packages are installed"""
    print_section("PYTHON DEPENDENCIES")
    
    required_packages = [
        'pytz',
        'fastapi',
        'uvicorn',
        'sqlalchemy',
        'colorama',
        'humanize'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package}: Installed")
        except ImportError:
            print(f"❌ {package}: Missing")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\n⚠️  Missing packages: {', '.join(missing_packages)}")
        print("Install with: pip install " + " ".join(missing_packages))
        return False
    
    return True

def check_timezone_functionality():
    """Test timezone functionality"""
    print_section("TIMEZONE FUNCTIONALITY")
    
    try:
        import pytz
        
        # Test basic timezone creation
        timezones_to_test = [
            'America/New_York',
            'America/Los_Angeles',
            'UTC',
            'Europe/London'
        ]
        
        for tz_name in timezones_to_test:
            try:
                tz = pytz.timezone(tz_name)
                now = datetime.now(tz)
                print(f"✅ {tz_name}: {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            except Exception as e:
                print(f"❌ {tz_name}: Error - {e}")
                return False
        
        return True
    except Exception as e:
        print(f"❌ Timezone functionality error: {e}")
        return False

def check_backend_modules():
    """Check if backend modules can be imported"""
    print_section("BACKEND MODULE IMPORTS")
    
    modules_to_test = [
        ('app.services.schedule_manager', 'get_relative_time_display'),
        ('app.utils.timezone_utils', 'get_user_timezone'),
        ('app.utils.timezone_utils', 'convert_to_user_timezone'),
        ('app.utils.timezone_utils', 'format_user_time')
    ]
    
    all_ok = True
    
    for module_name, function_name in modules_to_test:
        try:
            module = __import__(module_name, fromlist=[function_name])
            func = getattr(module, function_name)
            print(f"✅ {module_name}.{function_name}: Available")
        except ImportError as e:
            print(f"❌ {module_name}.{function_name}: Import Error - {e}")
            all_ok = False
        except AttributeError as e:
            print(f"❌ {module_name}.{function_name}: Function not found - {e}")
            all_ok = False
        except Exception as e:
            print(f"❌ {module_name}.{function_name}: Unexpected error - {e}")
            all_ok = False
    
    return all_ok

def test_critical_function():
    """Test the critical 1-hour display function"""
    print_section("CRITICAL FUNCTION TEST")
    
    try:
        from app.services.schedule_manager import get_relative_time_display
        import pytz
        
        # Test the critical 1-hour case
        tz = pytz.timezone('America/New_York')
        now = datetime.now(tz)
        one_hour_future = now + timedelta(hours=1)
        
        result = get_relative_time_display(one_hour_future, 'America/New_York')
        
        print(f"Input: 1 hour from now")
        print(f"Output: '{result}'")
        print(f"Expected: 'in about 1 hour'")
        
        if result == 'in about 1 hour':
            print("✅ CRITICAL TEST PASSED!")
            return True
        else:
            print("❌ CRITICAL TEST FAILED!")
            print(f"   Got '{result}' instead of 'in about 1 hour'")
            return False
            
    except Exception as e:
        print(f"❌ Critical function test error: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_file_permissions():
    """Check file permissions for critical files"""
    print_section("FILE PERMISSIONS")
    
    critical_files = [
        'backend/app/services/schedule_manager.py',
        'backend/app/utils/timezone_utils.py',
        'scripts/testing/verify_timezone_fix.py'
    ]
    
    all_ok = True
    
    for file_path in critical_files:
        full_path = os.path.join(os.path.dirname(__file__), '../../', file_path)
        try:
            if os.path.exists(full_path):
                # Check if file is readable
                with open(full_path, 'r') as f:
                    f.read(1)  # Try to read one character
                print(f"✅ {file_path}: Readable")
            else:
                print(f"❌ {file_path}: File not found")
                all_ok = False
        except PermissionError:
            print(f"❌ {file_path}: Permission denied")
            all_ok = False
        except Exception as e:
            print(f"❌ {file_path}: Error - {e}")
            all_ok = False
    
    return all_ok

def check_database_connectivity():
    """Check if database is accessible"""
    print_section("DATABASE CONNECTIVITY")
    
    try:
        from app.core.database import get_db
        from sqlalchemy import text
        
        # Try to get a database session
        db = next(get_db())
        
        # Try a simple query
        result = db.execute(text("SELECT 1"))
        row = result.fetchone()
        
        if row and row[0] == 1:
            print("✅ Database connection successful")
            return True
        else:
            print("❌ Database query failed")
            return False
            
    except Exception as e:
        print(f"❌ Database connectivity error: {e}")
        return False

def generate_diagnostic_report():
    """Generate a comprehensive diagnostic report"""
    print_section("GENERATING DIAGNOSTIC REPORT")
    
    # Run all checks
    checks = [
        ("System Information", check_system_info),
        ("Python Dependencies", check_python_dependencies),
        ("Timezone Functionality", check_timezone_functionality),
        ("Backend Modules", check_backend_modules),
        ("Critical Function", test_critical_function),
        ("File Permissions", check_file_permissions),
        ("Database Connectivity", check_database_connectivity)
    ]
    
    results = {}
    
    for check_name, check_func in checks:
        print(f"\nRunning: {check_name}")
        try:
            results[check_name] = check_func()
        except Exception as e:
            print(f"❌ {check_name} failed with exception: {e}")
            results[check_name] = False
    
    # Generate summary
    print_section("DIAGNOSTIC SUMMARY")
    
    passed = sum(1 for result in results.values() if result)
    total = len(results)
    
    print(f"Checks Passed: {passed}/{total}")
    
    if passed == total:
        print("🎉 All diagnostic checks passed!")
        print("The timezone fix should be working correctly.")
    else:
        print("⚠️  Some diagnostic checks failed.")
        print("\nFailed checks:")
        for check_name, result in results.items():
            if not result:
                print(f"  ❌ {check_name}")
    
    # Save detailed report
    report_file = "timezone_diagnostic_report.json"
    try:
        report_data = {
            "timestamp": datetime.now().isoformat(),
            "platform": platform.platform(),
            "python_version": sys.version,
            "checks": results,
            "summary": {
                "passed": passed,
                "total": total,
                "success_rate": passed / total * 100
            }
        }
        
        with open(report_file, 'w') as f:
            json.dump(report_data, f, indent=2)
        
        print(f"\n📋 Detailed report saved to: {report_file}")
    except Exception as e:
        print(f"⚠️  Could not save report: {e}")
    
    return passed == total

def main():
    """Main diagnostic routine"""
    print("🔍 Starting timezone diagnostic...")
    
    try:
        success = generate_diagnostic_report()
        
        if success:
            print("\n✅ Diagnosis complete - no issues found!")
            print("You can now run the verification script:")
            print("python scripts/testing/verify_timezone_fix.py")
        else:
            print("\n❌ Diagnosis found issues that need attention.")
            print("Please review the failed checks above and fix them before proceeding.")
            print("\nCommon fixes:")
            print("- Install missing packages: pip install -r backend/requirements.txt")
            print("- Check file permissions: chmod +r <filename>")
            print("- Restart backend server: uvicorn app.main:app --reload")
        
    except KeyboardInterrupt:
        print("\n⏹️  Diagnostic interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error during diagnosis: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()