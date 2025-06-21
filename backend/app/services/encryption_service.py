#!/usr/bin/env python3
"""
Encryption Service for Secure Credential Storage
Provides AES encryption for sensitive data like passwords
"""

import os
import base64
from typing import Optional
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from .logging_service import get_logger

logger = get_logger("fossawork.encryption")


class EncryptionService:
    """Service for encrypting and decrypting sensitive data"""
    
    def __init__(self):
        self._fernet: Optional[Fernet] = None
        self._initialize_encryption()
    
    def _initialize_encryption(self):
        """Initialize encryption with a key derived from environment variables"""
        try:
            # Get encryption password from environment
            encryption_password = os.getenv("ENCRYPTION_PASSWORD")
            if not encryption_password:
                # Generate a secure default but warn about it
                encryption_password = os.getenv("SECRET_KEY", "default-encryption-key-change-me")
                logger.warning("ENCRYPTION_PASSWORD not set, using SECRET_KEY as fallback")
            
            # Create a salt - in production, this should be stored securely
            # For now, we'll derive it deterministically from the key
            salt = os.getenv("ENCRYPTION_SALT", "fossawork-salt-v1").encode()[:16].ljust(16, b'0')
            
            # Derive encryption key using PBKDF2
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(encryption_password.encode()))
            
            # Initialize Fernet cipher
            self._fernet = Fernet(key)
            logger.info("Encryption service initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize encryption service: {e}")
            raise RuntimeError(f"Encryption initialization failed: {e}")
    
    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt a plaintext string
        
        Args:
            plaintext: The string to encrypt
            
        Returns:
            Base64-encoded encrypted string
            
        Raises:
            RuntimeError: If encryption fails
        """
        if not self._fernet:
            raise RuntimeError("Encryption service not initialized")
        
        if not plaintext:
            return ""
        
        try:
            # Convert string to bytes and encrypt
            plaintext_bytes = plaintext.encode('utf-8')
            encrypted_bytes = self._fernet.encrypt(plaintext_bytes)
            
            # Return base64-encoded string for database storage
            return base64.b64encode(encrypted_bytes).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise RuntimeError(f"Failed to encrypt data: {e}")
    
    def decrypt(self, encrypted_data: str) -> str:
        """
        Decrypt an encrypted string
        
        Args:
            encrypted_data: Base64-encoded encrypted string
            
        Returns:
            Decrypted plaintext string
            
        Raises:
            RuntimeError: If decryption fails
        """
        if not self._fernet:
            raise RuntimeError("Encryption service not initialized")
        
        if not encrypted_data:
            return ""
        
        try:
            # Handle both encrypted and legacy plain text data
            if self._is_likely_encrypted(encrypted_data):
                # Decode base64 and decrypt
                encrypted_bytes = base64.b64decode(encrypted_data.encode('utf-8'))
                decrypted_bytes = self._fernet.decrypt(encrypted_bytes)
                return decrypted_bytes.decode('utf-8')
            else:
                # Legacy plain text data - log a warning and return as-is
                logger.warning("Attempting to decrypt plain text data - this should be migrated")
                return encrypted_data
                
        except Exception as e:
            # If decryption fails, it might be legacy plain text
            logger.warning(f"Decryption failed, treating as plain text: {e}")
            return encrypted_data
    
    def _is_likely_encrypted(self, data: str) -> bool:
        """
        Heuristic to determine if data is encrypted or plain text
        
        Args:
            data: The data to check
            
        Returns:
            True if data appears to be encrypted
        """
        try:
            # Encrypted data should be base64 encoded and much longer than typical passwords
            # Also check if it contains typical email patterns (plain text)
            if '@' in data and '.' in data:
                return False  # Likely an email address (plain text)
            
            # Try to decode as base64 - encrypted data should be valid base64
            base64.b64decode(data.encode('utf-8'))
            
            # If it's much longer than typical passwords, likely encrypted
            return len(data) > 50
            
        except Exception:
            return False  # Not valid base64, so not encrypted
    
    def migrate_plain_text_password(self, plain_text: str) -> str:
        """
        Migrate a plain text password to encrypted format
        
        Args:
            plain_text: The plain text password
            
        Returns:
            Encrypted password
        """
        if self._is_likely_encrypted(plain_text):
            logger.info("Password already appears to be encrypted")
            return plain_text
        
        logger.info("Migrating plain text password to encrypted format")
        return self.encrypt(plain_text)


# Global encryption service instance
_encryption_service: Optional[EncryptionService] = None


def get_encryption_service() -> EncryptionService:
    """Get the global encryption service instance"""
    global _encryption_service
    if _encryption_service is None:
        _encryption_service = EncryptionService()
    return _encryption_service


def encrypt_string(plaintext: str) -> str:
    """Convenience function to encrypt a string"""
    return get_encryption_service().encrypt(plaintext)


def decrypt_string(encrypted_data: str) -> str:
    """Convenience function to decrypt a string"""
    return get_encryption_service().decrypt(encrypted_data)


def migrate_plain_text_password(plain_text: str) -> str:
    """Convenience function to migrate plain text password"""
    return get_encryption_service().migrate_plain_text_password(plain_text)