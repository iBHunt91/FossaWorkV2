"""
Logging Routes for FossaWork V2
Provides API endpoints for log management and real-time streaming
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Dict, Any
import asyncio
import json
from ..services.logging_service import logging_service, get_logger

router = APIRouter(prefix="/api/v1/logs", tags=["logging"])
logger = get_logger("api.logging")

@router.websocket("/stream")
async def websocket_log_stream(websocket: WebSocket):
    """WebSocket endpoint for real-time log streaming"""
    await websocket.accept()
    logging_service.add_websocket_connection(websocket)
    logger.info("🔌 WebSocket connection established for log streaming")
    
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connection",
            "message": "Connected to real-time logs",
            "timestamp": logging_service.get_log_stats()["timestamp"]
        })
        
        # Keep connection alive and handle messages
        while True:
            try:
                # Wait for client messages (ping/pong, requests, etc.)
                data = await asyncio.wait_for(websocket.receive_json(), timeout=30.0)
                
                # Handle client requests
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": logging_service.get_log_stats()["timestamp"]})
                elif data.get("type") == "request_recent":
                    lines = data.get("lines", 50)
                    recent_logs = logging_service.get_recent_logs(lines)
                    await websocket.send_json({
                        "type": "recent_logs",
                        "logs": recent_logs,
                        "count": len(recent_logs)
                    })
                elif data.get("type") == "request_stats":
                    stats = logging_service.get_log_stats()
                    await websocket.send_json({
                        "type": "stats",
                        "data": stats
                    })
                    
            except asyncio.TimeoutError:
                # Send periodic ping to keep connection alive
                await websocket.send_json({"type": "ping", "timestamp": logging_service.get_log_stats()["timestamp"]})
                
    except WebSocketDisconnect:
        logger.info("🔌 WebSocket disconnected from log streaming")
        logging_service.remove_websocket_connection(websocket)
    except Exception as e:
        logger.error(f"WebSocket error in log streaming: {e}")
        logging_service.remove_websocket_connection(websocket)

@router.get("/recent")
async def get_recent_logs(lines: int = 100):
    """Get recent log entries"""
    try:
        if lines > 1000:
            raise HTTPException(status_code=400, detail="Maximum 1000 lines allowed")
            
        recent_logs = logging_service.get_recent_logs(lines)
        logger.info(f"📋 Retrieved {len(recent_logs)} recent log entries")
        
        return {
            "logs": recent_logs,
            "count": len(recent_logs),
            "requested_lines": lines
        }
    except Exception as e:
        logger.error(f"Error retrieving recent logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_log_stats():
    """Get logging system statistics"""
    try:
        stats = logging_service.get_log_stats()
        logger.info("[DATA] Retrieved logging statistics")
        return stats
    except Exception as e:
        logger.error(f"Error retrieving log stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/clear")
async def clear_logs():
    """Clear all log files (emergency use only)"""
    try:
        # This recreates the logging service, which clears logs
        global logging_service
        logging_service = logging_service.__class__()
        logger.info("[CLEANUP] All log files cleared manually")
        
        return {
            "message": "All log files cleared successfully",
            "timestamp": logging_service.get_log_stats()["timestamp"]
        }
    except Exception as e:
        logger.error(f"Error clearing logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/files")
async def list_log_files():
    """List all available log files with metadata"""
    try:
        stats = logging_service.get_log_stats()
        files_info = []
        
        for name, file_info in stats["log_files"].items():
            files_info.append({
                "name": name,
                "size_mb": file_info["size_mb"],
                "lines": file_info["lines"],
                "path": file_info["path"],
                "download_url": f"/api/v1/logs/download/{name}"
            })
            
        logger.info(f"[FILE] Listed {len(files_info)} log files")
        return {
            "files": files_info,
            "total_files": len(files_info)
        }
    except Exception as e:
        logger.error(f"Error listing log files: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{log_type}")
async def download_log_file(log_type: str):
    """Download a specific log file"""
    try:
        log_files = {
            "main": logging_service.main_log_file,
            "errors": logging_service.error_log_file,
            "automation": logging_service.automation_log_file,
            "api": logging_service.api_log_file
        }
        
        if log_type not in log_files:
            raise HTTPException(status_code=404, detail=f"Log type '{log_type}' not found")
            
        log_file = log_files[log_type]
        
        if not log_file.exists():
            raise HTTPException(status_code=404, detail=f"Log file '{log_type}' does not exist")
            
        with open(log_file, 'r') as f:
            content = f.read()
            
        logger.info(f"⬇️ Downloaded {log_type} log file ({len(content)} characters)")
        
        return JSONResponse(
            content={"content": content, "filename": log_file.name},
            headers={"Content-Disposition": f"attachment; filename={log_file.name}"}
        )
        
    except Exception as e:
        logger.error(f"Error downloading log file {log_type}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/write")
async def write_log_entry(log_data: Dict[str, Any]):
    """Write log entries from the frontend"""
    try:
        # Handle both single log entries and batched logs
        logs = log_data.get("logs", [log_data]) if "logs" in log_data else [log_data]
        session_id = log_data.get("sessionId", "unknown")
        source = log_data.get("source", "frontend")
        
        entries_written = 0
        
        for log_entry in logs:
            level = log_entry.get("level", "info").lower()
            message = log_entry.get("message", "")
            logger_name = log_entry.get("logger", f"frontend.{source}")
            data = log_entry.get("data", {})
            
            # Get appropriate logger
            frontend_logger = get_logger("api.frontend")
            
            # Create structured log entry
            log_message = f"[{session_id}] {message}"
            
            # Log at appropriate level with structured data
            if level == "debug":
                frontend_logger.debug(log_message, extra={"frontend_data": data, "logger": logger_name})
            elif level in ["warning", "warn"]:
                frontend_logger.warning(log_message, extra={"frontend_data": data, "logger": logger_name})
            elif level == "error":
                frontend_logger.error(log_message, extra={"frontend_data": data, "logger": logger_name})
            else:
                frontend_logger.info(log_message, extra={"frontend_data": data, "logger": logger_name})
            
            entries_written += 1
            
        # Also write to dedicated frontend log files in JSONL format
        await _write_frontend_logs_to_files(logs, session_id)
        
        return {
            "status": "success",
            "message": f"{entries_written} log entries written",
            "entries_written": entries_written,
            "timestamp": logging_service.get_log_stats()["timestamp"]
        }
    except Exception as e:
        logger.error(f"Error writing frontend logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _write_frontend_logs_to_files(logs: List[Dict[str, Any]], session_id: str):
    """Write frontend logs to organized JSONL files"""
    try:
        import json
        from datetime import datetime
        from pathlib import Path
        
        # Use the same log directory as the logging service
        log_dir = Path("../logs")
        log_dir.mkdir(exist_ok=True)
        
        # Create frontend subdirectory
        frontend_dir = log_dir / "frontend"
        frontend_dir.mkdir(exist_ok=True)
        
        # Create sessions subdirectory
        sessions_dir = log_dir / "sessions"
        sessions_dir.mkdir(exist_ok=True)
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Categorized log files
        log_files = {
            "general": frontend_dir / f"frontend-general-{today}.jsonl",
            "errors": log_dir / "errors" / f"frontend-errors-{today}.jsonl",
            "api": frontend_dir / f"frontend-api-{today}.jsonl",
            "components": frontend_dir / f"frontend-components-{today}.jsonl",
            "performance": log_dir / "performance" / f"frontend-performance-{today}.jsonl",
            "session": sessions_dir / f"{session_id}.jsonl"
        }
        
        for log_entry in logs:
            # Create JSONL entry
            jsonl_entry = {
                "timestamp": log_entry.get("timestamp") or datetime.now().isoformat(),
                "level": log_entry.get("level", "info"),
                "logger": log_entry.get("logger", "frontend"),
                "message": log_entry.get("message", ""),
                "module": log_entry.get("module"),
                "function": log_entry.get("function"),
                "line": log_entry.get("line"),
                "sessionId": session_id,
                "data": log_entry.get("data", {})
            }
            
            # Determine which files to write to based on logger name
            logger_name = log_entry.get("logger", "")
            
            # Always write to general and session logs
            write_targets = ["general", "session"]
            
            # Categorize based on logger name
            if "error" in logger_name.lower() or log_entry.get("level") == "error":
                write_targets.append("errors")
            if "api" in logger_name.lower() or "network" in logger_name.lower():
                write_targets.append("api")
            if "component" in logger_name.lower() or "react" in logger_name.lower():
                write_targets.append("components")
            if "performance" in logger_name.lower() or "devtools.performance" in logger_name.lower():
                write_targets.append("performance")
            
            # Write to appropriate log files
            for target in write_targets:
                if target in log_files:
                    log_file = log_files[target]
                    log_file.parent.mkdir(exist_ok=True)
                    
                    with open(log_file, "a", encoding="utf-8") as f:
                        f.write(json.dumps(jsonl_entry, ensure_ascii=False) + "\n")
        
    except Exception as e:
        # Don't let file writing errors break the API
        logger.error(f"Error writing frontend logs to files: {e}")

@router.post("/test")
async def test_logging():
    """Test endpoint to generate sample log entries at all levels"""
    try:
        main_logger = get_logger("fossawork.test")
        api_logger = get_logger("api.test")
        automation_logger = get_logger("automation.test")
        
        # Generate test logs at different levels
        main_logger.debug("🐛 This is a debug message for testing")
        main_logger.info("[INFO] This is an info message for testing")
        main_logger.warning("[WARNING] This is a warning message for testing")
        
        api_logger.info("[WEB] Test API call logged")
        automation_logger.info("[BOT] Test automation event logged")
        
        try:
            # Generate a test error
            raise ValueError("This is a test error - not a real problem!")
        except ValueError as e:
            main_logger.error("[ERROR] Test error logged", exc_info=True)
        
        return {
            "message": "Test log entries generated successfully",
            "entries_created": 6,
            "levels": ["debug", "info", "warning", "error"],
            "loggers": ["main", "api", "automation"]
        }
        
    except Exception as e:
        logger.error(f"Error in test logging: {e}")
        raise HTTPException(status_code=500, detail=str(e))