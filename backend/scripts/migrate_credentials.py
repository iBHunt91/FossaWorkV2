#!/usr/bin/env python3
"""
Migration script to convert database-stored credentials to secure file-based encryption
This ensures all credentials use the proper encryption service
"""

import os
import sys
import base64
import logging
from datetime import datetime

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import UserCredential
from app.services.credential_manager import credential_manager, WorkFossaCredentials

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def simple_decrypt(encrypted_password: str) -> str:
    """Decrypt base64 encoded passwords from legacy storage"""
    try:
        return base64.b64decode(encrypted_password.encode()).decode()
    except:
        return ""

def migrate_credentials():
    """Migrate all credentials from database to secure file storage"""
    
    # Check if master key is set
    if not os.environ.get('FOSSAWORK_MASTER_KEY'):
        logger.error("FOSSAWORK_MASTER_KEY environment variable not set!")
        logger.error("Please set it with: export FOSSAWORK_MASTER_KEY=$(python -c \"import secrets; print(secrets.token_urlsafe(32))\")")
        return False
    
    db = SessionLocal()
    migrated_count = 0
    error_count = 0
    
    try:
        # Get all WorkFossa credentials from database
        db_credentials = db.query(UserCredential).filter(
            UserCredential.service_name == "workfossa"
        ).all()
        
        logger.info(f"Found {len(db_credentials)} credentials to migrate")
        
        for db_cred in db_credentials:
            try:
                # Decrypt from database
                username = simple_decrypt(db_cred.encrypted_username)
                password = simple_decrypt(db_cred.encrypted_password)
                
                if not username or not password:
                    logger.warning(f"Skipping empty credentials for user {db_cred.user_id}")
                    continue
                
                # Check if already migrated
                existing = credential_manager.retrieve_credentials(db_cred.user_id)
                if existing:
                    logger.info(f"User {db_cred.user_id} already has secure credentials, skipping")
                    continue
                
                # Create secure credentials
                secure_creds = WorkFossaCredentials(
                    username=username,
                    password=password,
                    user_id=db_cred.user_id,
                    created_at=db_cred.created_at,
                    last_used=db_cred.updated_at,
                    is_valid=db_cred.is_active,
                    validation_attempts=0
                )
                
                # Store securely
                if credential_manager.store_credentials(secure_creds):
                    logger.info(f"✓ Migrated credentials for user {db_cred.user_id}")
                    migrated_count += 1
                    
                    # Delete from database after successful migration
                    db.delete(db_cred)
                else:
                    logger.error(f"✗ Failed to migrate credentials for user {db_cred.user_id}")
                    error_count += 1
                    
            except Exception as e:
                logger.error(f"Error migrating user {db_cred.user_id}: {str(e)}")
                error_count += 1
        
        # Commit database changes (deletions)
        db.commit()
        
        logger.info(f"\n=== Migration Complete ===")
        logger.info(f"✓ Successfully migrated: {migrated_count}")
        logger.info(f"✗ Errors: {error_count}")
        logger.info(f"Total users with secure credentials: {len(credential_manager.list_stored_users())}")
        
        # Show security info
        security_info = credential_manager.get_security_info()
        logger.info(f"\nSecurity Configuration:")
        logger.info(f"  Encryption: {security_info['encryption_method']}")
        logger.info(f"  Key Derivation: {security_info['key_derivation']}")
        logger.info(f"  Storage Path: {security_info['storage_path']}")
        
        return error_count == 0
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()

def verify_migration():
    """Verify that no credentials remain in database"""
    db = SessionLocal()
    
    try:
        remaining = db.query(UserCredential).filter(
            UserCredential.service_name == "workfossa"
        ).count()
        
        if remaining > 0:
            logger.warning(f"⚠️  {remaining} credentials still in database!")
            return False
        else:
            logger.info("✓ All credentials successfully migrated from database")
            return True
            
    finally:
        db.close()

if __name__ == "__main__":
    print("=== WorkFossa Credential Migration ===")
    print("This will migrate all credentials from database to secure file storage")
    print()
    
    # Check for master key
    if not os.environ.get('FOSSAWORK_MASTER_KEY'):
        print("ERROR: FOSSAWORK_MASTER_KEY not set!")
        print("Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
        print("Then set it: export FOSSAWORK_MASTER_KEY=<generated-key>")
        sys.exit(1)
    
    response = input("Continue with migration? [y/N]: ")
    if response.lower() != 'y':
        print("Migration cancelled")
        sys.exit(0)
    
    print()
    success = migrate_credentials()
    
    if success:
        print("\n✓ Migration completed successfully!")
        verify_migration()
    else:
        print("\n✗ Migration completed with errors")
        sys.exit(1)