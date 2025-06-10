"""
Real-time Logging Service for FossaWork V2 Backend
Provides detailed logging with real-time streaming capabilities
"""

import logging
import asyncio
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from logging.handlers import RotatingFileHandler
import threading
from queue import Queue
import time
import platform

# Safe console output for Windows
try:
    from ..utils.console_utils import SafeConsoleFormatter, is_windows_console
except ImportError:
    # Fallback if utils not available
    SafeConsoleFormatter = None
    is_windows_console = lambda: platform.system() == "Windows"
from fastapi import WebSocket
import traceback

class RealTimeLogHandler(logging.Handler):
    """Custom logging handler that broadcasts logs to WebSocket connections"""
    
    def __init__(self):
        super().__init__()
        self.connections: List[WebSocket] = []
        self.log_queue = Queue()
        
    def add_connection(self, websocket: WebSocket):
        """Add a WebSocket connection for real-time log streaming"""
        self.connections.append(websocket)
        
    def remove_connection(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if websocket in self.connections:
            self.connections.remove(websocket)
            
    def emit(self, record):
        """Emit log record to all connected WebSocket clients"""
        try:
            log_entry = self.format_log_entry(record)
            self.log_queue.put(log_entry)
            
            # Send to all connected WebSocket clients
            disconnected = []
            for connection in self.connections[:]:  # Create a copy to iterate safely
                try:
                    asyncio.create_task(self._send_to_websocket(connection, log_entry))
                except Exception:
                    disconnected.append(connection)
                    
            # Remove disconnected clients
            for conn in disconnected:
                self.remove_connection(conn)
                
        except Exception as e:
            # Fallback to prevent logging errors from breaking the application
            print(f"Logging error: {e}")
            
    async def _send_to_websocket(self, websocket: WebSocket, log_entry: Dict[str, Any]):
        """Send log entry to a specific WebSocket connection"""
        try:
            await websocket.send_json(log_entry)
        except Exception:
            # Connection is likely closed, will be removed in emit()
            pass
            
    def format_log_entry(self, record) -> Dict[str, Any]:
        """Format log record into structured JSON"""
        return {
            "timestamp": datetime.fromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "thread": record.thread,
            "process": record.process,
            "pathname": record.pathname,
            "exception": self.format_exception(record) if record.exc_info else None
        }
        
    def format_exception(self, record) -> Optional[str]:
        """Format exception information"""
        if record.exc_info:
            return ''.join(traceback.format_exception(*record.exc_info))
        return None

class LoggingService:
    """Centralized logging service for FossaWork V2"""
    
    def __init__(self, log_dir: str = "../logs"):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)
        
        # Create organized subdirectories
        for subdir in ["backend", "automation", "errors", "performance", "sessions"]:
            (self.log_dir / subdir).mkdir(exist_ok=True)
        
        # Date-based log files for AI debugging
        today = datetime.now().strftime("%Y-%m-%d")
        self.main_log_file = self.log_dir / "backend" / f"backend-general-{today}.jsonl"
        self.error_log_file = self.log_dir / "errors" / f"backend-errors-{today}.jsonl"
        self.automation_log_file = self.log_dir / "automation" / f"backend-automation-{today}.jsonl"
        self.api_log_file = self.log_dir / "backend" / f"backend-api-{today}.jsonl"
        
        # Real-time handler for WebSocket streaming
        self.realtime_handler = RealTimeLogHandler()
        
        # Clear logs on restart
        self._clear_logs_on_restart()
        
        # Set up loggers
        self._setup_loggers()
        
        # Start background log processor
        self._start_log_processor()
        
    def _clear_logs_on_restart(self):
        """Clear all log files when service starts - DISABLED due to Windows file locking"""
        # Disabled due to Windows file locking issues - logs will accumulate
        # TODO: Implement safer log rotation mechanism
        return
                
        msg = f"Cleared logs on restart at {datetime.now().isoformat()}"
        if is_windows_console():
            print(f"[CLEANUP] {msg}")
        else:
            print(f"[CLEANUP] {msg}")
        
    def _setup_loggers(self):
        """Set up all loggers with appropriate handlers and formatters"""
        
        # Detailed formatter
        detailed_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)-20s | %(funcName)-15s:%(lineno)-4d | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        # Simple formatter for console
        console_formatter = logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(name)-15s | %(message)s',
            datefmt='%H:%M:%S'
        )
        
        # Main application logger
        self.main_logger = logging.getLogger("fossawork")
        self.main_logger.setLevel(logging.DEBUG)
        
        # File handler for main logs
        main_file_handler = logging.FileHandler(self.main_log_file, mode='w')
        main_file_handler.setLevel(logging.DEBUG)
        main_file_handler.setFormatter(detailed_formatter)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        # Use SafeConsoleFormatter on Windows to handle emojis
        if SafeConsoleFormatter and is_windows_console():
            safe_formatter = SafeConsoleFormatter(console_formatter)
            console_handler.setFormatter(safe_formatter)
        else:
            console_handler.setFormatter(console_formatter)
        
        # Real-time handler
        self.realtime_handler.setLevel(logging.DEBUG)
        self.realtime_handler.setFormatter(detailed_formatter)
        
        # Add handlers to main logger
        self.main_logger.addHandler(main_file_handler)
        self.main_logger.addHandler(console_handler)
        self.main_logger.addHandler(self.realtime_handler)
        
        # Error logger (for error-level logs only)
        self.error_logger = logging.getLogger("fossawork.errors")
        self.error_logger.setLevel(logging.ERROR)
        
        error_file_handler = logging.FileHandler(self.error_log_file, mode='w')
        error_file_handler.setLevel(logging.ERROR)
        error_file_handler.setFormatter(detailed_formatter)
        self.error_logger.addHandler(error_file_handler)
        self.error_logger.addHandler(self.realtime_handler)
        
        # API logger
        self.api_logger = logging.getLogger("fossawork.api")
        self.api_logger.setLevel(logging.DEBUG)
        
        api_file_handler = logging.FileHandler(self.api_log_file, mode='w')
        api_file_handler.setLevel(logging.DEBUG)
        api_file_handler.setFormatter(detailed_formatter)
        self.api_logger.addHandler(api_file_handler)
        self.api_logger.addHandler(self.realtime_handler)
        
        # Automation logger
        self.automation_logger = logging.getLogger("fossawork.automation")
        self.automation_logger.setLevel(logging.DEBUG)
        
        automation_file_handler = logging.FileHandler(self.automation_log_file, mode='w')
        automation_file_handler.setLevel(logging.DEBUG)
        automation_file_handler.setFormatter(detailed_formatter)
        self.automation_logger.addHandler(automation_file_handler)
        self.automation_logger.addHandler(self.realtime_handler)
        
        # Set logging levels for third-party libraries
        logging.getLogger("uvicorn").setLevel(logging.WARNING)
        logging.getLogger("fastapi").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
        
        self.main_logger.info("Logging service initialized successfully")
        
    def _start_log_processor(self):
        """Start background thread for processing logs"""
        def log_processor():
            while True:
                try:
                    # Process any queued log entries
                    time.sleep(0.1)
                except Exception as e:
                    print(f"Log processor error: {e}")
                    
        processor_thread = threading.Thread(target=log_processor, daemon=True)
        processor_thread.start()
        
    def get_logger(self, name: str) -> logging.Logger:
        """Get a logger instance for a specific component"""
        if name.startswith("api"):
            return self.api_logger
        elif name.startswith("automation"):
            return self.automation_logger
        elif name.startswith("error"):
            return self.error_logger
        else:
            return self.main_logger
            
    def add_websocket_connection(self, websocket: WebSocket):
        """Add WebSocket connection for real-time log streaming"""
        self.realtime_handler.add_connection(websocket)
        self.main_logger.info(f"[NETWORK] WebSocket connected for real-time logs")
        
    def remove_websocket_connection(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        self.realtime_handler.remove_connection(websocket)
        self.main_logger.info(f"[NETWORK] WebSocket disconnected from real-time logs")
        
    def get_recent_logs(self, lines: int = 100) -> List[str]:
        """Get recent log entries from file"""
        try:
            if self.main_log_file.exists():
                with open(self.main_log_file, 'r') as f:
                    logs = f.readlines()
                    return [log.strip() for log in logs[-lines:]]
            return []
        except Exception as e:
            self.main_logger.error(f"Error reading recent logs: {e}")
            return []
            
    def get_log_stats(self) -> Dict[str, Any]:
        """Get logging statistics"""
        stats = {
            "connected_clients": len(self.realtime_handler.connections),
            "log_files": {},
            "timestamp": datetime.now().isoformat()
        }
        
        # Get file sizes and line counts
        log_files = {
            "main": self.main_log_file,
            "errors": self.error_log_file,
            "automation": self.automation_log_file,
            "api": self.api_log_file
        }
        
        for name, file_path in log_files.items():
            if file_path.exists():
                size = file_path.stat().st_size
                try:
                    with open(file_path, 'r') as f:
                        lines = sum(1 for _ in f)
                except:
                    lines = 0
                    
                stats["log_files"][name] = {
                    "size_bytes": size,
                    "size_mb": round(size / 1024 / 1024, 2),
                    "lines": lines,
                    "path": str(file_path)
                }
            else:
                stats["log_files"][name] = {
                    "size_bytes": 0,
                    "size_mb": 0,
                    "lines": 0,
                    "path": str(file_path)
                }
                
        return stats

# Global logging service instance
logging_service = LoggingService()

# Convenience functions for easy logging
def get_logger(name: str = "fossawork") -> logging.Logger:
    """Get a logger instance"""
    return logging_service.get_logger(name)

def log_api_request(method: str, path: str, status_code: int, 
                   duration_ms: float, user_id: Optional[int] = None):
    """Log API request details"""
    logger = get_logger("api")
    logger.info(
        f"API {method} {path} -> {status_code} "
        f"({duration_ms:.2f}ms)"
        f"{f' | User: {user_id}' if user_id else ''}"
    )

def log_automation_event(event: str, details: Dict[str, Any]):
    """Log automation events with structured data"""
    logger = get_logger("automation")
    details_str = json.dumps(details, default=str)
    logger.info(f"[BOT] {event} | {details_str}")

def log_error(error: Exception, context: str = ""):
    """Log error with full context"""
    logger = get_logger("error")
    logger.error(f"[ERROR] {context}: {str(error)}", exc_info=True)

def log_user_action(user_id: int, action: str, details: Dict[str, Any] = None):
    """Log user actions for audit trail"""
    logger = get_logger("fossawork")
    details_str = json.dumps(details, default=str) if details else ""
    logger.info(f"[USER] User {user_id}: {action} {details_str}")