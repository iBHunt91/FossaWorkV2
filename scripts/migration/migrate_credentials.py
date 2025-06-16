#!/usr/bin/env python3
"""
Migration script for credentials that may have been stored with base64 encoding.
This script safely migrates old credentials to proper encryption.
"""

import os
import sys
import json
import base64
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

from app.services.credential_manager import WorkFossaCredentials, CredentialManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CredentialMigrator:
    """Handles migration of credentials from base64 to proper encryption"""
    
    def __init__(self, storage_path: str = None):
        self.credential_manager = CredentialManager(storage_path)
        self.storage_path = self.credential_manager.storage_path
        
    def check_credential_file(self, file_path: str) -> Dict[str, Any]:
        """Check if a credential file needs migration"""
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            # Check for old format indicators
            needs_migration = False
            reason = ""
            
            # Check if it has the old crypto_available flag
            if 'crypto_available' in data:
                needs_migration = True
                reason = "Has legacy crypto_available flag"
                if not data.get('crypto_available', True):
                    reason = "Was stored with base64 encoding"
            
            # Check if it's missing encryption_version
            if 'encryption_version' not in data:
                needs_migration = True
                reason = "Missing encryption version"
            
            return {
                'file': file_path,
                'user_id': data.get('user_id'),
                'needs_migration': needs_migration,
                'reason': reason,
                'created_at': data.get('created_at')
            }
            
        except Exception as e:
            logger.error(f"Error checking file {file_path}: {e}")
            return {
                'file': file_path,
                'needs_migration': False,
                'reason': f"Error: {str(e)}"
            }
    
    def scan_for_migration(self) -> List[Dict[str, Any]]:
        """Scan all credential files to check if migration is needed"""
        results = []
        
        if not os.path.exists(self.storage_path):
            logger.info("No credential storage directory found")
            return results
        
        for filename in os.listdir(self.storage_path):
            if filename.endswith('.cred'):
                file_path = os.path.join(self.storage_path, filename)
                check_result = self.check_credential_file(file_path)
                results.append(check_result)
        
        return results
    
    def migrate_credential(self, file_path: str, force: bool = False) -> bool:
        """
        Migrate a single credential file
        
        Args:
            file_path: Path to credential file
            force: Force migration even if it appears encrypted
            
        Returns:
            True if migration successful
        """
        try:
            # Read the old file
            with open(file_path, 'r') as f:
                old_data = json.load(f)
            
            user_id = old_data.get('user_id')
            encrypted_data = old_data.get('encrypted_data')
            
            if not user_id or not encrypted_data:
                logger.error(f"Invalid credential file format: {file_path}")
                return False
            
            # Check if we need to try base64 decoding
            was_base64 = old_data.get('crypto_available') is False
            
            if was_base64 or force:
                try:
                    # Try to decode from base64
                    decrypted_json = base64.urlsafe_b64decode(encrypted_data.encode()).decode()
                    credential_data = json.loads(decrypted_json)
                    
                    # Create new credentials object
                    credentials = WorkFossaCredentials(
                        username=credential_data['username'],
                        password=credential_data['password'],
                        user_id=user_id,
                        created_at=datetime.fromisoformat(credential_data['created_at']),
                        last_used=datetime.fromisoformat(credential_data['last_used']) if credential_data.get('last_used') else None,
                        is_valid=credential_data.get('is_valid', False),
                        validation_attempts=credential_data.get('validation_attempts', 0)
                    )
                    
                    # Backup old file
                    backup_path = f"{file_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                    os.rename(file_path, backup_path)
                    logger.info(f"Backed up old credential file to: {backup_path}")
                    
                    # Store with proper encryption
                    if self.credential_manager.store_credentials(credentials):
                        logger.info(f"Successfully migrated credentials for user: {user_id}")
                        return True
                    else:
                        # Restore backup
                        os.rename(backup_path, file_path)
                        logger.error(f"Failed to store migrated credentials for user: {user_id}")
                        return False
                        
                except Exception as e:
                    logger.error(f"Failed to decode base64 credentials: {e}")
                    return False
            else:
                logger.info(f"Credential file appears to be properly encrypted: {file_path}")
                
                # Just update the format to include encryption_version
                if 'encryption_version' not in old_data:
                    old_data['encryption_version'] = '1.0'
                    del old_data['crypto_available']  # Remove old flag
                    
                    # Write updated metadata
                    with open(file_path, 'w') as f:
                        json.dump(old_data, f)
                    
                    logger.info(f"Updated credential file metadata for user: {user_id}")
                
                return True
                
        except Exception as e:
            logger.error(f"Migration failed for {file_path}: {e}")
            return False
    
    def migrate_all(self, dry_run: bool = True) -> Dict[str, Any]:
        """
        Migrate all credentials that need migration
        
        Args:
            dry_run: If True, only scan and report, don't actually migrate
            
        Returns:
            Migration results
        """
        results = {
            'scanned': 0,
            'needs_migration': 0,
            'migrated': 0,
            'failed': 0,
            'details': []
        }
        
        # Scan for files needing migration
        scan_results = self.scan_for_migration()
        results['scanned'] = len(scan_results)
        
        files_to_migrate = [r for r in scan_results if r['needs_migration']]
        results['needs_migration'] = len(files_to_migrate)
        
        if dry_run:
            logger.info("DRY RUN - No files will be modified")
            results['details'] = scan_results
            return results
        
        # Perform migration
        for file_info in files_to_migrate:
            file_path = file_info['file']
            logger.info(f"Migrating: {file_path} - Reason: {file_info['reason']}")
            
            if self.migrate_credential(file_path):
                results['migrated'] += 1
                file_info['migration_status'] = 'success'
            else:
                results['failed'] += 1
                file_info['migration_status'] = 'failed'
        
        results['details'] = scan_results
        return results


def main():
    """Run credential migration"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrate credentials to secure encryption')
    parser.add_argument('--dry-run', action='store_true', help='Only scan, do not migrate')
    parser.add_argument('--storage-path', help='Custom storage path for credentials')
    args = parser.parse_args()
    
    print("=" * 60)
    print("CREDENTIAL MIGRATION TOOL")
    print("=" * 60)
    print()
    
    # Check if master key is set
    if not os.environ.get('FOSSAWORK_MASTER_KEY'):
        print("ERROR: FOSSAWORK_MASTER_KEY environment variable is not set!")
        print("Please set it in your .env file before running migration.")
        print("Generate a key with: python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
        return
    
    migrator = CredentialMigrator(args.storage_path)
    
    print(f"Scanning credential files in: {migrator.storage_path}")
    print()
    
    results = migrator.migrate_all(dry_run=args.dry_run)
    
    print(f"Files scanned: {results['scanned']}")
    print(f"Files needing migration: {results['needs_migration']}")
    
    if not args.dry_run:
        print(f"Files migrated: {results['migrated']}")
        print(f"Files failed: {results['failed']}")
    
    print()
    print("DETAILS:")
    print("-" * 60)
    
    for detail in results['details']:
        status = ""
        if detail['needs_migration']:
            status = f" - {detail['reason']}"
            if 'migration_status' in detail:
                status += f" [{detail['migration_status'].upper()}]"
        else:
            status = " - OK"
        
        print(f"{detail.get('user_id', 'Unknown')}: {os.path.basename(detail['file'])}{status}")
    
    print()
    print("=" * 60)
    
    if args.dry_run and results['needs_migration'] > 0:
        print(f"Run without --dry-run to migrate {results['needs_migration']} file(s)")


if __name__ == "__main__":
    main()