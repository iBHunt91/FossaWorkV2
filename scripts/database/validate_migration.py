#!/usr/bin/env python3
"""
Migration Validation Script

Validates database schema and data integrity after migrations.
"""

import os
import sys
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple
import argparse
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MigrationValidator:
    """Validates database migrations and schema integrity"""
    
    def __init__(self, database_url: str):
        """
        Initialize validator
        
        Args:
            database_url: Database connection URL
        """
        self.database_url = database_url
        self.engine = create_engine(database_url)
        self.SessionLocal = sessionmaker(bind=self.engine)
        self.inspector = inspect(self.engine)
        
        self.validation_results = {
            'schema': {'passed': 0, 'failed': 0, 'warnings': 0},
            'data': {'passed': 0, 'failed': 0, 'warnings': 0},
            'indexes': {'passed': 0, 'failed': 0, 'warnings': 0},
            'constraints': {'passed': 0, 'failed': 0, 'warnings': 0},
            'issues': []
        }
    
    def validate_schema(self) -> bool:
        """Validate database schema structure"""
        logger.info("Validating database schema...")
        
        # Expected tables from migrations
        expected_tables = {
            # Core tables
            'users', 'user_sessions', 'user_preferences', 'user_activities',
            'user_dispenser_data', 'user_scraped_content', 'prover_settings',
            'user_completed_jobs', 'user_schedule_changes', 'user_batch_history',
            'user_change_history', 'global_settings', 'tutorial_data', 'user_credentials',
            'work_orders', 'dispensers', 'automation_jobs',
            
            # Security tables
            'security_events', 'failed_login_attempts', 'api_access_logs',
            'suspicious_activities', 'data_access_audit', 'session_tokens',
            
            # Rate limiting tables
            'rate_limit_rules', 'rate_limit_buckets', 'rate_limit_violations',
            'api_quotas', 'throttle_events',
            
            # Audit tables
            'audit_trail', 'compliance_logs', 'data_retention_policies',
            'privacy_requests', 'configuration_audit', 'access_control_audit',
            'file_access_audit', 'export_audit',
            
            # Monitoring tables
            'system_metrics', 'health_checks', 'error_tracking', 'performance_logs',
            'uptime_monitoring', 'resource_usage', 'alert_history', 'background_jobs',
            'database_stats', 'api_endpoint_stats',
            
            # Migration tracking
            'schema_migrations'
        }
        
        # Get actual tables
        actual_tables = set(self.inspector.get_table_names())
        
        # Check for missing tables
        missing_tables = expected_tables - actual_tables
        if missing_tables:
            for table in missing_tables:
                self._log_issue('error', f"Missing table: {table}")
                self.validation_results['schema']['failed'] += 1
        else:
            logger.info(f"All {len(expected_tables)} expected tables present")
            self.validation_results['schema']['passed'] += len(expected_tables)
        
        # Check for unexpected tables
        unexpected_tables = actual_tables - expected_tables
        if unexpected_tables:
            for table in unexpected_tables:
                # Skip SQLite internal tables and FTS tables
                if not table.startswith('sqlite_') and not table.endswith('_fts'):
                    self._log_issue('warning', f"Unexpected table: {table}")
                    self.validation_results['schema']['warnings'] += 1
        
        # Validate table structures
        for table in expected_tables & actual_tables:
            self._validate_table_structure(table)
        
        return self.validation_results['schema']['failed'] == 0
    
    def _validate_table_structure(self, table_name: str):
        """Validate structure of a specific table"""
        try:
            columns = self.inspector.get_columns(table_name)
            
            # Check for primary key
            pk_constraint = self.inspector.get_pk_constraint(table_name)
            if not pk_constraint or not pk_constraint.get('constrained_columns'):
                self._log_issue('warning', f"Table {table_name} has no primary key")
                self.validation_results['schema']['warnings'] += 1
            
            # Validate column properties
            for column in columns:
                # Check for NOT NULL on important columns
                if column['name'] in ['user_id', 'created_at'] and column['nullable']:
                    self._log_issue('warning', 
                                  f"Column {table_name}.{column['name']} should be NOT NULL")
                    self.validation_results['schema']['warnings'] += 1
            
            self.validation_results['schema']['passed'] += 1
            
        except Exception as e:
            self._log_issue('error', f"Failed to validate table {table_name}: {e}")
            self.validation_results['schema']['failed'] += 1
    
    def validate_indexes(self) -> bool:
        """Validate database indexes"""
        logger.info("Validating database indexes...")
        
        critical_indexes = {
            'users': ['email'],
            'work_orders': ['user_id', 'external_id', 'scheduled_date'],
            'dispensers': ['work_order_id'],
            'security_events': ['event_type', 'user_id', 'created_at'],
            'api_access_logs': ['user_id', 'endpoint'],
            'audit_trail': ['table_name', 'user_id', 'created_at']
        }
        
        for table, expected_indexed_columns in critical_indexes.items():
            if table not in self.inspector.get_table_names():
                continue
            
            indexes = self.inspector.get_indexes(table)
            indexed_columns = set()
            
            for index in indexes:
                indexed_columns.update(index['column_names'])
            
            for column in expected_indexed_columns:
                if column not in indexed_columns:
                    self._log_issue('warning', 
                                  f"Missing index on {table}.{column}")
                    self.validation_results['indexes']['warnings'] += 1
                else:
                    self.validation_results['indexes']['passed'] += 1
        
        return self.validation_results['indexes']['failed'] == 0
    
    def validate_constraints(self) -> bool:
        """Validate foreign key constraints"""
        logger.info("Validating foreign key constraints...")
        
        tables_with_fks = [
            'user_sessions', 'user_preferences', 'user_activities',
            'work_orders', 'dispensers', 'security_events'
        ]
        
        for table in tables_with_fks:
            if table not in self.inspector.get_table_names():
                continue
            
            try:
                foreign_keys = self.inspector.get_foreign_keys(table)
                
                if not foreign_keys and table != 'users':
                    self._log_issue('warning', 
                                  f"Table {table} has no foreign keys")
                    self.validation_results['constraints']['warnings'] += 1
                else:
                    self.validation_results['constraints']['passed'] += 1
                    
            except Exception as e:
                self._log_issue('error', 
                              f"Failed to check constraints for {table}: {e}")
                self.validation_results['constraints']['failed'] += 1
        
        return self.validation_results['constraints']['failed'] == 0
    
    def validate_data_integrity(self) -> bool:
        """Validate data integrity and relationships"""
        logger.info("Validating data integrity...")
        
        with self.SessionLocal() as session:
            # Check for orphaned records
            checks = [
                ("work_orders without users", """
                    SELECT COUNT(*) FROM work_orders w
                    LEFT JOIN users u ON w.user_id = u.id
                    WHERE u.id IS NULL
                """),
                ("dispensers without work_orders", """
                    SELECT COUNT(*) FROM dispensers d
                    LEFT JOIN work_orders w ON d.work_order_id = w.id
                    WHERE w.id IS NULL
                """),
                ("user_preferences without users", """
                    SELECT COUNT(*) FROM user_preferences p
                    LEFT JOIN users u ON p.user_id = u.id
                    WHERE u.id IS NULL
                """)
            ]
            
            for check_name, query in checks:
                try:
                    result = session.execute(text(query))
                    count = result.scalar()
                    
                    if count > 0:
                        self._log_issue('error', 
                                      f"Found {count} orphaned {check_name}")
                        self.validation_results['data']['failed'] += 1
                    else:
                        self.validation_results['data']['passed'] += 1
                        
                except Exception as e:
                    self._log_issue('error', 
                                  f"Failed to check {check_name}: {e}")
                    self.validation_results['data']['failed'] += 1
        
        return self.validation_results['data']['failed'] == 0
    
    def validate_migration_tracking(self) -> bool:
        """Validate migration tracking table"""
        logger.info("Validating migration tracking...")
        
        with self.SessionLocal() as session:
            try:
                # Check if migration table exists
                result = session.execute(text("""
                    SELECT COUNT(*) FROM schema_migrations
                    WHERE status = 'applied'
                """))
                applied_count = result.scalar()
                
                if applied_count == 0:
                    self._log_issue('error', "No applied migrations found")
                    return False
                
                # Check for failed migrations
                result = session.execute(text("""
                    SELECT version, error_message FROM schema_migrations
                    WHERE status = 'failed'
                """))
                failed = result.fetchall()
                
                if failed:
                    for version, error in failed:
                        self._log_issue('error', 
                                      f"Migration {version} failed: {error}")
                    return False
                
                logger.info(f"Found {applied_count} successfully applied migrations")
                return True
                
            except Exception as e:
                self._log_issue('error', 
                              f"Failed to validate migration tracking: {e}")
                return False
    
    def check_security_setup(self) -> bool:
        """Validate security configuration"""
        logger.info("Checking security setup...")
        
        security_checks = []
        
        with self.SessionLocal() as session:
            # Check for default rate limit rules
            try:
                result = session.execute(text("""
                    SELECT COUNT(*) FROM rate_limit_rules
                    WHERE is_active = TRUE
                """))
                rule_count = result.scalar()
                
                if rule_count == 0:
                    self._log_issue('warning', "No active rate limit rules found")
                    security_checks.append(False)
                else:
                    logger.info(f"Found {rule_count} active rate limit rules")
                    security_checks.append(True)
                    
            except Exception:
                security_checks.append(False)
            
            # Check for retention policies
            try:
                result = session.execute(text("""
                    SELECT COUNT(*) FROM data_retention_policies
                    WHERE is_active = TRUE
                """))
                policy_count = result.scalar()
                
                if policy_count == 0:
                    self._log_issue('warning', "No active retention policies found")
                    security_checks.append(False)
                else:
                    logger.info(f"Found {policy_count} active retention policies")
                    security_checks.append(True)
                    
            except Exception:
                security_checks.append(False)
        
        return all(security_checks)
    
    def _log_issue(self, level: str, message: str):
        """Log an issue and store it"""
        self.validation_results['issues'].append({
            'level': level,
            'message': message,
            'timestamp': datetime.now().isoformat()
        })
        
        if level == 'error':
            logger.error(message)
        elif level == 'warning':
            logger.warning(message)
        else:
            logger.info(message)
    
    def print_summary(self):
        """Print validation summary"""
        print("\n=== Migration Validation Summary ===")
        
        for category, results in self.validation_results.items():
            if category == 'issues':
                continue
            
            print(f"\n{category.upper()}:")
            print(f"  Passed: {results['passed']}")
            print(f"  Failed: {results['failed']}")
            print(f"  Warnings: {results['warnings']}")
        
        if self.validation_results['issues']:
            print("\n=== Issues Found ===")
            errors = [i for i in self.validation_results['issues'] if i['level'] == 'error']
            warnings = [i for i in self.validation_results['issues'] if i['level'] == 'warning']
            
            if errors:
                print(f"\nERRORS ({len(errors)}):")
                for issue in errors[:10]:  # Show first 10
                    print(f"  - {issue['message']}")
                if len(errors) > 10:
                    print(f"  ... and {len(errors) - 10} more")
            
            if warnings:
                print(f"\nWARNINGS ({len(warnings)}):")
                for issue in warnings[:10]:  # Show first 10
                    print(f"  - {issue['message']}")
                if len(warnings) > 10:
                    print(f"  ... and {len(warnings) - 10} more")
        
        # Overall result
        total_failed = sum(r['failed'] for c, r in self.validation_results.items() 
                          if c != 'issues')
        
        print("\n=== OVERALL RESULT ===")
        if total_failed == 0:
            print("✅ All validations PASSED")
        else:
            print(f"❌ Validation FAILED with {total_failed} errors")
    
    def validate_all(self) -> bool:
        """Run all validations"""
        logger.info("Starting comprehensive migration validation...")
        
        validations = [
            ('Migration Tracking', self.validate_migration_tracking),
            ('Schema', self.validate_schema),
            ('Indexes', self.validate_indexes),
            ('Constraints', self.validate_constraints),
            ('Data Integrity', self.validate_data_integrity),
            ('Security Setup', self.check_security_setup)
        ]
        
        all_passed = True
        
        for name, validator in validations:
            logger.info(f"\n--- Validating {name} ---")
            try:
                passed = validator()
                if not passed:
                    all_passed = False
                    logger.error(f"{name} validation failed")
            except Exception as e:
                logger.error(f"{name} validation error: {e}")
                all_passed = False
        
        self.print_summary()
        return all_passed


def main():
    """Command-line interface"""
    parser = argparse.ArgumentParser(description="Validate FossaWork V2 Database Migrations")
    parser.add_argument('--database', default='sqlite:///./fossawork_v2.db',
                       help='Database URL to validate')
    parser.add_argument('--category', choices=['schema', 'indexes', 'constraints', 
                                               'data', 'security', 'all'],
                       default='all', help='Validation category to run')
    parser.add_argument('--fix', action='store_true',
                       help='Attempt to fix issues (not implemented)')
    
    args = parser.parse_args()
    
    # Create validator
    validator = MigrationValidator(args.database)
    
    # Run validations
    if args.category == 'all':
        success = validator.validate_all()
    elif args.category == 'schema':
        success = validator.validate_schema()
        validator.print_summary()
    elif args.category == 'indexes':
        success = validator.validate_indexes()
        validator.print_summary()
    elif args.category == 'constraints':
        success = validator.validate_constraints()
        validator.print_summary()
    elif args.category == 'data':
        success = validator.validate_data_integrity()
        validator.print_summary()
    elif args.category == 'security':
        success = validator.check_security_setup()
        validator.print_summary()
    
    if args.fix:
        print("\nAutomatic fixing not yet implemented")
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()