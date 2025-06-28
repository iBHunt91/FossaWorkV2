#!/usr/bin/env python3
"""
Browser Management API Routes
Endpoints for monitoring and managing browser processes
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, List, Any
import psutil
from datetime import datetime

from ..auth.dependencies import get_current_user
from ..models.user_models import User
from ..services.browser_manager import browser_manager, kill_chromium_processes
from ..services.logging_service import get_logger

logger = get_logger("browser_management")

router = APIRouter(prefix="/api/browser", tags=["browser"])

@router.get("/status")
async def get_browser_status(current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Get current browser status and process information"""
    try:
        # Get active browsers from manager
        active_sessions = list(browser_manager.active_browsers.keys())
        browser_pids = dict(browser_manager.browser_pids)
        
        # Get all Chromium processes
        chromium_processes = []
        try:
            for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'create_time', 'memory_info']):
                try:
                    name = proc.info['name'].lower()
                    cmdline = ' '.join(proc.info.get('cmdline', [])).lower()
                    
                    if any(browser in name for browser in ['chromium', 'chrome']) or \
                       any(browser in cmdline for browser in ['chromium', 'chrome']):
                        
                        # Get process age
                        create_time = datetime.fromtimestamp(proc.info['create_time'])
                        age = datetime.now() - create_time
                        
                        # Get memory usage
                        memory_mb = proc.info['memory_info'].rss / 1024 / 1024
                        
                        chromium_processes.append({
                            "pid": proc.info['pid'],
                            "name": proc.info['name'],
                            "age_minutes": int(age.total_seconds() / 60),
                            "memory_mb": round(memory_mb, 2),
                            "is_managed": proc.info['pid'] in browser_pids.values(),
                            "is_playwright": 'playwright' in cmdline or '--remote-debugging-pipe' in cmdline
                        })
                        
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
                    
        except Exception as e:
            logger.error(f"Error getting process info: {e}")
        
        # Sort by age
        chromium_processes.sort(key=lambda x: x['age_minutes'], reverse=True)
        
        return {
            "success": True,
            "data": {
                "active_sessions": len(active_sessions),
                "session_ids": active_sessions,
                "chromium_processes": len(chromium_processes),
                "processes": chromium_processes[:20],  # Limit to 20 for response size
                "monitoring_active": browser_manager.cleanup_task is not None and not browser_manager.cleanup_task.done(),
                "max_browser_lifetime_minutes": int(browser_manager.max_browser_lifetime.total_seconds() / 60)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting browser status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cleanup")
async def cleanup_browsers(
    force: bool = False,
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """Clean up stuck browser processes"""
    try:
        logger.info(f"Browser cleanup requested by user {current_user.id} (force={force})")
        
        if force:
            # Force kill all Chromium processes
            kill_chromium_processes()
            cleaned = await browser_manager.force_cleanup_all()
            message = "Force cleaned all browser processes"
        else:
            # Normal cleanup of stuck processes
            cleaned = await browser_manager.cleanup_stuck_browsers()
            message = f"Cleaned up {cleaned} stuck browser processes"
        
        return {
            "success": True,
            "message": message,
            "cleaned_count": cleaned
        }
        
    except Exception as e:
        logger.error(f"Error during browser cleanup: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/monitoring/start")
async def start_monitoring(current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Start browser process monitoring"""
    try:
        browser_manager.start_monitoring()
        return {
            "success": True,
            "message": "Browser monitoring started"
        }
    except Exception as e:
        logger.error(f"Error starting browser monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/monitoring/stop")
async def stop_monitoring(current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    """Stop browser process monitoring"""
    try:
        browser_manager.stop_monitoring()
        return {
            "success": True,
            "message": "Browser monitoring stopped"
        }
    except Exception as e:
        logger.error(f"Error stopping browser monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health", dependencies=[])
async def browser_health_check() -> Dict[str, Any]:
    """Quick health check for browser system"""
    try:
        # Count Chromium processes
        chromium_count = 0
        stuck_count = 0
        
        try:
            for proc in psutil.process_iter(['pid', 'name', 'create_time']):
                name = proc.info['name'].lower()
                if 'chromium' in name or 'chrome' in name:
                    chromium_count += 1
                    
                    # Check if stuck (older than 30 minutes)
                    create_time = datetime.fromtimestamp(proc.info['create_time'])
                    age = datetime.now() - create_time
                    if age > timedelta(minutes=30):
                        stuck_count += 1
                        
        except Exception:
            pass
        
        health_status = "healthy"
        if stuck_count > 5:
            health_status = "unhealthy"
        elif stuck_count > 0:
            health_status = "degraded"
        
        return {
            "status": health_status,
            "chromium_processes": chromium_count,
            "stuck_processes": stuck_count,
            "monitoring_active": browser_manager.cleanup_task is not None and not browser_manager.cleanup_task.done()
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }