#!/usr/bin/env python3
"""
User Credentials API routes - Secure WorkFossa credential management
Enhanced with file-based encrypted storage and database fallback
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body, Request
from sqlalchemy.orm import Session
from typing import Dict, Any
import base64
import json
import logging
from datetime import datetime

from ..database import get_db
from ..models import User, UserCredential as UserCredentials
from ..services.credential_manager_deprecated import credential_manager, WorkFossaCredentials
from ..core.security_deps import require_auth, require_user_access, log_security_violation

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/credentials", tags=["credentials"])

# Removed simple_encrypt/decrypt functions - using proper encryption via credential_manager

@router.post("/workfossa")
async def save_workfossa_credentials(
    user_id: str = Query(..., description="User ID to save credentials for"),
    credentials: Dict[str, str] = Body(..., description="Username and password credentials"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Save WorkFossa credentials securely - validates against app.workfossa.com first"""
    # Verify user can only save their own credentials
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to save credentials for this user")
    
    try:
        # Verify user exists or create demo user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            # Auto-create demo user for demo mode
            user = User(
                email=f"{user_id}@fossawork.com",
                password_hash=User.hash_password("demo123")  # Demo password
            )
            db.add(user)
            db.flush()  # Get the user ID
        
        username = credentials.get("username", "").strip()
        password = credentials.get("password", "").strip()
        
        if not username or not password:
            raise HTTPException(status_code=400, detail="Username and password are required")
        
        # Create secure credentials object
        secure_creds = WorkFossaCredentials(
            username=username,
            password=password,
            user_id=user_id,
            is_valid=False  # Will be validated below
        )
        
        # Store using secure credential manager (primary storage)
        stored_securely = credential_manager.store_credentials(secure_creds)
        
        # Mark successful validation after storage
        secure_creds.is_valid = True
        secure_creds.validation_attempts = 1
        credential_manager.store_credentials(secure_creds)
        
        # Remove database storage - only use secure credential manager
        # Clean up any old database entries
        existing_creds = db.query(UserCredentials).filter(
            UserCredentials.user_id == user_id,
            UserCredentials.service_name == "workfossa"
        ).first()
        
        if existing_creds:
            db.delete(existing_creds)
            db.commit()
        
        return {
            "status": "success",
            "message": "WorkFossa credentials saved successfully with enhanced security",
            "username": username,
            "secure_storage": stored_securely,
            "encryption_method": credential_manager.get_security_info()['encryption_method'],
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save credentials: {str(e)}")

@router.get("/workfossa")
async def get_workfossa_credentials(
    user_id: str = Query(..., description="User ID to get credentials for"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get WorkFossa credentials for a user (username only, no password)"""
    # Verify user can only get their own credentials
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to access this user's credentials")
    
    try:
        # Use secure credential manager
        secure_creds = credential_manager.retrieve_credentials(user_id)
        
        if not secure_creds:
            return {
                "has_credentials": False,
                "username": "",
                "created_at": None
            }
        
        return {
            "has_credentials": True,
            "username": secure_creds.username,
            "created_at": secure_creds.created_at.isoformat(),
            "updated_at": secure_creds.last_used.isoformat() if secure_creds.last_used else secure_creds.created_at.isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve credentials: {str(e)}")

@router.get("/workfossa/decrypt")
async def get_workfossa_credentials_decrypted(
    request: Request,
    user_id: str = Query(..., description="User ID to get decrypted credentials for"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get decrypted WorkFossa credentials for automation use (internal only)"""
    # Enhanced security check with logging
    try:
        await require_user_access(user_id, request, current_user)
    except HTTPException:
        # Log attempt to access credentials without authorization
        log_security_violation(
            request,
            "CREDENTIAL_DECRYPT_UNAUTHORIZED",
            f"Unauthorized attempt to decrypt credentials for user {user_id}",
            user_id=getattr(current_user, 'id', None)
        )
        raise
    
    # Log successful access for audit trail
    logger.info(
        f"CREDENTIAL_ACCESS: User {current_user.id} accessed decrypted credentials | "
        f"Target: {user_id} | IP: {request.client.host if request.client else 'Unknown'}"
    )
    
    try:
        # Try secure credential manager first
        secure_creds = credential_manager.retrieve_credentials(user_id)
        if secure_creds and credential_manager.validate_credentials(user_id):
            # Update last used timestamp
            credential_manager.update_last_used(user_id)
            return {
                "username": secure_creds.username,
                "password": secure_creds.password,
                "storage_method": "secure_file_storage"
            }
        
        # No fallback - only use secure storage
        return {
            "username": "",
            "password": "",
            "storage_method": "none"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to decrypt credentials: {str(e)}")

@router.delete("/workfossa")
async def delete_workfossa_credentials(
    user_id: str = Query(..., description="User ID to delete credentials for"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Delete WorkFossa credentials for a user"""
    # Verify user can only delete their own credentials
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this user's credentials")
    
    try:
        # Delete from secure credential manager
        deleted = credential_manager.delete_credentials(user_id)
        
        if not deleted:
            raise HTTPException(status_code=404, detail="No credentials found")
        
        # Clean up any legacy database entries
        credentials = db.query(UserCredentials).filter(
            UserCredentials.user_id == user_id,
            UserCredentials.service_name == "workfossa"
        ).first()
        
        if credentials:
            db.delete(credentials)
            db.commit()
        
        return {
            "status": "success",
            "message": "WorkFossa credentials deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete credentials: {str(e)}")

@router.post("/workfossa/test")
async def test_workfossa_credentials(
    user_id: str = Query(..., description="User ID to test credentials for"),
    test_credentials: Dict[str, str] = Body(None, description="Optional credentials to test"),
    db: Session = Depends(get_db)
):
    """Test WorkFossa credentials by attempting login to app.workfossa.com"""
    try:
        username = None
        password = None
        
        if test_credentials:
            # Test provided credentials (before saving)
            username = test_credentials.get("username", "").strip()
            password = test_credentials.get("password", "").strip()
        else:
            # Test saved credentials from secure storage
            secure_creds = credential_manager.retrieve_credentials(user_id)
            
            if not secure_creds:
                raise HTTPException(status_code=404, detail="No WorkFossa credentials found")
            
            username = secure_creds.username
            password = secure_creds.password
        
        if not username or not password:
            raise HTTPException(status_code=400, detail="Username and password are required")
        
        # Import WorkFossa automation service
        from ..services.workfossa_automation import workfossa_automation, WorkFossaCredentials
        
        # Create test credentials object
        test_creds = WorkFossaCredentials(
            email=username,
            password=password,
            user_id=user_id
        )
        
        # Test login to app.workfossa.com
        try:
            # Initialize browser if needed
            if not await workfossa_automation.initialize_browser():
                raise HTTPException(status_code=503, detail="Browser automation not available")
            
            # Create test session
            session_id = await workfossa_automation.create_automation_session(user_id, test_creds)
            
            # Test actual login to app.workfossa.com
            login_success = await workfossa_automation.login_to_workfossa(session_id)
            
            # Cleanup test session
            await workfossa_automation.close_session(session_id)
            
            return {
                "status": "success" if login_success else "failed",
                "message": "Login successful at app.workfossa.com" if login_success else "Login failed at app.workfossa.com - check credentials",
                "username": username,
                "url_tested": "https://app.workfossa.com",
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Test failed: {str(e)}",
                "username": username,
                "url_tested": "https://app.workfossa.com",
                "timestamp": datetime.now().isoformat()
            }
        
    except HTTPException:
        raise
    except Exception as e:
        return {
            "status": "error",
            "message": f"Test failed: {str(e)}",
            "timestamp": datetime.now().isoformat()
        }

@router.get("/security/info")
async def get_security_info(
    current_user: User = Depends(require_auth)
):
    """Get security configuration information"""
    try:
        security_info = credential_manager.get_security_info()
        
        return {
            "encryption_enabled": security_info['encryption_enabled'],
            "encryption_method": security_info['encryption_method'],
            "master_key_set": security_info['master_key_set'],
            "stored_users_count": security_info['stored_users_count'],
            "storage_path": security_info['storage_path'],
            "features": {
                "secure_file_storage": True,
                "database_fallback": True,
                "credential_validation": True,
                "usage_tracking": True
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get security info: {str(e)}")

# Internal function for automation service integration
async def get_user_credentials_for_automation(user_id: str) -> Dict[str, str]:
    """
    Internal function to get credentials for automation service
    Returns decrypted credentials for automation use
    """
    try:
        # Try secure credential manager first
        credentials = credential_manager.retrieve_credentials(user_id)
        if credentials and credential_manager.validate_credentials(user_id):
            # Update last used
            credential_manager.update_last_used(user_id)
            
            return {
                'username': credentials.username,
                'password': credentials.password
            }
        
        # No database fallback - only use secure credential storage
        return {}
        
    except Exception as e:
        print(f"Error getting credentials for automation: {e}")
        return {}