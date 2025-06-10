#!/usr/bin/env python3
"""
Test integration structure without requiring dependencies
Verifies that the critical integrations are properly connected in code
"""

import ast
import os
import sys

def find_in_ast(node, target_import):
    """Find if a specific import exists in the AST"""
    for item in ast.walk(node):
        if isinstance(item, ast.ImportFrom):
            if target_import in [alias.name for alias in item.names] or item.module and target_import in item.module:
                return True
        elif isinstance(item, ast.Import):
            for alias in item.names:
                if target_import in alias.name:
                    return True
    return False

def find_method_calls(node, method_name):
    """Find if a specific method is called in the AST"""
    calls = []
    for item in ast.walk(node):
        if isinstance(item, ast.Call):
            if isinstance(item.func, ast.Attribute):
                if item.func.attr == method_name:
                    calls.append(item)
            elif isinstance(item.func, ast.Name):
                if item.func.id == method_name:
                    calls.append(item)
    return calls

def test_schedule_notification_integration():
    """Test that schedule_detection.py properly integrates with notifications"""
    print("\n🔄 Testing Schedule → Notification Integration in Code...")
    
    schedule_detection_path = os.path.join(os.path.dirname(__file__), '..', 'app', 'services', 'schedule_detection.py')
    
    with open(schedule_detection_path, 'r') as f:
        content = f.read()
        tree = ast.parse(content)
    
    # Check 1: NotificationManager is imported
    has_notification_import = find_in_ast(tree, 'NotificationManager')
    print(f"  {'✅' if has_notification_import else '❌'} NotificationManager imported: {has_notification_import}")
    
    # Check 2: notification_manager is initialized in __init__
    has_notification_init = 'self.notification_manager = NotificationManager' in content
    print(f"  {'✅' if has_notification_init else '❌'} NotificationManager initialized: {has_notification_init}")
    
    # Check 3: _notify_users_of_changes method exists
    has_notify_method = '_notify_users_of_changes' in content and 'async def _notify_users_of_changes' in content
    print(f"  {'✅' if has_notify_method else '❌'} _notify_users_of_changes method exists: {has_notify_method}")
    
    # Check 4: send_notification is called
    has_send_notification = 'send_notification' in content and 'await self.notification_manager.send_notification' in content
    print(f"  {'✅' if has_send_notification else '❌'} send_notification called: {has_send_notification}")
    
    # Check 5: Integration point in _compare_schedules
    has_integration_point = '_has_significant_changes(changes)' in content and 'await self._notify_users_of_changes' in content
    print(f"  {'✅' if has_integration_point else '❌'} Integration point in _compare_schedules: {has_integration_point}")
    
    all_checks_passed = all([
        has_notification_import,
        has_notification_init,
        has_notify_method,
        has_send_notification,
        has_integration_point
    ])
    
    return all_checks_passed

def test_circular_import_fix():
    """Test that circular import between browser_automation and error_recovery is fixed"""
    print("\n🔄 Testing Circular Import Fix...")
    
    browser_automation_path = os.path.join(os.path.dirname(__file__), '..', 'app', 'services', 'browser_automation.py')
    error_recovery_path = os.path.join(os.path.dirname(__file__), '..', 'app', 'services', 'error_recovery.py')
    
    # Check browser_automation.py
    with open(browser_automation_path, 'r') as f:
        browser_content = f.read()
    
    # Should not have direct import at top level
    has_top_level_import = 'from .error_recovery import' in browser_content.split('class')[0]
    print(f"  {'❌' if has_top_level_import else '✅'} No top-level circular import in browser_automation: {not has_top_level_import}")
    
    # Should have dependency injection setup
    has_di_setup = '_setup_error_recovery' in browser_content
    print(f"  {'✅' if has_di_setup else '❌'} Dependency injection setup exists: {has_di_setup}")
    
    # Check error_recovery.py
    with open(error_recovery_path, 'r') as f:
        error_content = f.read()
    
    # Should have setter methods for dependency injection
    has_setters = all([
        'def set_browser_automation' in error_content,
        'def set_form_automation' in error_content,
        'def set_scraper' in error_content
    ])
    print(f"  {'✅' if has_setters else '❌'} Dependency injection setters exist: {has_setters}")
    
    return not has_top_level_import and has_di_setup and has_setters

def test_requirements_fix():
    """Test that aiohttp is in requirements.txt"""
    print("\n🔄 Testing Requirements Fix...")
    
    requirements_path = os.path.join(os.path.dirname(__file__), '..', 'requirements.txt')
    
    with open(requirements_path, 'r') as f:
        requirements = f.read()
    
    has_aiohttp = 'aiohttp' in requirements
    print(f"  {'✅' if has_aiohttp else '❌'} aiohttp in requirements.txt: {has_aiohttp}")
    
    return has_aiohttp

def test_env_example_exists():
    """Test that .env.example file exists"""
    print("\n🔄 Testing .env.example Creation...")
    
    env_example_path = os.path.join(os.path.dirname(__file__), '..', '.env.example')
    
    exists = os.path.exists(env_example_path)
    print(f"  {'✅' if exists else '❌'} .env.example exists: {exists}")
    
    if exists:
        with open(env_example_path, 'r') as f:
            content = f.read()
        
        # Check for key configurations
        has_database = 'DATABASE_URL' in content
        has_secret = 'SECRET_KEY' in content
        has_smtp = 'SMTP_HOST' in content
        has_pushover = 'PUSHOVER_APP_TOKEN' in content
        
        print(f"  {'✅' if has_database else '❌'} DATABASE_URL configured: {has_database}")
        print(f"  {'✅' if has_secret else '❌'} SECRET_KEY configured: {has_secret}")
        print(f"  {'✅' if has_smtp else '❌'} SMTP settings configured: {has_smtp}")
        print(f"  {'✅' if has_pushover else '❌'} Pushover settings configured: {has_pushover}")
        
        return all([has_database, has_secret, has_smtp, has_pushover])
    
    return False

def main():
    """Run all structure tests"""
    print("🎯 FossaWork V2 - Code Structure Integration Tests")
    print("=" * 60)
    print("Testing critical fixes without requiring dependencies...")
    
    tests = [
        ("Schedule → Notification Integration", test_schedule_notification_integration),
        ("Circular Import Fix", test_circular_import_fix),
        ("Requirements Fix (aiohttp)", test_requirements_fix),
        ("Environment Example File", test_env_example_exists)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n❌ {test_name} - FAILED with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 60)
    print("🎯 TEST SUMMARY:")
    print("=" * 60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL CRITICAL FIXES VERIFIED!")
        print("\n✅ Schedule → Notification integration is properly connected")
        print("✅ Circular import issue has been resolved")
        print("✅ Missing dependency (aiohttp) has been added")
        print("✅ Environment example file has been created")
        print("\nThe system is now ready for deployment after testing in a proper environment.")
    else:
        print("\n⚠️  Some fixes failed verification. Please review.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)