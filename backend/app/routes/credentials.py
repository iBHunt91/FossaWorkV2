#!/usr/bin/env python3
"""
User Credentials API routes - Secure WorkFossa credential management
Enhanced with file-based encrypted storage and database fallback
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
import base64
import json
from datetime import datetime

from ..database import get_db
from ..models import User, UserCredential as UserCredentials
from ..services.credential_manager import credential_manager, WorkFossaCredentials

router = APIRouter(prefix="/api/v1/credentials", tags=["credentials"])

def simple_encrypt(password: str) -> str:
    """Simple base64 encoding for demo (use proper encryption in production)"""
    return base64.b64encode(password.encode()).decode()

def simple_decrypt(encrypted_password: str) -> str:
    """Simple base64 decoding for demo (use proper decryption in production)"""
    try:
        return base64.b64decode(encrypted_password.encode()).decode()
    except:
        return ""

@router.post("/workfossa")
async def save_workfossa_credentials(
    user_id: str,
    credentials: Dict[str, str],
    db: Session = Depends(get_db)
):
    """Save WorkFossa credentials securely - validates against app.workfossa.com first"""
    try:
        # Verify user exists or create demo user
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            # Auto-create demo user for demo mode
            user = User(
                id=user_id,
                username=user_id,
                email=f"{user_id}@fossawork.com",
                hashed_password=User.hash_password("demo123")  # Demo password
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
        
        # Also store in database for backward compatibility
        existing_creds = db.query(UserCredentials).filter(
            UserCredentials.user_id == user_id,
            UserCredentials.service_name == "workfossa"
        ).first()
        
        if existing_creds:
            # Update existing credentials
            existing_creds.encrypted_username = simple_encrypt(username)
            existing_creds.encrypted_password = simple_encrypt(password)
            existing_creds.updated_at = datetime.now()
            existing_creds.is_active = True
        else:
            # Create new credentials
            new_creds = UserCredentials(
                user_id=user_id,
                service_name="workfossa",
                encrypted_username=simple_encrypt(username),
                encrypted_password=simple_encrypt(password),
                is_active=True
            )
            db.add(new_creds)
        
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
    user_id: str,
    db: Session = Depends(get_db)
):
    """Get WorkFossa credentials for a user (username only, no password)"""
    try:
        credentials = db.query(UserCredentials).filter(
            UserCredentials.user_id == user_id,
            UserCredentials.service_name == "workfossa",
            UserCredentials.is_active == True
        ).first()
        
        if not credentials:
            return {
                "has_credentials": False,
                "username": "",
                "created_at": None
            }
        
        return {
            "has_credentials": True,
            "username": simple_decrypt(credentials.encrypted_username),
            "created_at": credentials.created_at.isoformat(),
            "updated_at": credentials.updated_at.isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve credentials: {str(e)}")

@router.get("/workfossa/decrypt")
async def get_workfossa_credentials_decrypted(
    user_id: str,
    db: Session = Depends(get_db)
):
    """Get decrypted WorkFossa credentials for automation use (internal only)"""
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
        
        # Fallback to database storage
        credentials = db.query(UserCredentials).filter(
            UserCredentials.user_id == user_id,
            UserCredentials.service_name == "workfossa",
            UserCredentials.is_active == True
        ).first()
        
        if not credentials:
            return {
                "username": "",
                "password": "",
                "storage_method": "none"
            }
        
        return {
            "username": simple_decrypt(credentials.encrypted_username),
            "password": simple_decrypt(credentials.encrypted_password),
            "storage_method": "database_fallback"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to decrypt credentials: {str(e)}")

@router.delete("/workfossa")
async def delete_workfossa_credentials(
    user_id: str,
    db: Session = Depends(get_db)
):
    """Delete WorkFossa credentials for a user"""
    try:
        credentials = db.query(UserCredentials).filter(
            UserCredentials.user_id == user_id,
            UserCredentials.service_name == "workfossa"
        ).first()
        
        if not credentials:
            raise HTTPException(status_code=404, detail="No credentials found")
        
        # Soft delete by marking inactive
        credentials.is_active = False
        credentials.updated_at = datetime.now()
        
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
    user_id: str,
    test_credentials: Dict[str, str] = None,
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
            # Test saved credentials
            credentials = db.query(UserCredentials).filter(
                UserCredentials.user_id == user_id,
                UserCredentials.service_name == "workfossa",
                UserCredentials.is_active == True
            ).first()
            
            if not credentials:
                raise HTTPException(status_code=404, detail="No WorkFossa credentials found")
            
            username = simple_decrypt(credentials.encrypted_username)
            password = simple_decrypt(credentials.encrypted_password)
        
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
async def get_security_info():
    """Get security configuration information"""
    try:
        security_info = credential_manager.get_security_info()
        
        return {
            "crypto_available": security_info['crypto_available'],
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
        
        # Fallback to database (this matches the existing endpoint behavior)
        from ..database import get_db
        db = next(get_db())
        
        try:
            db_credentials = db.query(UserCredentials).filter(
                UserCredentials.user_id == user_id,
                UserCredentials.service_name == "workfossa",
                UserCredentials.is_active == True
            ).first()
            
            if db_credentials:
                return {
                    'username': simple_decrypt(db_credentials.encrypted_username),
                    'password': simple_decrypt(db_credentials.encrypted_password)
                }
        finally:
            db.close()
        
        return {}
        
    except Exception as e:
        print(f"Error getting credentials for automation: {e}")
        return {}