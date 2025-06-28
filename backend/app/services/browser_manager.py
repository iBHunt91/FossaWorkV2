#!/usr/bin/env python3
"""
Browser Process Manager
Manages browser lifecycle and prevents zombie processes
"""

import asyncio
import logging
import os
import platform
import signal
import subprocess
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Set
import psutil

try:
    from playwright.async_api import async_playwright, Browser, BrowserContext, Page
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    Browser = BrowserContext = Page = None

logger = logging.getLogger(__name__)

class BrowserProcessManager:
    """Manages browser processes to prevent zombie/stuck processes"""
    
    def __init__(self):
        self.active_browsers: Dict[str, Browser] = {}
        self.browser_pids: Dict[str, int] = {}
        self.process_start_times: Dict[int, datetime] = {}
        self.max_browser_lifetime = timedelta(minutes=30)  # Max lifetime before force cleanup
        self.check_interval = 60  # Check every minute
        self.cleanup_task: Optional[asyncio.Task] = None
        
    def _get_chromium_processes(self) -> List[psutil.Process]:
        """Find all Chromium processes"""
        chromium_processes = []
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'create_time']):
                try:
                    name = proc.info['name'].lower()
                    cmdline = ' '.join(proc.info.get('cmdline', [])).lower()
                    
                    # Check for various Chromium process names
                    if any(browser in name for browser in ['chromium', 'chrome', 'chromium-browse']):
                        chromium_processes.append(proc)
                    elif any(browser in cmdline for browser in ['chromium', 'chrome']):
                        chromium_processes.append(proc)
                        
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
                    
        except Exception as e:
            logger.error(f"Error getting Chromium processes: {e}")
            
        return chromium_processes
    
    def _is_playwright_process(self, proc: psutil.Process) -> bool:
        """Check if process was launched by Playwright"""
        try:
            cmdline = ' '.join(proc.cmdline())
            # Playwright adds specific flags
            return any(flag in cmdline for flag in [
                '--remote-debugging-pipe',
                '--no-startup-window',
                'playwright'
            ])
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return False
    
    async def cleanup_stuck_browsers(self) -> int:
        """Clean up stuck browser processes"""
        cleaned_count = 0
        current_time = datetime.now()
        
        try:
            # Get all Chromium processes
            chromium_procs = self._get_chromium_processes()
            logger.info(f"Found {len(chromium_procs)} Chromium processes")
            
            for proc in chromium_procs:
                try:
                    pid = proc.pid
                    create_time = datetime.fromtimestamp(proc.create_time())
                    age = current_time - create_time
                    
                    # Skip if process is managed and still young
                    if pid in self.browser_pids.values() and age < self.max_browser_lifetime:
                        continue
                    
                    # Check if it's a Playwright process
                    if not self._is_playwright_process(proc):
                        logger.debug(f"Skipping non-Playwright Chromium process {pid}")
                        continue
                    
                    # Kill if:
                    # 1. Process is older than max lifetime
                    # 2. Process is not in our managed list (orphaned)
                    if age > self.max_browser_lifetime or pid not in self.browser_pids.values():
                        logger.warning(f"Killing stuck Chromium process {pid} (age: {age})")
                        proc.kill()
                        cleaned_count += 1
                        
                except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                    logger.debug(f"Process already gone or access denied: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error during browser cleanup: {e}")
            
        if cleaned_count > 0:
            logger.info(f"Cleaned up {cleaned_count} stuck browser processes")
            
        return cleaned_count
    
    async def periodic_cleanup(self):
        """Periodically clean up stuck browsers"""
        while True:
            try:
                await asyncio.sleep(self.check_interval)
                await self.cleanup_stuck_browsers()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic cleanup: {e}")
    
    def start_monitoring(self):
        """Start background monitoring task"""
        if not self.cleanup_task or self.cleanup_task.done():
            self.cleanup_task = asyncio.create_task(self.periodic_cleanup())
            logger.info("Started browser process monitoring")
    
    def stop_monitoring(self):
        """Stop background monitoring task"""
        if self.cleanup_task and not self.cleanup_task.done():
            self.cleanup_task.cancel()
            logger.info("Stopped browser process monitoring")
    
    def register_browser(self, session_id: str, browser: Browser):
        """Register a browser instance"""
        self.active_browsers[session_id] = browser
        # Try to get browser process PID
        try:
            # This is a bit hacky but works for getting the PID
            if hasattr(browser, '_impl_obj') and hasattr(browser._impl_obj, '_browser_process'):
                pid = browser._impl_obj._browser_process.pid
                self.browser_pids[session_id] = pid
                self.process_start_times[pid] = datetime.now()
                logger.info(f"Registered browser for session {session_id} with PID {pid}")
        except Exception as e:
            logger.warning(f"Could not get browser PID: {e}")
    
    def unregister_browser(self, session_id: str):
        """Unregister a browser instance"""
        if session_id in self.active_browsers:
            del self.active_browsers[session_id]
        if session_id in self.browser_pids:
            pid = self.browser_pids[session_id]
            del self.browser_pids[session_id]
            if pid in self.process_start_times:
                del self.process_start_times[pid]
            logger.info(f"Unregistered browser for session {session_id}")
    
    async def force_cleanup_all(self):
        """Force cleanup all browser processes"""
        logger.warning("Force cleaning up all browser processes")
        
        # Close all managed browsers
        for session_id, browser in list(self.active_browsers.items()):
            try:
                await browser.close()
            except Exception as e:
                logger.error(f"Error closing browser {session_id}: {e}")
            self.unregister_browser(session_id)
        
        # Kill any remaining processes
        await self.cleanup_stuck_browsers()

