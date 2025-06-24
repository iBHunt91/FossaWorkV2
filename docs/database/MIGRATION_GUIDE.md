# FossaWork V2 Database Migration Guide

## Overview

This guide provides comprehensive instructions for migrating the FossaWork V2 database, including initial setup, version upgrades, rollback procedures, and troubleshooting.

## Table of Contents

1. [Migration System Overview](#migration-system-overview)
2. [Initial Setup](#initial-setup)
3. [Running Migrations](#running-migrations)
4. [Rollback Procedures](#rollback-procedures)
5. [Data Validation](#data-validation)
6. [V1 to V2 Migration](#v1-to-v2-migration)
7. [Backup and Recovery](#backup-and-recovery)
8. [Common Issues and Solutions](#common-issues-and-solutions)
9. [Security Considerations](#security-considerations)
10. [Monitoring Migrations](#monitoring-migrations)

## Migration System Overview

The FossaWork V2 migration system provides:

- **Version Tracking**: Each migration has a unique version identifier
- **Transaction Safety**: All migrations run within database transactions
- **Automatic Rollback**: Failed migrations automatically rollback changes
- **Dependency Management**: Migrations can declare dependencies on other migrations
- **Backup Integration**: Automatic backups before migrations
- **Validation Tools**: Comprehensive schema and data validation
- **Zero-Downtime Support**: Designed for production deployments

### Migration Files Structure

```
backend/
├── migrations/
│   ├── __init__.py
│   ├── migration_runner.py          # Main migration execution engine
│   ├── v001_initial_schema.py       # Initial database schema
│   ├── v002_add_security_tables.py  # Security event logging
│   ├── v003_add_indexes.py          # Performance indexes
│   ├── v004_add_rate_limiting.py    # Rate limiting tables
│   ├── v005_add_audit_tables.py     # Audit trail
│   ├── v006_add_monitoring_tables.py # System monitoring
│   └── rollback/                    # Rollback scripts
└── app/
    └── core/
        └── migration_manager.py     # Application integration
```

## Initial Setup

### 1. Environment Preparation

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (if not exists)
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Database Configuration

Set the database URL in your environment:

```bash
# For SQLite (development)
export DATABASE_URL="sqlite:///./fossawork_v2.db"

# For PostgreSQL (production)
export DATABASE_URL="postgresql://user:password@localhost:5432/fossawork_v2"
```

### 3. Initial Migration

For a fresh database, run the initial migration:

```bash
# Check migration status
python migrations/migration_runner.py status

# Run all migrations
python migrations/migration_runner.py migrate

# Or run up to a specific version
python migrations/migration_runner.py migrate --version v003_add_indexes
```

## Running Migrations

### Command-Line Interface

```bash
# Show current migration status
python migrations/migration_runner.py status

# Run pending migrations (with automatic backup)
python migrations/migration_runner.py migrate

# Dry run (show what would be done)
python migrations/migration_runner.py migrate --dry-run

# Migrate to specific version
python migrations/migration_runner.py migrate --version v004_add_rate_limiting

# Validate schema after migration
python migrations/migration_runner.py validate
```

### Programmatic Migration (Application Startup)

The application can automatically run migrations on startup:

```python
# In your main application file
from app.core.migration_manager import run_migrations_on_startup

# Run migrations before starting the application
run_migrations_on_startup()
```

### Migration Status API

```python
from app.core.migration_manager import get_migration_manager

manager = get_migration_manager()

# Get current status
status = manager.get_status()
print(f"Current version: {status['current_version']}")
print(f"Pending migrations: {status['pending']}")

# Check if migration needed
if manager.check_migration_needed():
    result = manager.auto_migrate()
    print(f"Migration result: {result}")
```

## Rollback Procedures

### Automatic Rollback

If a migration fails, it automatically rolls back:

```python
# Migration with automatic rollback on error
def upgrade(session, engine):
    try:
        # Migration operations
        session.execute(text("CREATE TABLE ..."))
        # If this fails, everything rolls back
        session.execute(text("Invalid SQL"))
    except Exception:
        # Automatic rollback happens
        raise
```

### Manual Rollback

To manually rollback a specific migration:

```bash
# Rollback specific version
python migrations/migration_runner.py rollback --version v006_add_monitoring_tables

# This will:
# 1. Create a safety backup
# 2. Execute the downgrade() function
# 3. Update migration tracking
```

### Emergency Rollback

If automatic rollback fails:

```bash
# 1. Restore from backup
python scripts/database/restore_database.py --latest --category daily

# 2. Or use manual SQL scripts
sqlite3 fossawork_v2.db < migrations/rollback/emergency_v006_rollback.sql

# 3. Update migration tracking
sqlite3 fossawork_v2.db
UPDATE schema_migrations SET status = 'rolled_back' WHERE version = 'v006_add_monitoring_tables';
```

## Data Validation

### Post-Migration Validation

Always validate after migrations:

```bash
# Full validation
python scripts/database/validate_migration.py

# Specific validation categories
python scripts/database/validate_migration.py --category schema
python scripts/database/validate_migration.py --category indexes
python scripts/database/validate_migration.py --category data
python scripts/database/validate_migration.py --category security
```

### Validation Checks

The validator performs:

1. **Schema Validation**
   - All expected tables exist
   - Table structures match specifications
   - Primary keys are defined

2. **Index Validation**
   - Performance indexes are created
   - Critical columns are indexed

3. **Constraint Validation**
   - Foreign keys are properly defined
   - Referential integrity is maintained

4. **Data Integrity**
   - No orphaned records
   - Required fields are populated
   - Relationships are valid

5. **Security Configuration**
   - Rate limiting rules exist
   - Audit tables are configured
   - Retention policies are active

## V1 to V2 Migration

### Prerequisites

1. Backup V1 data directory
2. Ensure V1 application is stopped
3. Have V2 database ready

### Migration Process

```bash
# 1. Verify V1 data structure
python scripts/database/migrate_from_v1.py --v1-data /path/to/v1/data --dry-run

# 2. Run migration
python scripts/database/migrate_from_v1.py --v1-data /path/to/v1/data

# 3. Validate migration
python scripts/database/validate_migration.py

# 4. Encrypt migrated credentials
python scripts/security/encrypt_credentials.py
```

### Data Mapping

V1 File Structure → V2 Database Tables:

- `data/users/users.json` → `users` table
- `data/users/{id}/email_settings.json` → `user_preferences` table
- `data/users/{id}/work_fossa_credentials.json` → `user_credentials` table
- `data/users/{id}/dispenser_store.json` → `user_dispenser_data` table
- `data/users/{id}/scraped_content.json` → `work_orders` table
- `data/users/{id}/activity_log.json` → `user_activities` table

## Backup and Recovery

### Automated Backups

Before each migration, an automatic backup is created:

```bash
# Backups are stored in
backend/backups/
├── daily/
│   └── backup_20250113_143022.db
├── weekly/
└── monthly/
```

### Manual Backup

```bash
# Create manual backup
python scripts/database/backup_database.py

# Create compressed backup
python scripts/database/backup_database.py --compress

# Promote to weekly/monthly
python scripts/database/backup_database.py --promote-weekly
```

### Recovery Process

```bash
# Interactive restore
python scripts/database/restore_database.py --interactive

# Restore from latest backup
python scripts/database/restore_database.py --latest

# Restore specific backup
python scripts/database/restore_database.py --backup-file backups/daily/backup_20250113_143022.db.gz

# Validate after restore
python scripts/database/validate_migration.py
```

## Common Issues and Solutions

### Issue 1: Migration Fails Due to Existing Data

**Problem**: Migration fails because table already exists

**Solution**:
```bash
# Check migration status
python migrations/migration_runner.py status

# If partially applied, rollback
python migrations/migration_runner.py rollback --version <version>

# Then retry
python migrations/migration_runner.py migrate
```

### Issue 2: Foreign Key Constraint Violations

**Problem**: Cannot create foreign key due to orphaned records

**Solution**:
```sql
-- Find orphaned records
SELECT * FROM child_table WHERE parent_id NOT IN (SELECT id FROM parent_table);

-- Clean up orphaned records
DELETE FROM child_table WHERE parent_id NOT IN (SELECT id FROM parent_table);
```

### Issue 3: Index Creation Timeout

**Problem**: Creating indexes on large tables times out

**Solution**:
```sql
-- Create indexes with progress monitoring
CREATE INDEX CONCURRENTLY idx_name ON table_name(column);

-- Or increase timeout
SET statement_timeout = '10min';
CREATE INDEX idx_name ON table_name(column);
```

### Issue 4: Disk Space During Migration

**Problem**: Not enough disk space for migration

**Solution**:
```bash
# Check disk space
df -h

# Clean old backups
python scripts/database/backup_database.py --cleanup

# Use external backup location
python scripts/database/backup_database.py --backup-dir /external/drive/backups
```

## Security Considerations

### 1. Credential Migration

When migrating from V1:
```bash
# V1 credentials are plain text, V2 requires encryption
# After migration, immediately encrypt:
python scripts/security/encrypt_credentials.py --all-users
```

### 2. Access Control

```bash
# Ensure proper database permissions
# For PostgreSQL:
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fossawork_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO fossawork_app;

# Restrict migration privileges
GRANT ALL ON TABLE schema_migrations TO fossawork_admin;
```

### 3. Audit Trail

All migrations are logged in the audit trail:
```sql
-- View migration audit trail
SELECT * FROM audit_trail 
WHERE table_name = 'schema_migrations'
ORDER BY created_at DESC;
```

## Monitoring Migrations

### Health Checks

```python
from app.core.migration_manager import get_migration_manager

manager = get_migration_manager()

# Check migration health
if manager.check_migration_needed():
    print("WARNING: Pending migrations detected")

# Get migration history
history = manager.get_migration_history(limit=10)
for migration in history:
    print(f"{migration['version']}: {migration['status']} "
          f"({migration['execution_time_ms']}ms)")
```

### Metrics and Alerts

Monitor these metrics:

1. **Migration Duration**: Track execution time
2. **Migration Failures**: Alert on failed migrations
3. **Pending Migrations**: Alert if migrations are pending
4. **Schema Drift**: Detect unauthorized schema changes

### Logging

All migrations are logged to:
- Application logs: `logs/backend/migration-{date}.log`
- Database: `schema_migrations` table
- Audit trail: `audit_trail` table

## Best Practices

1. **Always Backup First**: Never skip the backup step
2. **Test in Development**: Run migrations in dev before production
3. **Monitor Performance**: Large migrations may impact performance
4. **Coordinate Deployments**: Ensure application and database changes are synchronized
5. **Document Changes**: Update this guide with any new procedures
6. **Review Dependencies**: Check migration dependencies before running
7. **Validate After Migration**: Always run validation after migrations

## Zero-Downtime Migration Strategies

For production deployments:

1. **Blue-Green Deployment**
   - Migrate to new database instance
   - Switch traffic when ready

2. **Parallel Running**
   - Run old and new schema in parallel
   - Gradually migrate data

3. **Feature Flags**
   - Deploy code that works with both schemas
   - Migrate database
   - Remove compatibility code

## Support and Troubleshooting

If you encounter issues:

1. Check the logs: `logs/backend/migration-*.log`
2. Run validation: `python scripts/database/validate_migration.py`
3. Review migration status: `python migrations/migration_runner.py status`
4. Consult the audit trail for what changed
5. Use backups to recover if needed

Remember: **When in doubt, backup and validate!**