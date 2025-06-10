"""
Setup Routes for Initial System Configuration
These routes are only available when no users exist in the system
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Dict, Any
import json

from ..database import get_db
from ..models.user_models import User
from ..auth.security import AuthenticationService
from ..services.logging_service import LoggingService
from pydantic import BaseModel

router = APIRouter(prefix="/api/setup", tags=["setup"])

# ULTRA SIMPLE TEST - NO DEPENDENCIES AT ALL
@router.get("/ultra-simple")
async def ultra_simple():
    print("ULTRA SIMPLE ENDPOINT CALLED!")
    return {"message": "ultra simple works"}

@router.post("/ultra-simple-post")
async def ultra_simple_post():
    import logging
    import sys
    logger = logging.getLogger(__name__)
    
    print("ULTRA SIMPLE POST ENDPOINT CALLED!", flush=True)
    sys.stdout.flush()
    logger.error("ULTRA SIMPLE POST ENDPOINT CALLED - LOGGER!")
    
    return {"message": "ultra simple POST works"}

# MINIMAL TEST THAT MIMICS INITIALIZE BUT DIFFERENT NAME
@router.post("/test-minimal")
async def test_minimal():
    import logging
    import sys
    logger = logging.getLogger(__name__)
    
    print("MINIMAL TEST ENDPOINT CALLED!", flush=True)
    sys.stdout.flush()
    logger.error("MINIMAL TEST ENDPOINT CALLED - LOGGER!")
    
    return {"message": "minimal test works", "success": True}

# Add a test endpoint to debug the issue
@router.post("/debug")
async def debug_setup(request: Request):
    """Debug endpoint to see what's being sent"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        body = await request.body()
        logger.info(f"[DEBUG] Raw body: {body}")
        
        if body:
            import json
            data = json.loads(body)
            logger.info(f"[DEBUG] Parsed data: {data}")
        
        return {"success": True, "message": "Debug endpoint working", "body_received": len(body) if body else 0}
    except Exception as e:
        logger.error(f"[DEBUG] Error: {e}")
        return {"success": False, "error": str(e)}

@router.post("/test-simple")
async def test_simple():
    """Simplest possible endpoint"""
    import logging
    logger = logging.getLogger(__name__)
    logger.info("[TEST] ========== SIMPLE TEST ENDPOINT CALLED ==========")
    return {"message": "Simple test working"}

@router.post("/test-auth")
async def test_auth(request: Request):
    """Test auth endpoint with request body"""
    import logging
    logger = logging.getLogger(__name__)
    logger.info("[TEST] ========== AUTH TEST ENDPOINT CALLED ==========")
    
    try:
        body = await request.body()
        logger.info(f"[TEST] Received body: {body}")
        return {"message": "Auth test working", "body_length": len(body)}
    except Exception as e:
        logger.error(f"[TEST] Error: {e}")
        return {"error": str(e)}

class SetupRequest(BaseModel):
    username: str
    password: str

class SetupResponse(BaseModel):
    success: bool
    message: str
    user_created: bool
    access_token: str

def check_setup_required(db: Session = Depends(get_db)):
    """Check if setup is required (no users exist)"""
    user_count = db.query(User).count()
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Setup has already been completed. Please use /api/auth/login"
        )
    return True

@router.get("/status", response_model=Dict[str, Any])
async def get_setup_status(db: Session = Depends(get_db)):
    """Check if initial setup is required"""
    user_count = db.query(User).count()
    
    return {
        "setup_required": user_count == 0,
        "user_count": user_count,
        "message": "Please complete initial setup" if user_count == 0 else "System is configured"
    }

