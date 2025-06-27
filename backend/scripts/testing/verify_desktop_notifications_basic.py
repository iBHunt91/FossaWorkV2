#!/usr/bin/env python3
"""
Basic Desktop Notification Verification

Simple verification script that tests desktop notification capabilities
without requiring the full FastAPI backend to be running.
"""

import asyncio
import platform
import sys
from pathlib import Path

def test_import_capabilities():
    """Test import capabilities for desktop notifications"""
    print("🔍 Testing Desktop Notification Import Capabilities")
    print("=" * 50)
    
    # Test plyer availability
    try:
        import plyer
        print("✅ plyer library available (cross-platform notifications)")
        plyer_available = True
    except ImportError:
        print("❌ plyer library NOT available")
        print("   Install with: pip install plyer")
        plyer_available = False
    
    # Test Windows-specific libraries
    if platform.system() == "Windows":
        try:
            import win10toast
            print("✅ win10toast library available (Windows 10 notifications)")
            win10toast_available = True
        except ImportError:
            print("❌ win10toast library NOT available")
            print("   Install with: pip install win10toast")
            win10toast_available = False
    else:
        win10toast_available = False
        print("ℹ️  win10toast not needed (non-Windows platform)")
    
    return {
        'plyer': plyer_available,
        'win10toast': win10toast_available,
        'platform': platform.system()
    }

def test_platform_capabilities():
    """Test platform-specific notification capabilities"""
    print(f"\n🖥️  Platform-Specific Capabilities")
    print("=" * 35)
    
    system = platform.system()
    print(f"Operating System: {system}")
    
    if system == "Windows":
        print("📋 Windows Notification Methods:")
        print("   • win10toast - Enhanced Windows 10 toast notifications")
        print("   • plyer - Cross-platform fallback")
        
    elif system == "Darwin":  # macOS
        print("📋 macOS Notification Methods:")
        print("   • osascript - Native macOS notifications (built-in)")
        print("   • plyer - Cross-platform fallback")
        
    elif system == "Linux":
        print("📋 Linux Notification Methods:")
        print("   • notify-send - Native Linux notifications")
        print("   • plyer - Cross-platform fallback")
        print("   • Requirements: libnotify-bin package")
        
        # Check if notify-send is available
        import subprocess
        try:
            subprocess.run(['which', 'notify-send'], 
                         capture_output=True, check=True)
            print("   ✅ notify-send command available")
        except subprocess.CalledProcessError:
            print("   ❌ notify-send command NOT available")
            print("   Install with: sudo apt-get install libnotify-bin")
    
    else:
        print(f"❓ Unknown platform: {system}")

async def test_simple_notification():
    """Test simple notification without full backend dependencies"""
    print(f"\n🧪 Simple Notification Test")
    print("=" * 30)
    
    try:
        import plyer
        
        print("Testing plyer notification...")
        
        def send_test():
            plyer.notification.notify(
                title='Fossa Monitor Test',
                message='Desktop notifications are working!',
                timeout=5,
                app_name='Fossa Monitor'
            )
        
        # Run in executor to avoid blocking
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, send_test)
        
        print("✅ Test notification sent via plyer")
        print("   Check your desktop for the notification!")
        
        return True
        
    except ImportError:
        print("❌ Cannot test - plyer not available")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

def test_macos_osascript():
    """Test macOS osascript notifications"""
    if platform.system() != "Darwin":
        return False
    
    print(f"\n🍎 macOS osascript Test")
    print("=" * 25)
    
    try:
        import subprocess
        
        script = '''
        display notification "Desktop notifications via osascript are working!" with title "Fossa Monitor macOS Test"
        '''
        
        result = subprocess.run(
            ['osascript', '-e', script],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print("✅ macOS osascript notification sent")
            print("   Check your desktop for the notification!")
            return True
        else:
            print(f"❌ osascript failed: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ macOS test failed: {e}")
        return False

def test_linux_notify_send():
    """Test Linux notify-send notifications"""
    if platform.system() != "Linux":
        return False
    
    print(f"\n🐧 Linux notify-send Test")
    print("=" * 28)
    
    try:
        import subprocess
        
        result = subprocess.run([
            'notify-send',
            'Fossa Monitor Linux Test',
            'Desktop notifications via notify-send are working!',
            '--expire-time=5000'
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Linux notify-send notification sent")
            print("   Check your desktop for the notification!")
            return True
        else:
            print(f"❌ notify-send failed: {result.stderr}")
            return False
            
    except FileNotFoundError:
        print("❌ notify-send command not found")
        print("   Install with: sudo apt-get install libnotify-bin")
        return False
    except Exception as e:
        print(f"❌ Linux test failed: {e}")
        return False

def print_installation_guide():
    """Print installation guide"""
    print(f"\n📦 Installation Guide")
    print("=" * 20)
    
    print("For full desktop notification support:")
    print()
    print("🐍 Python packages:")
    print("   pip install plyer           # Cross-platform (recommended)")
    
    if platform.system() == "Windows":
        print("   pip install win10toast     # Windows enhanced notifications")
    
    print()
    print("🖥️  System requirements:")
    
    if platform.system() == "Linux":
        print("   sudo apt-get install libnotify-bin  # Ubuntu/Debian")
        print("   sudo yum install libnotify           # CentOS/RHEL")
    elif platform.system() == "Darwin":
        print("   No additional requirements (osascript built-in)")
    elif platform.system() == "Windows":  
        print("   No additional requirements (Windows 10+)")

async def main():
    """Main verification"""
    print("🔔 Desktop Notification Basic Verification")
    print("==========================================")
    
    # Test import capabilities
    capabilities = test_import_capabilities()
    
    # Test platform capabilities
    test_platform_capabilities()
    
    # Test simple notification
    if capabilities['plyer']:
        await test_simple_notification()
        await asyncio.sleep(2)  # Wait a bit between tests
    
    # Test platform-specific methods
    if platform.system() == "Darwin":
        test_macos_osascript()
    elif platform.system() == "Linux":
        test_linux_notify_send()
    
    # Print installation guide
    print_installation_guide()
    
    print(f"\n🎉 Basic verification complete!")
    print(f"Platform: {platform.system()}")
    print(f"Plyer available: {capabilities['plyer']}")
    print(f"Ready for enhanced desktop notifications: {capabilities['plyer'] or platform.system() in ['Darwin', 'Linux']}")

if __name__ == "__main__":
    asyncio.run(main())