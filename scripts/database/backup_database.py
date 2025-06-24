#!/usr/bin/env python3
"""
Database Backup Script

Creates timestamped backups of the FossaWork V2 database with compression
and retention management.
"""

import os
import sys
import shutil
import gzip
import json
import logging
from datetime import datetime, timedelta
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


class DatabaseBackup:
    """Handles database backup operations"""
    
    def __init__(self, database_path: str, backup_dir: str = None):
        """
        Initialize backup handler
        
        Args:
            database_path: Path to database file
            backup_dir: Directory for backups (default: ./backups)
        """
        self.database_path = Path(database_path)
        self.backup_dir = Path(backup_dir or "./backups")
        self.backup_dir.mkdir(exist_ok=True)
        
        # Create subdirectories
        self.daily_dir = self.backup_dir / "daily"
        self.weekly_dir = self.backup_dir / "weekly"
        self.monthly_dir = self.backup_dir / "monthly"
        
        for dir in [self.daily_dir, self.weekly_dir, self.monthly_dir]:
            dir.mkdir(exist_ok=True)
    
    def backup_sqlite(self, compress: bool = True) -> Optional[Path]:
        """
        Create SQLite database backup
        
        Args:
            compress: Whether to compress the backup
            
        Returns:
            Path to backup file if successful
        """
        if not self.database_path.exists():
            logger.error(f"Database not found: {self.database_path}")
            return None
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"fossawork_backup_{timestamp}.db"
        backup_path = self.daily_dir / backup_name
        
        try:
            # Use SQLite backup API for consistency
            source = sqlite3.connect(str(self.database_path))
            dest = sqlite3.connect(str(backup_path))
            
            with dest:
                source.backup(dest)
            
            source.close()
            dest.close()
            
            logger.info(f"Database backed up to: {backup_path}")
            
            # Compress if requested
            if compress:
                compressed_path = self._compress_backup(backup_path)
                return compressed_path
            
            return backup_path
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            if backup_path.exists():
                backup_path.unlink()
            return None
    
    def backup_postgresql(self, connection_string: str, compress: bool = True) -> Optional[Path]:
        """
        Create PostgreSQL database backup using pg_dump
        
        Args:
            connection_string: PostgreSQL connection string
            compress: Whether to compress the backup
            
        Returns:
            Path to backup file if successful
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"fossawork_backup_{timestamp}.sql"
        backup_path = self.daily_dir / backup_name
        
        try:
            # Use pg_dump for PostgreSQL
            cmd = [
                "pg_dump",
                connection_string,
                "-f", str(backup_path),
                "--verbose",
                "--no-owner",
                "--no-privileges"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode != 0:
                logger.error(f"pg_dump failed: {result.stderr}")
                return None
            
            logger.info(f"Database backed up to: {backup_path}")
            
            # Compress if requested
            if compress:
                compressed_path = self._compress_backup(backup_path)
                return compressed_path
            
            return backup_path
            
        except FileNotFoundError:
            logger.error("pg_dump not found. Please install PostgreSQL client tools.")
            return None
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            if backup_path.exists():
                backup_path.unlink()
            return None
    
    def _compress_backup(self, backup_path: Path) -> Path:
        """Compress backup file using gzip"""
        compressed_path = backup_path.with_suffix('.gz')
        
        try:
            with open(backup_path, 'rb') as f_in:
                with gzip.open(compressed_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            
            # Remove uncompressed file
            backup_path.unlink()
            
            # Calculate compression ratio
            compressed_size = compressed_path.stat().st_size
            original_size = backup_path.stat().st_size if backup_path.exists() else compressed_size
            ratio = (1 - compressed_size / original_size) * 100 if original_size > 0 else 0
            
            logger.info(f"Compressed backup ({ratio:.1f}% reduction): {compressed_path}")
            return compressed_path
            
        except Exception as e:
            logger.error(f"Compression failed: {e}")
            return backup_path
    
    def promote_to_weekly(self, backup_path: Path) -> Optional[Path]:
        """Promote a daily backup to weekly"""
        if not backup_path.exists():
            return None
        
        weekly_path = self.weekly_dir / backup_path.name
        shutil.copy2(backup_path, weekly_path)
        logger.info(f"Promoted to weekly: {weekly_path}")
        return weekly_path
    
    def promote_to_monthly(self, backup_path: Path) -> Optional[Path]:
        """Promote a backup to monthly"""
        if not backup_path.exists():
            return None
        
        monthly_path = self.monthly_dir / backup_path.name
        shutil.copy2(backup_path, monthly_path)
        logger.info(f"Promoted to monthly: {monthly_path}")
        return monthly_path
    
    def cleanup_old_backups(self, 
                          daily_retention: int = 7,
                          weekly_retention: int = 4,
                          monthly_retention: int = 12):
        """
        Remove old backups based on retention policy
        
        Args:
            daily_retention: Days to keep daily backups
            weekly_retention: Weeks to keep weekly backups
            monthly_retention: Months to keep monthly backups
        """
        now = datetime.now()
        
        # Clean daily backups
        daily_cutoff = now - timedelta(days=daily_retention)
        self._cleanup_directory(self.daily_dir, daily_cutoff)
        
        # Clean weekly backups
        weekly_cutoff = now - timedelta(weeks=weekly_retention)
        self._cleanup_directory(self.weekly_dir, weekly_cutoff)
        
        # Clean monthly backups
        monthly_cutoff = now - timedelta(days=monthly_retention * 30)
        self._cleanup_directory(self.monthly_dir, monthly_cutoff)
    
    def _cleanup_directory(self, directory: Path, cutoff_date: datetime):
        """Remove files older than cutoff date"""
        for file in directory.iterdir():
            if file.is_file():
                file_time = datetime.fromtimestamp(file.stat().st_mtime)
                if file_time < cutoff_date:
                    file.unlink()
                    logger.info(f"Removed old backup: {file}")
    
    def list_backups(self) -> Dict[str, list]:
        """List all available backups"""
        backups = {
            'daily': [],
            'weekly': [],
            'monthly': []
        }
        
        for category, directory in [
            ('daily', self.daily_dir),
            ('weekly', self.weekly_dir),
            ('monthly', self.monthly_dir)
        ]:
            for file in sorted(directory.iterdir(), reverse=True):
                if file.is_file():
                    backups[category].append({
                        'name': file.name,
                        'size': file.stat().st_size,
                        'created': datetime.fromtimestamp(file.stat().st_mtime).isoformat(),
                        'path': str(file)
                    })
        
        return backups
    
    def verify_backup(self, backup_path: Path) -> bool:
        """Verify backup integrity"""
        if not backup_path.exists():
            logger.error(f"Backup not found: {backup_path}")
            return False
        
        try:
            # For compressed files, try to decompress
            if backup_path.suffix == '.gz':
                with gzip.open(backup_path, 'rb') as f:
                    # Read first few bytes to verify
                    data = f.read(1024)
                    if not data:
                        logger.error("Backup file is empty")
                        return False
            
            # For SQLite backups, try to open
            elif backup_path.suffix == '.db':
                conn = sqlite3.connect(str(backup_path))
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = cursor.fetchall()
                conn.close()
                
                if not tables:
                    logger.error("No tables found in backup")
                    return False
            
            logger.info(f"Backup verified: {backup_path}")
            return True
            
        except Exception as e:
            logger.error(f"Backup verification failed: {e}")
            return False
    
    def create_metadata(self, backup_path: Path, additional_info: Dict[str, Any] = None):
        """Create metadata file for backup"""
        metadata = {
            'backup_file': backup_path.name,
            'created_at': datetime.now().isoformat(),
            'database_path': str(self.database_path),
            'file_size': backup_path.stat().st_size,
            'compressed': backup_path.suffix == '.gz',
            'verified': self.verify_backup(backup_path)
        }
        
        if additional_info:
            metadata.update(additional_info)
        
        metadata_path = backup_path.with_suffix('.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Metadata created: {metadata_path}")


def main():
    """Command-line interface"""
    parser = argparse.ArgumentParser(description="FossaWork V2 Database Backup")
    parser.add_argument('--database', default='./fossawork_v2.db',
                       help='Path to database file')
    parser.add_argument('--backup-dir', default='./backups',
                       help='Directory for backups')
    parser.add_argument('--no-compress', action='store_true',
                       help='Skip compression')
    parser.add_argument('--promote-weekly', action='store_true',
                       help='Promote latest daily to weekly')
    parser.add_argument('--promote-monthly', action='store_true',
                       help='Promote latest weekly to monthly')
    parser.add_argument('--cleanup', action='store_true',
                       help='Clean old backups')
    parser.add_argument('--list', action='store_true',
                       help='List all backups')
    parser.add_argument('--verify', help='Verify specific backup')
    
    args = parser.parse_args()
    
    # Create backup handler
    backup = DatabaseBackup(args.database, args.backup_dir)
    
    if args.list:
        # List backups
        backups = backup.list_backups()
        for category, files in backups.items():
            print(f"\n{category.upper()} BACKUPS:")
            for file in files:
                size_mb = file['size'] / (1024 * 1024)
                print(f"  - {file['name']} ({size_mb:.1f} MB) - {file['created']}")
    
    elif args.verify:
        # Verify backup
        if backup.verify_backup(Path(args.verify)):
            print("Backup is valid")
        else:
            print("Backup verification failed")
            sys.exit(1)
    
    elif args.cleanup:
        # Clean old backups
        backup.cleanup_old_backups()
        print("Cleanup completed")
    
    else:
        # Create backup
        if "postgresql" in args.database:
            backup_path = backup.backup_postgresql(
                args.database,
                compress=not args.no_compress
            )
        else:
            backup_path = backup.backup_sqlite(
                compress=not args.no_compress
            )
        
        if backup_path:
            # Create metadata
            backup.create_metadata(backup_path)
            
            # Handle promotions
            if args.promote_weekly:
                backup.promote_to_weekly(backup_path)
            elif args.promote_monthly:
                backup.promote_to_monthly(backup_path)
            
            print(f"Backup successful: {backup_path}")
        else:
            print("Backup failed")
            sys.exit(1)


if __name__ == '__main__':
    main()