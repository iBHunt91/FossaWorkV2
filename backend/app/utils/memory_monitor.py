"""
Memory monitoring and protection utilities for Python processes
"""
import psutil
import asyncio
import logging
import os
import signal
from typing import Optional, Callable

logger = logging.getLogger(__name__)

class MemoryMonitor:
    """Monitor memory usage and trigger actions when thresholds are exceeded"""
    
    def __init__(self, 
                 max_memory_mb: int = 6144,  # 6GB default
                 check_interval: int = 30,   # Check every 30 seconds
                 warning_threshold: float = 0.8,  # Warn at 80% of max
                 restart_callback: Optional[Callable] = None):
        self.max_memory_mb = max_memory_mb
        self.check_interval = check_interval
        self.warning_threshold = warning_threshold
        self.restart_callback = restart_callback
        self.is_monitoring = False
        
    async def start_monitoring(self):
        """Start memory monitoring loop"""
        self.is_monitoring = True
        logger.info(f"Starting memory monitoring (max: {self.max_memory_mb}MB, interval: {self.check_interval}s)")
        
        while self.is_monitoring:
            try:
                await self._check_memory()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Memory monitoring error: {e}")
                await asyncio.sleep(self.check_interval)
    
    def stop_monitoring(self):
        """Stop memory monitoring"""
        self.is_monitoring = False
        logger.info("Memory monitoring stopped")
    
    async def _check_memory(self):
        """Check current memory usage and take action if needed"""
        process = psutil.Process()
        memory_info = process.memory_info()
        memory_mb = memory_info.rss / 1024 / 1024
        
        warning_threshold_mb = self.max_memory_mb * self.warning_threshold
        
        if memory_mb > self.max_memory_mb:
            logger.critical(f"Memory limit exceeded: {memory_mb:.1f}MB > {self.max_memory_mb}MB - Initiating restart")
            await self._trigger_restart()
        elif memory_mb > warning_threshold_mb:
            logger.warning(f"Memory usage high: {memory_mb:.1f}MB (warning threshold: {warning_threshold_mb:.1f}MB)")
        else:
            logger.debug(f"Memory usage normal: {memory_mb:.1f}MB")
    
    async def _trigger_restart(self):
        """Trigger graceful restart"""
        try:
            if self.restart_callback:
                await self.restart_callback()
            else:
                logger.info("No restart callback defined, sending SIGTERM to self")
                os.kill(os.getpid(), signal.SIGTERM)
        except Exception as e:
            logger.error(f"Error during restart: {e}")
            # Force exit as last resort
            os._exit(1)

# Global memory monitor instance
memory_monitor: Optional[MemoryMonitor] = None

def setup_memory_monitoring(max_memory_mb: int = 6144, 
                           check_interval: int = 30,
                           restart_callback: Optional[Callable] = None):
    """Setup global memory monitoring"""
    global memory_monitor
    memory_monitor = MemoryMonitor(max_memory_mb, check_interval, restart_callback)
    return memory_monitor

async def start_memory_monitoring():
    """Start the global memory monitor"""
    if memory_monitor:
        await memory_monitor.start_monitoring()
    else:
        logger.warning("Memory monitor not setup - call setup_memory_monitoring first")

def stop_memory_monitoring():
    """Stop the global memory monitor"""
    if memory_monitor:
        memory_monitor.stop_monitoring()