"""
File-based Logging Routes for FossaWork V2
Receives logs from frontend and writes them to organized log files
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
import json
import os
from datetime import datetime
from pathlib import Path
from ..services.logging_service import get_logger

router = APIRouter(prefix="/api/v1/logs", tags=["file-logging"])
logger = get_logger("api.file-logging")

# Base logs directory
LOGS_DIR = Path("logs")
LOGS_DIR.mkdir(exist_ok=True)

class LogFileManager:
    """Manages writing logs to organized files"""
    
    def __init__(self):
        self.logs_dir = LOGS_DIR
        self.ensure_directories()
    
    def ensure_directories(self):
        """Create necessary log directories"""
        directories = [
            self.logs_dir / "frontend",
            self.logs_dir / "backend", 
            self.logs_dir / "automation",
            self.logs_dir / "errors",
            self.logs_dir / "performance",
            self.logs_dir / "sessions"
        ]
        
        for directory in directories:
            directory.mkdir(exist_ok=True)
    
    def get_log_filename(self, source: str, log_type: str = "general") -> Path:
        """Generate organized log filename"""
        today = datetime.now().strftime("%Y-%m-%d")
        
        if source == "frontend":
            return self.logs_dir / "frontend" / f"frontend-{log_type}-{today}.jsonl"
        elif source == "backend":
            return self.logs_dir / "backend" / f"backend-{log_type}-{today}.jsonl"
        else:
            return self.logs_dir / f"{source}-{log_type}-{today}.jsonl"
    
    def categorize_log(self, log_entry: Dict[str, Any]) -> str:
        """Categorize log entry to determine file destination"""
        logger_name = log_entry.get('logger', '').lower()
        level = log_entry.get('level', '').lower()
        message = log_entry.get('message', '').lower()
        
        # Error logs
        if level == 'error' or 'error' in message or 'exception' in message:
            return "errors"
        
        # Automation logs
        if 'automation' in logger_name or 'bot' in message or '[BOT]' in message:
            return "automation"
        
        # Performance logs
        if 'performance' in logger_name or 'memory' in message or 'timing' in message:
            return "performance"
        
        # API logs
        if 'api' in logger_name or 'http' in message or '[WEB]' in message:
            return "api"
        
        # User action logs
        if 'user' in logger_name or '[USER]' in message:
            return "user-actions"
        
        # Component lifecycle logs
        if 'react' in logger_name or 'component' in logger_name or '⚛️' in message:
            return "components"
        
        # Default
        return "general"
    
    def write_logs(self, logs: List[Dict[str, Any]], source: str, session_id: str):
        """Write logs to appropriate files"""
        categorized_logs = {}
        session_logs = []
        
        # Categorize logs
        for log_entry in logs:
            category = self.categorize_log(log_entry)
            if category not in categorized_logs:
                categorized_logs[category] = []
            categorized_logs[category].append(log_entry)
            session_logs.append(log_entry)
        
        # Write categorized logs
        for category, category_logs in categorized_logs.items():
            log_file = self.get_log_filename(source, category)
            self._append_to_file(log_file, category_logs)
        
        # Write session-specific log
        session_file = self.logs_dir / "sessions" / f"{session_id}.jsonl"
        self._append_to_file(session_file, session_logs)
        
        logger.info(f"[LOG] Wrote {len(logs)} logs to files", {
            "source": source,
            "session_id": session_id,
            "categories": list(categorized_logs.keys()),
            "total_logs": len(logs)
        })
    
    def _append_to_file(self, file_path: Path, logs: List[Dict[str, Any]]):
        """Append logs to file in JSONL format"""
        try:
            with open(file_path, 'a', encoding='utf-8') as f:
                for log_entry in logs:
                    # Write each log as a JSON line
                    json_line = json.dumps(log_entry, default=str, ensure_ascii=False)
                    f.write(json_line + '\n')
        except Exception as e:
            logger.error(f"Failed to write to log file {file_path}: {e}")
    
    def get_log_stats(self) -> Dict[str, Any]:
        """Get statistics about log files"""
        stats = {
            "total_files": 0,
            "total_size_bytes": 0,
            "categories": {},
            "sessions": [],
            "oldest_log": None,
            "newest_log": None
        }
        
        try:
            for file_path in self.logs_dir.rglob("*.jsonl"):
                file_stat = file_path.stat()
                stats["total_files"] += 1
                stats["total_size_bytes"] += file_stat.st_size
                
                # Track by category
                category = file_path.stem.split('-')[-2] if '-' in file_path.stem else 'unknown'
                if category not in stats["categories"]:
                    stats["categories"][category] = {
                        "files": 0,
                        "size_bytes": 0,
                        "last_modified": None
                    }
                
                stats["categories"][category]["files"] += 1
                stats["categories"][category]["size_bytes"] += file_stat.st_size
                stats["categories"][category]["last_modified"] = datetime.fromtimestamp(file_stat.st_mtime).isoformat()
                
                # Track sessions
                if file_path.parent.name == "sessions":
                    stats["sessions"].append({
                        "session_id": file_path.stem,
                        "size_bytes": file_stat.st_size,
                        "last_modified": datetime.fromtimestamp(file_stat.st_mtime).isoformat()
                    })
        
        except Exception as e:
            logger.error(f"Error collecting log stats: {e}")
        
        return stats

# Global log file manager
log_file_manager = LogFileManager()

@router.post("/write")
async def write_logs(request_data: Dict[str, Any]):
    """Accept logs from frontend/backend and write to files"""
    try:
        logs = request_data.get("logs", [])
        session_id = request_data.get("sessionId", "unknown")
        source = request_data.get("source", "unknown")
        
        if not logs:
            raise HTTPException(status_code=400, detail="No logs provided")
        
        # Validate log format
        for log in logs:
            if not isinstance(log, dict) or 'timestamp' not in log or 'level' not in log:
                raise HTTPException(status_code=400, detail="Invalid log format")
        
        # Write logs to files
        log_file_manager.write_logs(logs, source, session_id)
        
        return {
            "success": True,
            "logs_written": len(logs),
            "session_id": session_id,
            "source": source,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error writing logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_log_stats():
    """Get statistics about log files"""
    try:
        stats = log_file_manager.get_log_stats()
        return stats
    except Exception as e:
        logger.error(f"Error getting log stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/files")
async def list_log_files():
    """List all available log files"""
    try:
        files = []
        
        for file_path in LOGS_DIR.rglob("*.jsonl"):
            file_stat = file_path.stat()
            relative_path = file_path.relative_to(LOGS_DIR)
            
            files.append({
                "path": str(relative_path),
                "full_path": str(file_path),
                "size_bytes": file_stat.st_size,
                "size_mb": round(file_stat.st_size / 1024 / 1024, 2),
                "last_modified": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                "category": file_path.parent.name,
                "type": file_path.stem.split('-')[-2] if '-' in file_path.stem else 'unknown'
            })
        
        # Sort by last modified (newest first)
        files.sort(key=lambda x: x["last_modified"], reverse=True)
        
        return {
            "files": files,
            "total_files": len(files),
            "total_size_mb": round(sum(f["size_bytes"] for f in files) / 1024 / 1024, 2)
        }
        
    except Exception as e:
        logger.error(f"Error listing log files: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{category}/{filename}")
async def download_log_file(category: str, filename: str):
    """Download a specific log file"""
    try:
        file_path = LOGS_DIR / category / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Log file not found")
        
        if not file_path.suffix == '.jsonl':
            raise HTTPException(status_code=400, detail="Invalid file type")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return JSONResponse(
            content={"content": content, "filename": filename},
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        logger.error(f"Error downloading log file: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clear")
async def clear_log_files():
    """Clear all log files (development/testing only)"""
    try:
        deleted_files = 0
        
        for file_path in LOGS_DIR.rglob("*.jsonl"):
            file_path.unlink()
            deleted_files += 1
        
        logger.info(f"[CLEANUP] Cleared {deleted_files} log files")
        
        return {
            "success": True,
            "deleted_files": deleted_files,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error clearing log files: {e}")
        raise HTTPException(status_code=500, detail=str(e))