# Global instance
browser_manager = BrowserProcessManager()


class ManagedBrowser:
    """Context manager for browser with automatic cleanup"""
    
    def __init__(self, session_id: str, headless: bool = True, timeout: int = 30000):
        self.session_id = session_id
        self.headless = headless
        self.timeout = timeout
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        
    async def __aenter__(self):
        """Initialize browser with proper cleanup tracking"""
        try:
            self.playwright = await async_playwright().start()
            
            # Launch browser with optimized settings
            launch_args = [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-images',
                '--disable-javascript-harmony-shipping',
                '--memory-pressure-off',
                '--max_old_space_size=4096',
                '--single-process',  # Reduces subprocess count
                '--no-zygote',  # Prevents zombie processes on Linux
            ]
            
            # Platform-specific args
            if platform.system() == 'Linux':
                launch_args.extend(['--disable-setuid-sandbox'])
            
            self.browser = await self.playwright.chromium.launch(
                headless=self.headless,
                args=launch_args
            )
            
            # Register with manager
            browser_manager.register_browser(self.session_id, self.browser)
            
            # Create context
            self.context = await self.browser.new_context(
                viewport={"width": 1366, "height": 768},
                ignore_https_errors=True
            )
            
            # Create page
            self.page = await self.context.new_page()
            self.page.set_default_timeout(self.timeout)
            
            logger.info(f"Created managed browser for session {self.session_id}")
            return self
            
        except Exception as e:
            # Cleanup on error
            await self._cleanup()
            raise
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Ensure proper cleanup"""
        await self._cleanup()
        
    async def _cleanup(self):
        """Clean up browser resources"""
        try:
            if self.page:
                await self.page.close()
        except Exception as e:
            logger.error(f"Error closing page: {e}")
            
        try:
            if self.context:
                await self.context.close()
        except Exception as e:
            logger.error(f"Error closing context: {e}")
            
        try:
            if self.browser:
                await self.browser.close()
                browser_manager.unregister_browser(self.session_id)
        except Exception as e:
            logger.error(f"Error closing browser: {e}")
            
        try:
            if self.playwright:
                await self.playwright.stop()
        except Exception as e:
            logger.error(f"Error stopping playwright: {e}")


# Utility functions
async def cleanup_all_browsers():
    """Force cleanup all browser processes"""
    await browser_manager.force_cleanup_all()


def kill_chromium_processes():
    """Kill all Chromium processes (emergency cleanup)"""
    try:
        if platform.system() == "Windows":
            subprocess.run(["taskkill", "/F", "/IM", "chromium.exe"], capture_output=True)
            subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], capture_output=True)
        else:
            subprocess.run(["pkill", "-f", "chromium"], capture_output=True)
            subprocess.run(["pkill", "-f", "chrome"], capture_output=True)
        logger.info("Killed all Chromium processes")
    except Exception as e:
        logger.error(f"Error killing Chromium processes: {e}")


# Test the browser manager
if __name__ == "__main__":
    async def test_browser_manager():
        """Test browser management functionality"""
        print("🔄 Testing Browser Manager...")
        
        # Start monitoring
        browser_manager.start_monitoring()
        
        try:
            # Test managed browser
            async with ManagedBrowser("test_session") as browser:
                await browser.page.goto("https://example.com")
                title = await browser.page.title()
                print(f"✅ Page loaded: {title}")
            
            print("✅ Browser cleaned up properly")
            
            # Test cleanup
            cleaned = await browser_manager.cleanup_stuck_browsers()
            print(f"✅ Cleaned up {cleaned} stuck processes")
            
        finally:
            browser_manager.stop_monitoring()
            
        print("🎉 Browser manager test completed!")
    
    asyncio.run(test_browser_manager())