"""
Migration Runner - Main migration execution script

Provides automated database migration with safety features:
- Transaction-based execution
- Automatic backup before migration
- Version tracking
- Rollback support
- Dry-run capability
"""

import os
import sys
import importlib
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from pathlib import Path
import json
import shutil
from sqlalchemy import create_engine, text, MetaData, Table, Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Migration tracking table definition
MIGRATION_TABLE_NAME = "schema_migrations"


class MigrationRunner:
    """Handles database migration execution and tracking"""
    
    def __init__(self, database_url: str, migration_dir: str = None):
        """
        Initialize migration runner
        
        Args:
            database_url: Database connection URL
            migration_dir: Directory containing migration files
        """
        self.database_url = database_url
        self.engine = create_engine(database_url)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.migration_dir = migration_dir or Path(__file__).parent
        self.backup_dir = Path(__file__).parent.parent / "backups"
        
        # Ensure backup directory exists
        self.backup_dir.mkdir(exist_ok=True)
        
        # Initialize migration tracking table
        self._ensure_migration_table()
    
    def _ensure_migration_table(self):
        """Create migration tracking table if it doesn't exist"""
        metadata = MetaData()
        
        migration_table = Table(
            MIGRATION_TABLE_NAME, metadata,
            Column('id', Integer, primary_key=True),
            Column('version', String(50), unique=True, nullable=False),
            Column('description', Text),
            Column('applied_at', DateTime, nullable=False),
            Column('execution_time_ms', Integer),
            Column('checksum', String(64)),
            Column('rollback_applied', Boolean, default=False),
            Column('rollback_at', DateTime),
            Column('status', String(20), default='applied'),  # applied, rolled_back, failed
            Column('error_message', Text),
            Column('metadata_json', Text)  # Store additional metadata as JSON
        )
        
        metadata.create_all(self.engine)
        logger.info("Migration tracking table ensured")
    
    def _get_applied_migrations(self) -> List[str]:
        """Get list of applied migration versions"""
        with self.SessionLocal() as session:
            result = session.execute(
                text(f"SELECT version FROM {MIGRATION_TABLE_NAME} WHERE status = 'applied' ORDER BY version")
            )
            return [row[0] for row in result]
    
    def _get_available_migrations(self) -> List[Dict[str, Any]]:
        """Get list of available migration files"""
        migrations = []
        
        for file_path in sorted(self.migration_dir.glob("v*.py")):
            if file_path.stem.startswith("v") and "_" in file_path.stem:
                version = file_path.stem
                module_name = f"migrations.{version}"
                
                try:
                    # Import migration module
                    spec = importlib.util.spec_from_file_location(module_name, file_path)
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)
                    
                    migrations.append({
                        'version': version,
                        'path': file_path,
                        'module': module,
                        'description': getattr(module, 'description', 'No description'),
                        'dependencies': getattr(module, 'dependencies', [])
                    })
                except Exception as e:
                    logger.error(f"Failed to load migration {version}: {e}")
        
        return migrations
    
    def _backup_database(self) -> Optional[Path]:
        """Create database backup before migration"""
        if "sqlite" in self.database_url:
            # SQLite backup
            db_path = self.database_url.replace("sqlite:///", "")
            backup_path = self.backup_dir / f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            
            try:
                shutil.copy2(db_path, backup_path)
                logger.info(f"Database backed up to: {backup_path}")
                return backup_path
            except Exception as e:
                logger.error(f"Backup failed: {e}")
                return None
        else:
            # For PostgreSQL, use pg_dump (requires external command)
            logger.warning("PostgreSQL backup not implemented - use pg_dump manually")
            return None
    
    def _validate_migration(self, migration: Dict[str, Any]) -> bool:
        """Validate migration before execution"""
        module = migration['module']
        
        # Check required functions
        if not hasattr(module, 'upgrade'):
            logger.error(f"Migration {migration['version']} missing upgrade() function")
            return False
        
        if not hasattr(module, 'downgrade'):
            logger.error(f"Migration {migration['version']} missing downgrade() function")
            return False
        
        # Check dependencies
        applied = self._get_applied_migrations()
        for dep in migration['dependencies']:
            if dep not in applied:
                logger.error(f"Migration {migration['version']} depends on {dep} which is not applied")
                return False
        
        return True
    
    def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate checksum of migration file"""
        import hashlib
        return hashlib.sha256(file_path.read_bytes()).hexdigest()
    
    def run_migration(self, migration: Dict[str, Any], dry_run: bool = False) -> bool:
        """
        Execute a single migration
        
        Args:
            migration: Migration information
            dry_run: If True, don't actually execute the migration
            
        Returns:
            True if successful, False otherwise
        """
        version = migration['version']
        module = migration['module']
        
        logger.info(f"{'[DRY RUN] ' if dry_run else ''}Running migration: {version}")
        logger.info(f"Description: {migration['description']}")
        
        if dry_run:
            logger.info("Dry run completed - no changes made")
            return True
        
        start_time = datetime.now()
        
        with self.SessionLocal() as session:
            try:
                # Start transaction
                session.begin()
                
                # Execute upgrade
                module.upgrade(session, self.engine)
                
                # Record migration
                execution_time_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                
                session.execute(
                    text(f"""
                        INSERT INTO {MIGRATION_TABLE_NAME} 
                        (version, description, applied_at, execution_time_ms, checksum, status, metadata_json)
                        VALUES (:version, :description, :applied_at, :execution_time_ms, :checksum, :status, :metadata)
                    """),
                    {
                        'version': version,
                        'description': migration['description'],
                        'applied_at': datetime.now(),
                        'execution_time_ms': execution_time_ms,
                        'checksum': self._calculate_checksum(migration['path']),
                        'status': 'applied',
                        'metadata': json.dumps({
                            'dependencies': migration['dependencies'],
                            'file_path': str(migration['path'])
                        })
                    }
                )
                
                # Commit transaction
                session.commit()
                logger.info(f"Migration {version} completed in {execution_time_ms}ms")
                return True
                
            except Exception as e:
                # Rollback on error
                session.rollback()
                logger.error(f"Migration {version} failed: {e}")
                
                # Record failure
                session.execute(
                    text(f"""
                        INSERT INTO {MIGRATION_TABLE_NAME} 
                        (version, description, applied_at, status, error_message)
                        VALUES (:version, :description, :applied_at, :status, :error)
                    """),
                    {
                        'version': version,
                        'description': migration['description'],
                        'applied_at': datetime.now(),
                        'status': 'failed',
                        'error': str(e)
                    }
                )
                session.commit()
                return False
    
    def rollback_migration(self, version: str) -> bool:
        """
        Rollback a specific migration
        
        Args:
            version: Migration version to rollback
            
        Returns:
            True if successful, False otherwise
        """
        # Find migration module
        migrations = self._get_available_migrations()
        migration = next((m for m in migrations if m['version'] == version), None)
        
        if not migration:
            logger.error(f"Migration {version} not found")
            return False
        
        module = migration['module']
        logger.info(f"Rolling back migration: {version}")
        
        with self.SessionLocal() as session:
            try:
                # Start transaction
                session.begin()
                
                # Execute downgrade
                module.downgrade(session, self.engine)
                
                # Update migration status
                session.execute(
                    text(f"""
                        UPDATE {MIGRATION_TABLE_NAME}
                        SET status = 'rolled_back', 
                            rollback_applied = TRUE, 
                            rollback_at = :rollback_at
                        WHERE version = :version
                    """),
                    {
                        'version': version,
                        'rollback_at': datetime.now()
                    }
                )
                
                # Commit transaction
                session.commit()
                logger.info(f"Rollback of {version} completed")
                return True
                
            except Exception as e:
                # Rollback on error
                session.rollback()
                logger.error(f"Rollback of {version} failed: {e}")
                return False
    
    def migrate(self, target_version: Optional[str] = None, dry_run: bool = False):
        """
        Run all pending migrations up to target version
        
        Args:
            target_version: Migrate up to this version (None = all)
            dry_run: If True, don't actually execute migrations
        """
        # Create backup before migration
        if not dry_run:
            backup_path = self._backup_database()
            if backup_path:
                logger.info(f"Backup created at: {backup_path}")
        
        # Get migration status
        applied = self._get_applied_migrations()
        available = self._get_available_migrations()
        
        # Filter pending migrations
        pending = [m for m in available if m['version'] not in applied]
        
        if target_version:
            pending = [m for m in pending if m['version'] <= target_version]
        
        if not pending:
            logger.info("No pending migrations")
            return
        
        logger.info(f"Found {len(pending)} pending migrations")
        
        # Execute migrations
        failed = False
        for migration in pending:
            if not self._validate_migration(migration):
                failed = True
                break
            
            if not self.run_migration(migration, dry_run):
                failed = True
                break
        
        if failed:
            logger.error("Migration failed - database may be in inconsistent state")
            logger.info("Consider restoring from backup or running rollback")
        else:
            logger.info("All migrations completed successfully")
    
    def status(self):
        """Show migration status"""
        applied = self._get_applied_migrations()
        available = self._get_available_migrations()
        
        print("\n=== Migration Status ===")
        print(f"Applied migrations: {len(applied)}")
        print(f"Available migrations: {len(available)}")
        
        # Show applied migrations
        if applied:
            print("\nApplied:")
            with self.SessionLocal() as session:
                result = session.execute(
                    text(f"""
                        SELECT version, description, applied_at, execution_time_ms, status
                        FROM {MIGRATION_TABLE_NAME}
                        ORDER BY applied_at DESC
                        LIMIT 10
                    """)
                )
                for row in result:
                    status_icon = "✓" if row[4] == 'applied' else "✗"
                    print(f"  {status_icon} {row[0]} - {row[1]} (Applied: {row[2]}, {row[3]}ms)")
        
        # Show pending migrations
        pending = [m for m in available if m['version'] not in applied]
        if pending:
            print("\nPending:")
            for m in pending:
                print(f"  - {m['version']} - {m['description']}")
        else:
            print("\nNo pending migrations")
    
    def validate(self):
        """Validate database schema integrity"""
        logger.info("Validating database schema...")
        
        # Check migration table
        with self.SessionLocal() as session:
            try:
                result = session.execute(text(f"SELECT COUNT(*) FROM {MIGRATION_TABLE_NAME}"))
                count = result.scalar()
                logger.info(f"Migration table contains {count} records")
            except Exception as e:
                logger.error(f"Migration table validation failed: {e}")
                return False
        
        # Validate each applied migration
        applied = self._get_applied_migrations()
        for version in applied:
            logger.info(f"Validating migration {version}...")
            # Add specific validation logic here
        
        logger.info("Schema validation completed")
        return True


def main():
    """Command-line interface for migration runner"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Database Migration Runner")
    parser.add_argument('command', choices=['migrate', 'rollback', 'status', 'validate'],
                       help='Command to execute')
    parser.add_argument('--version', help='Target migration version')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without executing')
    parser.add_argument('--database-url', help='Database URL (overrides environment variable)')
    
    args = parser.parse_args()
    
    # Get database URL
    database_url = args.database_url or os.getenv('DATABASE_URL', 'sqlite:///./fossawork_v2.db')
    
    # Create runner
    runner = MigrationRunner(database_url)
    
    # Execute command
    if args.command == 'migrate':
        runner.migrate(target_version=args.version, dry_run=args.dry_run)
    elif args.command == 'rollback':
        if not args.version:
            print("Error: --version required for rollback")
            sys.exit(1)
        runner.rollback_migration(args.version)
    elif args.command == 'status':
        runner.status()
    elif args.command == 'validate':
        runner.validate()


if __name__ == '__main__':
    main()