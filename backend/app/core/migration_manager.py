"""
Migration Manager - Core migration functionality

Integrates with the application to provide:
- Automatic migration on startup
- Migration status API
- Programmatic migration control
"""

import os
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Import the migration runner
import sys
sys.path.append(str(Path(__file__).parent.parent.parent))
from migrations.migration_runner import MigrationRunner

logger = logging.getLogger(__name__)


class MigrationManager:
    """Manages database migrations for the application"""
    
    def __init__(self, database_url: Optional[str] = None):
        """
        Initialize migration manager
        
        Args:
            database_url: Database URL (defaults to environment variable)
        """
        self.database_url = database_url or os.getenv('DATABASE_URL', 'sqlite:///./fossawork_v2.db')
        self.migration_dir = Path(__file__).parent.parent.parent / "migrations"
        self.runner = MigrationRunner(self.database_url, self.migration_dir)
        
    def auto_migrate(self, target_version: Optional[str] = None) -> Dict[str, Any]:
        """
        Automatically run pending migrations
        
        Args:
            target_version: Target version to migrate to
            
        Returns:
            Migration result with status and details
        """
        try:
            logger.info("Starting automatic migration...")
            
            # Get current status
            before_status = self.get_status()
            
            # Run migrations
            self.runner.migrate(target_version=target_version, dry_run=False)
            
            # Get status after migration
            after_status = self.get_status()
            
            # Calculate what was done
            migrations_run = len(after_status['applied']) - len(before_status['applied'])
            
            return {
                'success': True,
                'migrations_run': migrations_run,
                'current_version': after_status['applied'][-1] if after_status['applied'] else None,
                'pending_count': len(after_status['pending']),
                'message': f"Successfully ran {migrations_run} migrations"
            }
            
        except Exception as e:
            logger.error(f"Auto-migration failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'message': "Migration failed - manual intervention may be required"
            }
    
    def get_status(self) -> Dict[str, Any]:
        """Get current migration status"""
        applied = self.runner._get_applied_migrations()
        available = self.runner._get_available_migrations()
        pending = [m for m in available if m['version'] not in applied]
        
        return {
            'applied': applied,
            'pending': [m['version'] for m in pending],
            'available': [m['version'] for m in available],
            'current_version': applied[-1] if applied else None,
            'database_url': self.database_url.split('@')[-1] if '@' in self.database_url else self.database_url
        }
    
    def validate_schema(self) -> Dict[str, Any]:
        """Validate database schema integrity"""
        try:
            is_valid = self.runner.validate()
            
            return {
                'valid': is_valid,
                'message': "Schema validation passed" if is_valid else "Schema validation failed"
            }
        except Exception as e:
            return {
                'valid': False,
                'error': str(e),
                'message': "Schema validation error"
            }
    
    def rollback(self, version: str) -> Dict[str, Any]:
        """
        Rollback a specific migration
        
        Args:
            version: Migration version to rollback
            
        Returns:
            Rollback result
        """
        try:
            success = self.runner.rollback_migration(version)
            
            return {
                'success': success,
                'version': version,
                'message': f"Rollback of {version} {'succeeded' if success else 'failed'}"
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': f"Rollback error: {e}"
            }
    
    def dry_run(self, target_version: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Perform a dry run to see what migrations would be executed
        
        Args:
            target_version: Target version for dry run
            
        Returns:
            List of migrations that would be run
        """
        applied = self.runner._get_applied_migrations()
        available = self.runner._get_available_migrations()
        
        # Filter pending migrations
        pending = [m for m in available if m['version'] not in applied]
        
        if target_version:
            pending = [m for m in pending if m['version'] <= target_version]
        
        return [
            {
                'version': m['version'],
                'description': m['description'],
                'dependencies': m['dependencies']
            }
            for m in pending
        ]
    
    def get_migration_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get migration execution history
        
        Args:
            limit: Number of records to return
            
        Returns:
            List of migration history records
        """
        with self.runner.SessionLocal() as session:
            result = session.execute(
                text(f"""
                    SELECT version, description, applied_at, execution_time_ms, 
                           status, error_message
                    FROM schema_migrations
                    ORDER BY applied_at DESC
                    LIMIT :limit
                """),
                {'limit': limit}
            )
            
            return [
                {
                    'version': row[0],
                    'description': row[1],
                    'applied_at': row[2].isoformat() if row[2] else None,
                    'execution_time_ms': row[3],
                    'status': row[4],
                    'error_message': row[5]
                }
                for row in result
            ]
    
    def check_migration_needed(self) -> bool:
        """Check if any migrations are pending"""
        status = self.get_status()
        return len(status['pending']) > 0
    
    def ensure_latest(self) -> None:
        """Ensure database is at latest migration version"""
        if self.check_migration_needed():
            logger.info("Pending migrations detected, running auto-migration...")
            result = self.auto_migrate()
            
            if not result['success']:
                raise RuntimeError(f"Migration failed: {result.get('error', 'Unknown error')}")
            
            logger.info(f"Migration complete: {result['message']}")
        else:
            logger.info("Database is up to date")


# Singleton instance
_migration_manager: Optional[MigrationManager] = None


def get_migration_manager() -> MigrationManager:
    """Get or create migration manager instance"""
    global _migration_manager
    if _migration_manager is None:
        _migration_manager = MigrationManager()
    return _migration_manager


def run_migrations_on_startup():
    """Run migrations automatically on application startup"""
    try:
        manager = get_migration_manager()
        manager.ensure_latest()
    except Exception as e:
        logger.error(f"Failed to run migrations on startup: {e}")
        # Decide whether to halt startup or continue
        # For development, we might continue; for production, we might halt
        if os.getenv('ENVIRONMENT') == 'production':
            raise