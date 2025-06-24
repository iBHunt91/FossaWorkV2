#!/usr/bin/env python3
"""
V1 to V2 Data Migration Script

Migrates data from V1 file-based storage to V2 database structure.
Handles user data, work orders, dispensers, and all associated data.
"""

import os
import sys
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
import argparse
import hashlib
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent.parent / "backend"))

from app.database import Base
from app.models.user_models import (
    User, UserSession, UserPreference, UserActivity,
    UserDispenserData, UserScrapedContent, ProverSettings,
    UserCompletedJobs, UserScheduleChanges, UserBatchHistory,
    UserChangeHistory, GlobalSettings, UserCredential
)
from app.core_models import WorkOrder, Dispenser, AutomationJob

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class V1ToV2Migrator:
    """Handles migration from V1 file-based storage to V2 database"""
    
    def __init__(self, v1_data_dir: str, database_url: str):
        """
        Initialize migrator
        
        Args:
            v1_data_dir: Path to V1 data directory
            database_url: V2 database connection URL
        """
        self.v1_data_dir = Path(v1_data_dir)
        self.engine = create_engine(database_url)
        self.SessionLocal = sessionmaker(bind=self.engine)
        
        # Migration statistics
        self.stats = {
            'users_migrated': 0,
            'work_orders_migrated': 0,
            'dispensers_migrated': 0,
            'preferences_migrated': 0,
            'activities_migrated': 0,
            'errors': []
        }
    
    def verify_v1_structure(self) -> bool:
        """Verify V1 data directory structure"""
        required_dirs = ['users']
        required_files = ['settings.json']
        
        for dir_name in required_dirs:
            if not (self.v1_data_dir / dir_name).exists():
                logger.error(f"Missing V1 directory: {dir_name}")
                return False
        
        for file_name in required_files:
            if not (self.v1_data_dir / file_name).exists():
                logger.warning(f"Missing V1 file: {file_name}")
        
        return True
    
    def read_json_file(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """Safely read JSON file"""
        if not file_path.exists():
            return None
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read {file_path}: {e}")
            self.stats['errors'].append(f"Failed to read {file_path}: {e}")
            return None
    
    def migrate_global_settings(self):
        """Migrate global settings"""
        logger.info("Migrating global settings...")
        
        settings_file = self.v1_data_dir / 'settings.json'
        settings_data = self.read_json_file(settings_file)
        
        if not settings_data:
            logger.warning("No global settings found")
            return
        
        with self.SessionLocal() as session:
            # Store each setting as a key-value pair
            for key, value in settings_data.items():
                setting = GlobalSettings(
                    setting_key=key,
                    setting_value=value if isinstance(value, (dict, list)) else {'value': value},
                    description=f"Migrated from V1 settings.json"
                )
                session.add(setting)
            
            session.commit()
            logger.info(f"Migrated {len(settings_data)} global settings")
    
    def migrate_users(self):
        """Migrate all users from V1"""
        logger.info("Migrating users...")
        
        users_file = self.v1_data_dir / 'users' / 'users.json'
        users_data = self.read_json_file(users_file)
        
        if not users_data:
            logger.warning("No users found")
            return
        
        with self.SessionLocal() as session:
            for user_id, user_info in users_data.items():
                try:
                    # Create user
                    user = User(
                        email=user_info['email'],
                        password_hash=User.hash_password(user_info.get('password', 'changeme')),
                        label=user_info.get('label', user_info['email']),
                        friendly_name=user_info.get('friendlyName'),
                        configured_email=user_info.get('configuredEmail'),
                        last_used=datetime.fromisoformat(user_info['lastUsed']) if 'lastUsed' in user_info else None
                    )
                    
                    # Verify ID matches V1
                    if user.id != user_id:
                        logger.error(f"ID mismatch for {user_info['email']}: expected {user_id}, got {user.id}")
                        continue
                    
                    session.add(user)
                    session.flush()  # Get user ID
                    
                    # Migrate user-specific data
                    self._migrate_user_data(session, user_id, user)
                    
                    self.stats['users_migrated'] += 1
                    logger.info(f"Migrated user: {user.email}")
                    
                except Exception as e:
                    logger.error(f"Failed to migrate user {user_id}: {e}")
                    self.stats['errors'].append(f"User {user_id}: {e}")
                    session.rollback()
                    continue
            
            session.commit()
    
    def _migrate_user_data(self, session, user_id: str, user: User):
        """Migrate all data for a specific user"""
        user_dir = self.v1_data_dir / 'users' / user_id
        
        if not user_dir.exists():
            logger.warning(f"No data directory for user {user_id}")
            return
        
        # Migrate preferences
        self._migrate_user_preferences(session, user_dir, user)
        
        # Migrate activity log
        self._migrate_user_activities(session, user_dir, user)
        
        # Migrate dispenser data
        self._migrate_user_dispensers(session, user_dir, user)
        
        # Migrate work orders
        self._migrate_user_work_orders(session, user_dir, user)
        
        # Migrate prover settings
        self._migrate_prover_settings(session, user_dir, user)
        
        # Migrate completed jobs
        self._migrate_completed_jobs(session, user_dir, user)
        
        # Migrate credentials
        self._migrate_user_credentials(session, user_dir, user)
    
    def _migrate_user_preferences(self, session, user_dir: Path, user: User):
        """Migrate user preferences"""
        preference_files = {
            'email': 'email_settings.json',
            'pushover': 'pushover_settings.json',
            'prover': 'prover_preferences.json',
            'work_week': 'work_week_preference.json',
            'notification': 'notification_settings.json'
        }
        
        for category, filename in preference_files.items():
            file_path = user_dir / filename
            data = self.read_json_file(file_path)
            
            if data:
                pref = UserPreference(
                    user_id=user.id,
                    category=category,
                    settings=data
                )
                session.add(pref)
                self.stats['preferences_migrated'] += 1
        
        # Also store notification settings directly on user
        notif_data = self.read_json_file(user_dir / 'notification_settings.json')
        if notif_data:
            user.notification_settings = notif_data
    
    def _migrate_user_activities(self, session, user_dir: Path, user: User):
        """Migrate user activity log"""
        activity_file = user_dir / 'activity_log.json'
        activities = self.read_json_file(activity_file)
        
        if not activities:
            return
        
        for activity_data in activities:
            try:
                activity = UserActivity(
                    user_id=user.id,
                    username=activity_data.get('username', user.email),
                    activity_type=activity_data.get('activity', 'unknown'),
                    details=activity_data,
                    created_at=datetime.fromisoformat(activity_data['timestamp']) 
                              if 'timestamp' in activity_data else None
                )
                session.add(activity)
                self.stats['activities_migrated'] += 1
            except Exception as e:
                logger.error(f"Failed to migrate activity: {e}")
    
    def _migrate_user_dispensers(self, session, user_dir: Path, user: User):
        """Migrate dispenser store data"""
        dispenser_file = user_dir / 'dispenser_store.json'
        dispenser_data = self.read_json_file(dispenser_file)
        
        if not dispenser_data or 'dispenserData' not in dispenser_data:
            return
        
        for work_order_id, data in dispenser_data['dispenserData'].items():
            try:
                # Store in user dispenser data table
                user_disp = UserDispenserData(
                    user_id=user.id,
                    work_order_id=work_order_id,
                    visit_id=data.get('visitId'),
                    dispenser_data=data.get('dispensers', []),
                    meta_data={
                        'migrated_from_v1': True,
                        'migration_date': datetime.now().isoformat()
                    }
                )
                session.add(user_disp)
                self.stats['dispensers_migrated'] += len(data.get('dispensers', []))
            except Exception as e:
                logger.error(f"Failed to migrate dispensers for {work_order_id}: {e}")
    
    def _migrate_user_work_orders(self, session, user_dir: Path, user: User):
        """Migrate work orders from scraped content"""
        scraped_file = user_dir / 'scraped_content.json'
        scraped_data = self.read_json_file(scraped_file)
        
        if not scraped_data:
            return
        
        work_orders = scraped_data.get('workOrders', [])
        
        for wo_data in work_orders:
            try:
                # Extract work order number
                wo_id = wo_data.get('workOrderId', '').replace('W-', '')
                if not wo_id:
                    continue
                
                work_order = WorkOrder(
                    user_id=user.id,
                    external_id=wo_data.get('workOrderId'),
                    site_name=wo_data.get('customerName', ''),
                    address=wo_data.get('address', ''),
                    scheduled_date=datetime.fromisoformat(wo_data['scheduledDate']) 
                                  if wo_data.get('scheduledDate') else None,
                    status='pending',
                    work_type=wo_data.get('serviceDescription'),
                    notes=wo_data.get('instructions'),
                    scraped_data=wo_data,
                    store_number=wo_data.get('storeNumber'),
                    service_code=wo_data.get('serviceCode'),
                    service_description=wo_data.get('serviceDescription'),
                    visit_id=wo_data.get('visitId'),
                    visit_url=wo_data.get('visitUrl')
                )
                session.add(work_order)
                self.stats['work_orders_migrated'] += 1
            except Exception as e:
                logger.error(f"Failed to migrate work order: {e}")
    
    def _migrate_prover_settings(self, session, user_dir: Path, user: User):
        """Migrate prover preferences"""
        prover_file = user_dir / 'prover_preferences.json'
        prover_data = self.read_json_file(prover_file)
        
        if not prover_data:
            return
        
        # Handle both single prover and multiple provers
        provers = prover_data if isinstance(prover_data, list) else [prover_data]
        
        for prover in provers:
            try:
                setting = ProverSettings(
                    user_id=user.id,
                    prover_id=prover.get('proverId', prover.get('serial', '')),
                    serial=prover.get('serial'),
                    make=prover.get('make'),
                    preferred_fuel_type=prover.get('preferredFuelType'),
                    preferred_fuel_types=prover.get('preferredFuelTypes', []),
                    priority=prover.get('priority', 1),
                    full_text=prover.get('fullText'),
                    work_week_preference=prover.get('workWeekPreference')
                )
                session.add(setting)
            except Exception as e:
                logger.error(f"Failed to migrate prover setting: {e}")
    
    def _migrate_completed_jobs(self, session, user_dir: Path, user: User):
        """Migrate completed jobs"""
        jobs_file = user_dir / 'completed_jobs.json'
        jobs_data = self.read_json_file(jobs_file)
        
        if not jobs_data:
            return
        
        for job in jobs_data:
            try:
                completed_job = UserCompletedJobs(
                    user_id=user.id,
                    job_id=job.get('jobId', job.get('workOrderId', '')),
                    work_order_id=job.get('workOrderId'),
                    completion_date=datetime.fromisoformat(job['completionDate']) 
                                   if job.get('completionDate') else None,
                    job_data=job,
                    removal_reason=job.get('reason', 'Migrated from V1')
                )
                session.add(completed_job)
            except Exception as e:
                logger.error(f"Failed to migrate completed job: {e}")
    
    def _migrate_user_credentials(self, session, user_dir: Path, user: User):
        """Migrate WorkFossa credentials"""
        creds_file = user_dir / 'work_fossa_credentials.json'
        creds_data = self.read_json_file(creds_file)
        
        if not creds_data:
            return
        
        try:
            # Note: In V1, credentials were stored in plain text
            # In V2, they should be encrypted
            credential = UserCredential(
                user_id=user.id,
                service_name='work_fossa',
                encrypted_username=creds_data.get('username', ''),  # Should encrypt
                encrypted_password=creds_data.get('password', ''),  # Should encrypt
                is_active=True,
                is_verified=False  # Needs verification after migration
            )
            session.add(credential)
            
            logger.warning(f"Migrated credentials for {user.email} - NEEDS ENCRYPTION")
        except Exception as e:
            logger.error(f"Failed to migrate credentials: {e}")
    
    def create_indexes(self):
        """Create database indexes after migration"""
        logger.info("Creating database indexes...")
        
        with self.SessionLocal() as session:
            # Run the index creation migration
            from migrations.v003_add_indexes import upgrade
            upgrade(session, self.engine)
    
    def print_statistics(self):
        """Print migration statistics"""
        print("\n=== Migration Statistics ===")
        print(f"Users migrated: {self.stats['users_migrated']}")
        print(f"Work orders migrated: {self.stats['work_orders_migrated']}")
        print(f"Dispensers migrated: {self.stats['dispensers_migrated']}")
        print(f"Preferences migrated: {self.stats['preferences_migrated']}")
        print(f"Activities migrated: {self.stats['activities_migrated']}")
        
        if self.stats['errors']:
            print(f"\nErrors encountered: {len(self.stats['errors'])}")
            for error in self.stats['errors'][:10]:  # Show first 10 errors
                print(f"  - {error}")
            if len(self.stats['errors']) > 10:
                print(f"  ... and {len(self.stats['errors']) - 10} more")
    
    def migrate(self):
        """Run the complete migration"""
        logger.info("Starting V1 to V2 migration...")
        
        # Verify V1 structure
        if not self.verify_v1_structure():
            logger.error("V1 data structure verification failed")
            return False
        
        # Create V2 schema
        logger.info("Creating V2 database schema...")
        Base.metadata.create_all(bind=self.engine)
        
        # Run migrations in order
        self.migrate_global_settings()
        self.migrate_users()
        self.create_indexes()
        
        # Print results
        self.print_statistics()
        
        return len(self.stats['errors']) == 0


def main():
    """Command-line interface"""
    parser = argparse.ArgumentParser(description="Migrate FossaWork from V1 to V2")
    parser.add_argument('--v1-data', default='./data',
                       help='Path to V1 data directory')
    parser.add_argument('--database', default='sqlite:///./fossawork_v2.db',
                       help='V2 database URL')
    parser.add_argument('--dry-run', action='store_true',
                       help='Verify V1 structure without migrating')
    
    args = parser.parse_args()
    
    # Create migrator
    migrator = V1ToV2Migrator(args.v1_data, args.database)
    
    if args.dry_run:
        # Just verify structure
        if migrator.verify_v1_structure():
            print("V1 data structure verified successfully")
            
            # Count items
            users_dir = Path(args.v1_data) / 'users'
            user_count = len(list(users_dir.iterdir())) - 1  # Exclude users.json
            print(f"Found {user_count} users to migrate")
        else:
            print("V1 data structure verification failed")
            sys.exit(1)
    else:
        # Run migration
        if migrator.migrate():
            print("\nMigration completed successfully!")
        else:
            print("\nMigration completed with errors")
            sys.exit(1)


if __name__ == '__main__':
    main()