@router.post("/initialize-test")
async def initialize_system_test(request: Request):
    """
    TEST VERSION: Initialize system with first user using WorkFossa credentials
    This endpoint is only available when no users exist
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Force immediate output to console
    import sys
    print("=" * 60, flush=True)
    print("SETUP ENDPOINT CALLED - INITIALIZE TEST", flush=True)
    print("=" * 60, flush=True)
    sys.stdout.flush()
    
    logger.error("[SETUP] ========== INITIALIZE TEST ENDPOINT CALLED ==========")
    logger.error(f"[SETUP] Request method: {request.method}")
    return {"success": True, "message": "Initialize test working"}

@router.post("/initialize")
async def initialize_system(setup_request: SetupRequest, db: Session = Depends(get_db)):
    """
    Initialize system with first user using WorkFossa credentials
    This endpoint is only available when no users exist
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"[SETUP] Initialize endpoint called with username: {setup_request.username}")
    
    # Check if setup is already completed
    user_count = db.query(User).count()
    if user_count > 0:
        logger.warning(f"[SETUP] Setup already completed, {user_count} users exist")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Setup has already been completed. Please use /api/auth/login"
        )
    
    logger.info(f"[SETUP] Creating AuthenticationService...")
    auth_service = AuthenticationService(db)
    
    # Authenticate and create first user
    logger.info(f"[SETUP] Authenticating with WorkFossa...")
    user = await auth_service.authenticate_with_workfossa(
        setup_request.username,
        setup_request.password
    )
    
    if not user:
        logger.error(f"[SETUP] Authentication failed for {setup_request.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid WorkFossa credentials. Please verify your username and password."
        )
    
    logger.info(f"[SETUP] User created successfully: {user.username}")
    
    # Create access token for immediate login
    from ..auth.security import create_access_token
    from datetime import timedelta
    
    access_token = create_access_token(
        data={"sub": user.id, "username": user.username},
        expires_delta=timedelta(hours=24)
    )
    
    logger.info(f"[SETUP] Access token created for user {user.username}")
    
    return {
        "success": True,
        "message": "System initialized successfully! You can now use the application.",
        "user_created": True,
        "access_token": access_token
    }
    
    # Get database session manually  
    from ..database import SessionLocal
    db = SessionLocal()
    
    # Manual setup check first
    user_count = db.query(User).count()
    logger.info(f"[SETUP] Current user count in database: {user_count}")
    
    if user_count > 0:
        logger.warning(f"[SETUP] Setup already completed, {user_count} users exist")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Setup has already been completed. Please use /api/auth/login"
        )
    
    # Parse request body manually
    try:
        body = await request.body()
        logger.info(f"[SETUP] Raw request body: {body}")
        
        request_data = json.loads(body)
        logger.info(f"[SETUP] Parsed JSON: {request_data}")
        
        username = request_data.get("username")
        password = request_data.get("password")
        
        if not username or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username and password are required"
            )
        
    except json.JSONDecodeError as e:
        logger.error(f"[SETUP] JSON decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON format"
        )
    except Exception as e:
        logger.error(f"[SETUP] Request parsing error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Request parsing failed: {str(e)}"
        )
    
    logger.info(f"[SETUP] Starting setup for username: {username}")
    
    try:
        logger.info(f"[SETUP] Creating AuthenticationService...")
        auth_service = AuthenticationService(db)
        logger.info(f"[SETUP] AuthenticationService created successfully")
        
        # Authenticate and create first user
        logger.info(f"[SETUP] Calling authenticate_with_workfossa...")
        user = await auth_service.authenticate_with_workfossa(
            username,
            password
        )
        
        logger.info(f"[SETUP] Authentication result: user={user is not None}")
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid WorkFossa credentials. Please verify your username and password."
            )
        
        # Create access token for immediate login
        from ..auth.security import create_access_token
        from datetime import timedelta
        
        access_token = create_access_token(
            data={"sub": user.id, "username": user.username},
            expires_delta=timedelta(hours=24)
        )
        
        return {
            "success": True,
            "message": "System initialized successfully! You can now use the application.",
            "user_created": True,
            "access_token": access_token
        }
        
    except HTTPException as he:
        logger.error(f"[SETUP] HTTP Exception: {he.detail}")
        raise
    except Exception as e:
        logger.error(f"[SETUP] Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize system: {str(e)}"
        )
    finally:
        if 'db' in locals():
            db.close()