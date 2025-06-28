#!/usr/bin/env python3
"""
Migration Script: Encrypt Existing Plain Text Credentials
This script migrates existing plain text credentials to encrypted format
"""

import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.database import SessionLocal
from app.models.user_models import UserCredential
from app.services.logging_service import get_logger

logger = get_logger("migration.credentials")


def migrate_credentials():
    """Migrate all plain text credentials to encrypted format"""
    logger.info("Starting credential encryption migration...")
    
    db = SessionLocal()
    try:
        # Get all credentials
        credentials = db.query(UserCredential).all()
        logger.info(f"Found {len(credentials)} credential records to check")
        
        migrated_count = 0
        error_count = 0
        
        for credential in credentials:
            try:
                # Attempt to migrate this credential
                if credential.migrate_to_encrypted():
                    migrated_count += 1
                    logger.info(f"Migrated credentials for user {credential.user_id}, service {credential.service_name}")
                else:
                    logger.debug(f"Credentials for user {credential.user_id}, service {credential.service_name} already encrypted")
                
            except Exception as e:
                error_count += 1
                logger.error(f"Failed to migrate credentials for user {credential.user_id}, service {credential.service_name}: {e}")
        
        # Commit all changes
        if migrated_count > 0:
            db.commit()
            logger.info(f"Successfully migrated {migrated_count} credential records")
        else:
            logger.info("No credentials needed migration - all were already encrypted")
        
        if error_count > 0:
            logger.warning(f"Encountered {error_count} errors during migration")
        
        return migrated_count, error_count
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        db.rollback()
        raise
    
    finally:
        db.close()


def verify_migration():
    """Verify that all credentials can be decrypted properly"""
    logger.info("Verifying credential migration...")
    
    db = SessionLocal()
    try:
        credentials = db.query(UserCredential).all()
        logger.info(f"Verifying {len(credentials)} credential records")
        
        verification_errors = 0
        
        for credential in credentials:
            try:
                # Try to decrypt both username and password
                username = credential.username
                password = credential.password
                
                if not username or not password:
                    verification_errors += 1
                    logger.error(f"Empty credentials after decryption for user {credential.user_id}")
                else:
                    logger.debug(f"Successfully verified credentials for user {credential.user_id}")
                
            except Exception as e:
                verification_errors += 1
                logger.error(f"Failed to decrypt credentials for user {credential.user_id}: {e}")
        
        if verification_errors == 0:
            logger.info("✅ All credentials verified successfully")
        else:
            logger.error(f"❌ {verification_errors} credentials failed verification")
        
        return verification_errors == 0
        
    finally:
        db.close()


def main():
    """Main migration function"""
    print("🔐 FossaWork V2 Credential Encryption Migration")
    print("=" * 50)
    
    try:
        # Run migration
        migrated, errors = migrate_credentials()
        
        print(f"\n📊 Migration Results:")
        print(f"   Migrated: {migrated} records")
        print(f"   Errors: {errors} records")
        
        # Verify migration
        print(f"\n🔍 Verifying migration...")
        if verify_migration():
            print("✅ Migration completed successfully!")
            return 0
        else:
            print("❌ Migration verification failed!")
            return 1
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        print(f"❌ Migration failed: {e}")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)