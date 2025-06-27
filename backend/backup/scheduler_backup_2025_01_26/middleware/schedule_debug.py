"""
Debug middleware for schedule-related requests
"""

import json
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from app.services.logging_service import get_logger

logger = get_logger("fossawork.schedule_debug")

class ScheduleDebugMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Only log schedule-related endpoints
        if "scraping-schedule" in str(request.url):
            logger.info(f"=== HTTP REQUEST ===")
            logger.info(f"Method: {request.method}")
            logger.info(f"URL: {request.url}")
            logger.info(f"Headers: {dict(request.headers)}")
            
            # Try to log request body for PUT/POST
            if request.method in ["PUT", "POST"]:
                try:
                    body = await request.body()
                    request._body = body  # Store for later use
                    logger.info(f"Body: {body.decode('utf-8')}")
                except:
                    pass
        
        response = await call_next(request)
        
        # Log response for schedule endpoints
        if "scraping-schedule" in str(request.url):
            logger.info(f"=== HTTP RESPONSE ===")
            logger.info(f"Status: {response.status_code}")
            logger.info(f"Headers: {dict(response.headers)}")
        
        return response