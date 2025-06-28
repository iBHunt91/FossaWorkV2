#!/usr/bin/env python3
"""
Secure Credential Management Service
Handles encryption, storage, and validation of WorkFossa credentials
"""

import os
import json
import base64
import hashlib
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

# Cryptography is required - no fallback allowed
try:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
except ImportError as e:
    raise ImportError(
        "The 'cryptography' library is required for secure credential storage. "
        "Please install it with: pip install cryptography>=41.0.0"
    ) from e

@dataclass
class WorkFossaCredentials:
    """WorkFossa credential data structure"""
    username: str
    password: str
    user_id: str
    created_at: datetime = None
    last_used: datetime = None
    is_valid: bool = False
    validation_attempts: int = 0
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()

class CredentialManager:
    """
    Manages secure storage and retrieval of WorkFossa credentials
    """
    
    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path or self._get_default_storage_path()
        self.encryption_key = None
        self._ensure_storage_directory()
        
    def _get_default_storage_path(self) -> str:
        """Get default secure storage path"""
        # Use a secure directory for credential storage
        base_dir = Path(__file__).parent.parent.parent / "data" / "credentials"
        return str(base_dir)
    
    def _ensure_storage_directory(self):
        """Ensure credential storage directory exists with proper permissions"""
        os.makedirs(self.storage_path, mode=0o700, exist_ok=True)
        
        # Set restrictive permissions on the directory
        try:
            os.chmod(self.storage_path, 0o700)  # Owner read/write/execute only
        except OSError as e:
            logger.warning(f"Could not set directory permissions: {e}")
    
    def _derive_key(self, password: bytes, salt: bytes) -> bytes:
        """Derive encryption key from password using PBKDF2"""
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        return base64.urlsafe_b64encode(kdf.derive(password))
    
    def _get_encryption_key(self, user_id: str) -> bytes:
        """Get or generate encryption key for user"""
        # Get master key from environment first
        master_key = os.environ.get('FOSSAWORK_MASTER_KEY')
        if not master_key:
            raise ValueError(
                "FOSSAWORK_MASTER_KEY environment variable is not set. "
                "Please set a secure master key in your .env file. "
                "You can generate one using: python -c \"import secrets; print(secrets.token_urlsafe(32))\""
            )
        
        # Use user ID to derive a consistent key
        salt = hashlib.sha256(user_id.encode()).digest()[:16]
        password = master_key.encode()
        return self._derive_key(password, salt)
    
    def _encrypt_data(self, data: str, user_id: str) -> str:
        """Encrypt credential data using Fernet encryption"""
        try:
            key = self._get_encryption_key(user_id)
            fernet = Fernet(key)
            encrypted_data = fernet.encrypt(data.encode())
            return base64.urlsafe_b64encode(encrypted_data).decode()
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise ValueError(f"Failed to encrypt credential data: {str(e)}")
    
    def _decrypt_data(self, encrypted_data: str, user_id: str) -> str:
        """Decrypt credential data using Fernet decryption"""
        try:
            key = self._get_encryption_key(user_id)
            fernet = Fernet(key)
            encrypted_bytes = base64.urlsafe_b64decode(encrypted_data.encode())
            decrypted_data = fernet.decrypt(encrypted_bytes)
            return decrypted_data.decode()
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise ValueError(f"Failed to decrypt credential data: {str(e)}")
    
    def store_credentials(self, credentials: WorkFossaCredentials) -> bool:
        """
        Store credentials securely
        
        Args:
            credentials: WorkFossa credentials to store
            
        Returns:
            True if stored successfully
        """
        try:
            # Prepare data for encryption
            credential_data = {
                'username': credentials.username,
                'password': credentials.password,
                'created_at': credentials.created_at.isoformat(),
                'last_used': credentials.last_used.isoformat() if credentials.last_used else None,
                'is_valid': credentials.is_valid,
                'validation_attempts': credentials.validation_attempts
            }
            
            # Encrypt the credential data
            json_data = json.dumps(credential_data)
            encrypted_data = self._encrypt_data(json_data, credentials.user_id)
            
            # Store in secure file
            file_path = os.path.join(self.storage_path, f"{credentials.user_id}.cred")
            
            with open(file_path, 'w') as f:
                json.dump({
                    'user_id': credentials.user_id,
                    'encrypted_data': encrypted_data,
                    'created_at': datetime.now().isoformat(),
                    'encryption_version': '1.0'  # Track encryption version for future migrations
                }, f)
            
            # Set restrictive file permissions
            try:
                os.chmod(file_path, 0o600)  # Owner read/write only
            except OSError as e:
                logger.warning(f"Could not set file permissions: {e}")
            
            logger.info(f"Stored credentials for user {credentials.user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store credentials: {e}")
            return False
    
    def retrieve_credentials(self, user_id: str) -> Optional[WorkFossaCredentials]:
        """
        Retrieve credentials for user
        
        Args:
            user_id: User ID to retrieve credentials for
            
        Returns:
            WorkFossaCredentials if found, None otherwise
        """
        try:
            file_path = os.path.join(self.storage_path, f"{user_id}.cred")
            
            if not os.path.exists(file_path):
                logger.warning(f"No credentials found for user {user_id}")
                return None
            
            # Load encrypted data
            with open(file_path, 'r') as f:
                stored_data = json.load(f)
            
            encrypted_data = stored_data['encrypted_data']
            
            # Decrypt credential data
            json_data = self._decrypt_data(encrypted_data, user_id)
            credential_data = json.loads(json_data)
            
            # Create credentials object
            credentials = WorkFossaCredentials(
                username=credential_data['username'],
                password=credential_data['password'],
                user_id=user_id,
                created_at=datetime.fromisoformat(credential_data['created_at']),
                last_used=datetime.fromisoformat(credential_data['last_used']) if credential_data.get('last_used') else None,
                is_valid=credential_data.get('is_valid', False),
                validation_attempts=credential_data.get('validation_attempts', 0)
            )
            
            logger.info(f"Retrieved credentials for user {user_id}")
            return credentials
            
        except Exception as e:
            logger.error(f"Failed to retrieve credentials for user {user_id}: {e}")
            return None
    
    def validate_credentials(self, user_id: str) -> bool:
        """
        Check if stored credentials are valid
        
        Args:
            user_id: User ID to validate credentials for
            
        Returns:
            True if credentials are valid
        """
        credentials = self.retrieve_credentials(user_id)
        if not credentials:
            return False
        
        # Basic validation checks
        if not credentials.username or not credentials.password:
            return False
        
        # Check if credentials are not too old (30 days)
        if credentials.created_at < datetime.now() - timedelta(days=30):
            logger.warning(f"Credentials for user {user_id} are older than 30 days")
            return False
        
        return True
    
    def update_last_used(self, user_id: str) -> bool:
        """
        Update last used timestamp for credentials
        
        Args:
            user_id: User ID to update
            
        Returns:
            True if updated successfully
        """
        credentials = self.retrieve_credentials(user_id)
        if not credentials:
            return False
        
        credentials.last_used = datetime.now()
        return self.store_credentials(credentials)
    
    def delete_credentials(self, user_id: str) -> bool:
        """
        Delete stored credentials for user
        
        Args:
            user_id: User ID to delete credentials for
            
        Returns:
            True if deleted successfully
        """
        try:
            file_path = os.path.join(self.storage_path, f"{user_id}.cred")
            
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Deleted credentials for user {user_id}")
                return True
            else:
                logger.warning(f"No credentials found to delete for user {user_id}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to delete credentials for user {user_id}: {e}")
            return False
    
    def list_stored_users(self) -> list:
        """
        List users with stored credentials
        
        Returns:
            List of user IDs with stored credentials
        """
        try:
            if not os.path.exists(self.storage_path):
                return []
            
            users = []
            for filename in os.listdir(self.storage_path):
                if filename.endswith('.cred'):
                    user_id = filename[:-5]  # Remove .cred extension
                    users.append(user_id)
            
            return users
            
        except Exception as e:
            logger.error(f"Failed to list stored users: {e}")
            return []
    
    def get_security_info(self) -> Dict[str, Any]:
        """Get information about security configuration"""
        return {
            'encryption_enabled': True,
            'storage_path': self.storage_path,
            'encryption_method': 'Fernet (AES 128-bit)',
            'key_derivation': 'PBKDF2-HMAC-SHA256 (100,000 iterations)',
            'master_key_set': bool(os.environ.get('FOSSAWORK_MASTER_KEY')),
            'stored_users_count': len(self.list_stored_users())
        }

