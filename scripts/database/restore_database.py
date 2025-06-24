#!/usr/bin/env python3
"""
Database Restore Script

Restores FossaWork V2 database from backup files with validation
and safety checks.
"""

import os
import sys
import shutil
import gzip
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
import argparse
import sqlite3
import subprocess

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DatabaseRestore:
    """Handles database restore operations"""
    
    def __init__(self, database_path: str, backup_dir: str = None):
        """
        Initialize restore handler
        
        Args:
            database_path: Path to target database file
            backup_dir: Directory containing backups
        """
        self.database_path = Path(database_path)
        self.backup_dir = Path(backup_dir or "./backups")
        
        # Safety backup directory
        self.safety_dir = self.backup_dir / "pre-restore-safety"
        self.safety_dir.mkdir(exist_ok=True)
    
    def create_safety_backup(self) -> Optional[Path]:
        """Create safety backup before restore"""
        if not self.database_path.exists():
            logger.warning("No existing database to backup")
            return None
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safety_name = f"pre_restore_safety_{timestamp}.db"
        safety_path = self.safety_dir / safety_name
        
        try:
            shutil.copy2(self.database_path, safety_path)
            logger.info(f"Safety backup created: {safety_path}")
            return safety_path
        except Exception as e:
            logger.error(f"Failed to create safety backup: {e}")
            return None
    
    def decompress_backup(self, backup_path: Path) -> Optional[Path]:
        """Decompress backup file if needed"""
        if backup_path.suffix != '.gz':
            return backup_path
        
        decompressed_path = backup_path.with_suffix('')
        
        try:
            with gzip.open(backup_path, 'rb') as f_in:
                with open(decompressed_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            
            logger.info(f"Decompressed backup to: {decompressed_path}")
            return decompressed_path
            
        except Exception as e:
            logger.error(f"Decompression failed: {e}")
            return None
    
    def validate_backup_schema(self, backup_path: Path) -> bool:
        """Validate backup has expected schema"""
        try:
            conn = sqlite3.connect(str(backup_path))
            cursor = conn.cursor()
            
            # Check for essential tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            required_tables = ['users', 'work_orders', 'dispensers']
            missing_tables = [t for t in required_tables if t not in tables]
            
            if missing_tables:
                logger.error(f"Missing required tables: {missing_tables}")
                conn.close()
                return False
            
            # Check table structure for critical tables
            for table in required_tables:
                cursor.execute(f"PRAGMA table_info({table})")
                columns = cursor.fetchall()
                if not columns:
                    logger.error(f"Table {table} has no columns")
                    conn.close()
                    return False
            
            conn.close()
            logger.info("Backup schema validation passed")
            return True
            
        except Exception as e:
            logger.error(f"Schema validation failed: {e}")
            return False
    
    def restore_sqlite(self, backup_path: Path, validate: bool = True) -> bool:
        """
        Restore SQLite database from backup
        
        Args:
            backup_path: Path to backup file
            validate: Whether to validate backup before restore
            
        Returns:
            True if successful
        """
        # Decompress if needed
        working_backup = self.decompress_backup(backup_path)
        if not working_backup:
            return False
        
        # Validate backup
        if validate and not self.validate_backup_schema(working_backup):
            logger.error("Backup validation failed, aborting restore")
            if working_backup != backup_path:
                working_backup.unlink()
            return False
        
        # Create safety backup
        safety_backup = self.create_safety_backup()
        
        try:
            # Perform restore
            if self.database_path.exists():
                self.database_path.unlink()
            
            shutil.copy2(working_backup, self.database_path)
            
            # Verify restored database
            conn = sqlite3.connect(str(self.database_path))
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")
            table_count = cursor.fetchone()[0]
            conn.close()
            
            logger.info(f"Database restored successfully with {table_count} tables")
            
            # Clean up temporary file
            if working_backup != backup_path:
                working_backup.unlink()
            
            return True
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            
            # Attempt to restore safety backup
            if safety_backup and safety_backup.exists():
                try:
                    shutil.copy2(safety_backup, self.database_path)
                    logger.info("Restored from safety backup due to failure")
                except Exception as safety_error:
                    logger.error(f"Failed to restore safety backup: {safety_error}")
            
            return False
    
    def restore_postgresql(self, backup_path: Path, connection_string: str) -> bool:
        """
        Restore PostgreSQL database from backup
        
        Args:
            backup_path: Path to backup file
            connection_string: PostgreSQL connection string
            
        Returns:
            True if successful
        """
        # Decompress if needed
        working_backup = self.decompress_backup(backup_path)
        if not working_backup:
            return False
        
        try:
            # Use psql to restore
            cmd = [
                "psql",
                connection_string,
                "-f", str(working_backup),
                "--single-transaction",
                "--set", "ON_ERROR_STOP=on"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                logger.error(f"psql restore failed: {result.stderr}")
                return False
            
            logger.info("PostgreSQL database restored successfully")
            
            # Clean up temporary file
            if working_backup != backup_path:
                working_backup.unlink()
            
            return True
            
        except FileNotFoundError:
            logger.error("psql not found. Please install PostgreSQL client tools.")
            return False
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False
    
    def find_latest_backup(self, category: str = 'daily') -> Optional[Path]:
        """Find the most recent backup in a category"""
        category_dir = self.backup_dir / category
        if not category_dir.exists():
            return None
        
        backups = list(category_dir.glob("fossawork_backup_*.db*"))
        if not backups:
            return None
        
        # Sort by modification time
        backups.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return backups[0]
    
    def read_metadata(self, backup_path: Path) -> Optional[Dict[str, Any]]:
        """Read backup metadata if available"""
        metadata_path = backup_path.with_suffix('.json')
        if not metadata_path.exists():
            # Try without .gz extension
            if backup_path.suffix == '.gz':
                metadata_path = backup_path.with_suffix('').with_suffix('.json')
        
        if metadata_path.exists():
            try:
                with open(metadata_path, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to read metadata: {e}")
        
        return None
    
    def interactive_restore(self) -> bool:
        """Interactive restore with user confirmation"""
        # List available backups
        categories = ['daily', 'weekly', 'monthly']
        all_backups = []
        
        for category in categories:
            category_dir = self.backup_dir / category
            if category_dir.exists():
                for backup in category_dir.glob("fossawork_backup_*.db*"):
                    metadata = self.read_metadata(backup)
                    all_backups.append({
                        'path': backup,
                        'category': category,
                        'size': backup.stat().st_size,
                        'modified': datetime.fromtimestamp(backup.stat().st_mtime),
                        'metadata': metadata
                    })
        
        if not all_backups:
            logger.error("No backups found")
            return False
        
        # Sort by date
        all_backups.sort(key=lambda b: b['modified'], reverse=True)
        
        # Display options
        print("\nAvailable backups:")
        for i, backup in enumerate(all_backups):
            size_mb = backup['size'] / (1024 * 1024)
            verified = backup['metadata'].get('verified', 'Unknown') if backup['metadata'] else 'Unknown'
            print(f"{i+1}. [{backup['category'].upper()}] {backup['path'].name}")
            print(f"   Size: {size_mb:.1f} MB | Date: {backup['modified'].strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"   Verified: {verified}")
        
        # Get user choice
        try:
            choice = int(input("\nSelect backup to restore (number): ")) - 1
            if 0 <= choice < len(all_backups):
                selected = all_backups[choice]
                
                # Confirm
                print(f"\nWill restore from: {selected['path'].name}")
                confirm = input("Continue? (yes/no): ").lower()
                
                if confirm == 'yes':
                    return self.restore_sqlite(selected['path'])
                else:
                    print("Restore cancelled")
                    return False
            else:
                print("Invalid selection")
                return False
                
        except (ValueError, KeyboardInterrupt):
            print("\nRestore cancelled")
            return False


def main():
    """Command-line interface"""
    parser = argparse.ArgumentParser(description="FossaWork V2 Database Restore")
    parser.add_argument('--database', default='./fossawork_v2.db',
                       help='Path to target database file')
    parser.add_argument('--backup-dir', default='./backups',
                       help='Directory containing backups')
    parser.add_argument('--backup-file', help='Specific backup file to restore')
    parser.add_argument('--latest', action='store_true',
                       help='Restore from latest backup')
    parser.add_argument('--category', default='daily',
                       choices=['daily', 'weekly', 'monthly'],
                       help='Backup category for --latest')
    parser.add_argument('--no-validate', action='store_true',
                       help='Skip backup validation')
    parser.add_argument('--interactive', action='store_true',
                       help='Interactive restore with selection')
    parser.add_argument('--force', action='store_true',
                       help='Force restore without confirmation')
    
    args = parser.parse_args()
    
    # Create restore handler
    restore = DatabaseRestore(args.database, args.backup_dir)
    
    if args.interactive:
        # Interactive mode
        if restore.interactive_restore():
            print("Restore completed successfully")
        else:
            print("Restore failed")
            sys.exit(1)
    
    elif args.backup_file:
        # Restore specific file
        backup_path = Path(args.backup_file)
        if not backup_path.exists():
            print(f"Backup file not found: {backup_path}")
            sys.exit(1)
        
        if not args.force:
            print(f"Will restore from: {backup_path}")
            confirm = input("Continue? (yes/no): ").lower()
            if confirm != 'yes':
                print("Restore cancelled")
                sys.exit(0)
        
        if "postgresql" in args.database:
            success = restore.restore_postgresql(backup_path, args.database)
        else:
            success = restore.restore_sqlite(backup_path, validate=not args.no_validate)
        
        if success:
            print("Restore completed successfully")
        else:
            print("Restore failed")
            sys.exit(1)
    
    elif args.latest:
        # Restore from latest
        backup_path = restore.find_latest_backup(args.category)
        if not backup_path:
            print(f"No backups found in {args.category} category")
            sys.exit(1)
        
        if not args.force:
            print(f"Will restore from latest {args.category} backup: {backup_path.name}")
            confirm = input("Continue? (yes/no): ").lower()
            if confirm != 'yes':
                print("Restore cancelled")
                sys.exit(0)
        
        if restore.restore_sqlite(backup_path, validate=not args.no_validate):
            print("Restore completed successfully")
        else:
            print("Restore failed")
            sys.exit(1)
    
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()