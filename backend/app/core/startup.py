#!/usr/bin/env python3
"""
Application Startup and Cleanup Handlers
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

logger = logging.getLogger(__name__)

async def cleanup_stuck_browsers():
    """Clean up any stuck browser processes on startup"""
    try:
        from ..services.browser_manager import browser_manager, kill_chromium_processes
        
        # Kill any leftover Chromium processes
        logger.info("Cleaning up stuck browser processes...")
        kill_chromium_processes()
        
        # Additional cleanup
        cleaned = await browser_manager.cleanup_stuck_browsers()
        if cleaned > 0:
            logger.info(f"Cleaned up {cleaned} stuck browser processes")
        
    except ImportError:
        logger.warning("Browser manager not available")
    except Exception as e:
        logger.error(f"Error cleaning up browsers: {e}")

async def start_browser_monitoring():
    """Start browser process monitoring"""
    try:
        from ..services.browser_manager import browser_manager
        browser_manager.start_monitoring()
        logger.info("Started browser process monitoring")
    except ImportError:
        logger.warning("Browser manager not available")
    except Exception as e:
        logger.error(f"Error starting browser monitoring: {e}")

async def stop_browser_monitoring():
    """Stop browser process monitoring"""
    try:
        from ..services.browser_manager import browser_manager
        browser_manager.stop_monitoring()
        await browser_manager.force_cleanup_all()
        logger.info("Stopped browser process monitoring")
    except ImportError:
        pass
    except Exception as e:
        logger.error(f"Error stopping browser monitoring: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting FossaWork V2 application...")
    
    # Clean up any stuck browsers
    await cleanup_stuck_browsers()
    
    # Start browser monitoring
    await start_browser_monitoring()
    
    # Start scheduler if enabled
    try:
        from ..services.scheduler_service import scheduler_service
        if os.getenv("DISABLE_SCHEDULER", "false").lower() != "true":
            await scheduler_service.start()
            logger.info("Scheduler service started")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down FossaWork V2 application...")
    
    # Stop scheduler
    try:
        from ..services.scheduler_service import scheduler_service
        await scheduler_service.stop()
        logger.info("Scheduler service stopped")
    except Exception as e:
        logger.error(f"Error stopping scheduler: {e}")
    
    # Stop browser monitoring and cleanup
    await stop_browser_monitoring()
    
    logger.info("Application shutdown complete")