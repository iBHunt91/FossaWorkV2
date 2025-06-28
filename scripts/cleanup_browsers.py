#!/usr/bin/env python3
"""
Browser Cleanup Script
Emergency cleanup for stuck Chromium processes
"""

import sys
import asyncio
import platform
import subprocess
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

async def cleanup_browsers():
    """Clean up stuck browser processes"""
    print("🧹 FossaWork Browser Cleanup Tool")
    print("=" * 50)
    
    # Try using the browser manager
    try:
        from app.services.browser_manager import browser_manager, kill_chromium_processes
        
        print("📊 Checking for stuck browser processes...")
        
        # Kill processes directly first
        kill_chromium_processes()
        
        # Then use manager for additional cleanup
        cleaned = await browser_manager.cleanup_stuck_browsers()
        
        if cleaned > 0:
            print(f"✅ Cleaned up {cleaned} stuck browser processes")
        else:
            print("✅ No stuck browser processes found")
            
    except ImportError:
        print("⚠️  Browser manager not available, using system commands...")
        
        # Fallback to direct system commands
        try:
            if platform.system() == "Windows":
                result = subprocess.run(["taskkill", "/F", "/IM", "chromium.exe"], capture_output=True, text=True)
                result2 = subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], capture_output=True, text=True)
                
                if "SUCCESS" in result.stdout or "SUCCESS" in result2.stdout:
                    print("✅ Killed Chromium processes on Windows")
                else:
                    print("ℹ️  No Chromium processes found")
                    
            else:
                # Unix-like systems
                result = subprocess.run(["pkill", "-f", "chromium"], capture_output=True, text=True)
                result2 = subprocess.run(["pkill", "-f", "chrome"], capture_output=True, text=True)
                
                # Check how many processes were killed
                ps_result = subprocess.run(["pgrep", "-f", "chromium"], capture_output=True, text=True)
                if ps_result.returncode != 0:
                    print("✅ Killed all Chromium processes")
                else:
                    remaining = len(ps_result.stdout.strip().split('\n'))
                    print(f"⚠️  {remaining} Chromium processes still running")
                    
        except Exception as e:
            print(f"❌ Error killing processes: {e}")
            return False
    
    # Additional cleanup checks
    print("\n📋 Additional Checks:")
    
    # Check for browser data directories
    browser_dirs = [
        Path.home() / ".cache" / "ms-playwright",
        Path.home() / ".local" / "share" / "ms-playwright",
        Path("/tmp") / "playwright*"
    ]
    
    for dir_path in browser_dirs:
        if dir_path.exists():
            print(f"  - Browser cache found at: {dir_path}")
    
    print("\n✨ Cleanup complete!")
    print("\nTips to prevent stuck browsers:")
    print("  1. Ensure proper error handling in scraping code")
    print("  2. Use context managers for browser lifecycle")
    print("  3. Set reasonable timeouts for operations")
    print("  4. Monitor browser process count regularly")
    
    return True

if __name__ == "__main__":
    success = asyncio.run(cleanup_browsers())
    sys.exit(0 if success else 1)