# Global credential manager instance
credential_manager = CredentialManager()

# Testing function
def test_credential_manager():
    """Test the credential manager"""
    print("[SYNC] Testing Credential Manager...")
    
    # Create test credentials
    test_creds = WorkFossaCredentials(
        username="test@example.com",
        password="test_password_123",
        user_id="test_user",
        is_valid=True
    )
    
    manager = CredentialManager()
    
    # Test storage
    stored = manager.store_credentials(test_creds)
    print(f"  [OK] Storage test: {stored}")
    
    # Test retrieval
    retrieved = manager.retrieve_credentials("test_user")
    retrieved_success = retrieved is not None and retrieved.username == test_creds.username
    print(f"  [OK] Retrieval test: {retrieved_success}")
    
    # Test validation
    is_valid = manager.validate_credentials("test_user")
    print(f"  [OK] Validation test: {is_valid}")
    
    # Test security info
    security_info = manager.get_security_info()
    print(f"  [OK] Security info: {security_info['encryption_method']}")
    
    # Test listing
    users = manager.list_stored_users()
    print(f"  [OK] User listing: {len(users)} users found")
    
    # Test deletion
    deleted = manager.delete_credentials("test_user")
    print(f"  [OK] Deletion test: {deleted}")
    
    print("[SUCCESS] Credential Manager tests completed!")
    return True

if __name__ == "__main__":
    test_credential_manager()