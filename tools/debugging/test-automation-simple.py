#!/usr/bin/env python3
"""
Simple test for WorkFossa automation - Windows compatible
Run this from Windows to verify the automation system works
"""

import asyncio
import json
import sys
from pathlib import Path

def test_import():
    """Test if we can import the automation service"""
    print("🔄 Testing automation service import...")
    try:
        # Add backend to Python path
        backend_path = Path(__file__).parent.parent / "backend"
        sys.path.insert(0, str(backend_path))
        
        from app.services.workfossa_automation import workfossa_automation, WorkFossaCredentials
        print("✅ Import successful!")
        return True, workfossa_automation, WorkFossaCredentials
    except Exception as e:
        print(f"❌ Import failed: {e}")
        return False, None, None

async def test_mock_automation(automation_service, credentials_class):
    """Test automation service with mock data"""
    print("\n🧪 Testing automation service (mock mode)...")
    
    try:
        # Test credentials creation
        test_creds = credentials_class(
            email="test@example.com",
            password="testpass123",
            user_id="test_user"
        )
        print(f"✅ Credentials created: {test_creds.email}")
        
        # Test service initialization
        result = await automation_service.initialize_browser()
        mode = "Real browser" if result else "Mock mode"
        print(f"✅ Service initialized: {mode}")
        
        # Test session creation
        session_id = await automation_service.create_automation_session("test_user", test_creds)
        print(f"✅ Session created: {session_id[:8]}...")
        
        # Test login (will use mock data)
        login_success = await automation_service.login_to_workfossa(session_id)
        print(f"✅ Login test: {'Success' if login_success else 'Expected mock failure'}")
        
        # Test work order scraping
        work_orders = await automation_service.scrape_work_orders(session_id)
        print(f"✅ Work order scraping: {len(work_orders)} orders found")
        
        if work_orders:
            print("\n📋 Sample work order:")
            sample = work_orders[0]
            for key, value in sample.items():
                if isinstance(value, str) and len(value) > 50:
                    value = value[:50] + "..."
                print(f"   {key}: {value}")
        
        # Test session cleanup
        await automation_service.close_session(session_id)
        print("✅ Session cleanup successful")
        
        return True
        
    except Exception as e:
        print(f"❌ Automation test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        try:
            await automation_service.cleanup()
        except:
            pass

def test_requirements():
    """Test if all required packages are available"""
    print("\n📦 Testing package requirements...")
    
    required_packages = [
        "fastapi", "sqlalchemy", "pydantic", "uvicorn"
    ]
    
    optional_packages = [
        "playwright", "websockets", "aiofiles"
    ]
    
    results = {}
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package}: Available")
            results[package] = True
        except ImportError:
            print(f"❌ {package}: Missing (required)")
            results[package] = False
    
    for package in optional_packages:
        try:
            __import__(package)
            print(f"✅ {package}: Available")
            results[package] = True
        except ImportError:
            print(f"⚠️ {package}: Missing (optional)")
            results[package] = False
    
    return results

def generate_install_script(missing_packages):
    """Generate installation script for missing packages"""
    if not missing_packages:
        return
    
    print(f"\n📝 Installation script for missing packages:")
    print("=" * 50)
    print("REM Run this in Windows Command Prompt:")
    print("cd backend")
    
    for package in missing_packages:
        if package == "playwright":
            print(f"python -m pip install {package}")
            print("python -m playwright install")
        else:
            print(f"python -m pip install {package}")
    
    print("\nREM Alternative using requirements.txt:")
    print("python -m pip install -r requirements.txt")
    print("python -m playwright install")

async def main():
    """Main test function"""
    print("🎯 FossaWork V2 - Automation System Test")
    print("=" * 50)
    
    # Test 1: Package requirements
    package_results = test_requirements()
    missing_required = [pkg for pkg, available in package_results.items() 
                       if not available and pkg in ["fastapi", "sqlalchemy", "pydantic", "uvicorn"]]
    missing_optional = [pkg for pkg, available in package_results.items() 
                       if not available and pkg in ["playwright", "websockets", "aiofiles"]]
    
    if missing_required:
        print(f"\n❌ Missing required packages: {', '.join(missing_required)}")
        generate_install_script(missing_required + missing_optional)
        return False
    
    # Test 2: Service import
    import_success, automation_service, credentials_class = test_import()
    if not import_success:
        return False
    
    # Test 3: Mock automation
    automation_success = await test_mock_automation(automation_service, credentials_class)
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary:")
    print(f"   Package Requirements: {'✅ PASS' if not missing_required else '❌ FAIL'}")
    print(f"   Service Import: {'✅ PASS' if import_success else '❌ FAIL'}")
    print(f"   Automation Test: {'✅ PASS' if automation_success else '❌ FAIL'}")
    
    if missing_optional:
        print(f"\n⚠️ Optional packages missing: {', '.join(missing_optional)}")
        print("   Install these for full browser automation:")
        generate_install_script(missing_optional)
    
    if import_success and automation_success:
        print("\n🎉 Automation system is working!")
        print("\n📚 Next steps:")
        if missing_optional:
            print("   1. Install missing packages (see above)")
            print("   2. Run: tools\\start-backend.bat")
            print("   3. Test with real WorkFossa credentials")
        else:
            print("   1. Run: tools\\start-backend.bat")
            print("   2. Open: http://localhost:8000/docs")
            print("   3. Test automation endpoints")
        return True
    else:
        print("\n❌ Some tests failed. Fix the issues above and try again.")
        return False

if __name__ == "__main__":
    try:
        success = asyncio.run(main())
        print(f"\n{'🎉 SUCCESS' if success else '❌ FAILED'}: Automation system test completed")
    except KeyboardInterrupt:
        print("\n⏹️ Test interrupted by user")
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        import traceback
        traceback.print_exc()
    
    input("\nPress Enter to exit...")