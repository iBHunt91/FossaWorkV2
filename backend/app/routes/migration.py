"""
V1 to V2 Data Migration API Routes

Complete migration system for converting V1 file-based user data 
to V2 PostgreSQL database with validation and rollback capabilities.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Query
from sqlalchemy.orm import Session
import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
import hashlib
from pathlib import Path

from ..database import get_db
from ..services.user_management import UserManagementService
from ..services.logging_service import LoggingService
from ..models.user_schemas import (
    V1UserMigration, V1MigrationRequest, MigrationValidationResult,
    UserCreate, UserUpdate, APIResponse, UserResponse
)
from ..models.user_models import generate_user_id

router = APIRouter(prefix="/api/migration", tags=["migration"])

def get_user_service(db: Session = Depends(get_db)) -> UserManagementService:
    return UserManagementService(db)

def get_logging_service(db: Session = Depends(get_db)) -> LoggingService:
    return LoggingService(db)

# ===== V1 USER MIGRATION =====

@router.post("/v1-users")
async def migrate_v1_users(
    v1_users: List[V1UserMigration],
    background_tasks: BackgroundTasks,
    dry_run: bool = Query(False, description="Preview migration without making changes"),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Migrate V1 users.json data to V2 database"""
    try:
        migration_results = {
            "dry_run": dry_run,
            "total_users": len(v1_users),
            "migrated_users": [],
            "skipped_users": [],
            "errors": []
        }
        
        for user_data in v1_users:
            try:
                # Validate V1 user ID matches expected MD5
                expected_id = generate_user_id(user_data.email)
                if user_data.id != expected_id:
                    error_msg = f"V1 user ID mismatch: {user_data.id} != {expected_id}"
                    migration_results["errors"].append({
                        "user": user_data.email,
                        "error": error_msg
                    })
                    continue
                
                # Check if user already exists
                existing_user = user_service.get_user_by_email(user_data.email)
                if existing_user:
                    migration_results["skipped_users"].append({
                        "user_id": user_data.id,
                        "email": user_data.email,
                        "reason": "User already exists in V2"
                    })
                    continue
                
                if not dry_run:
                    # Convert V1 notification settings to V2 format
                    notification_settings = user_data.notification_settings
                    
                    # Create user with V1 data
                    user_create = UserCreate(
                        email=user_data.email,
                        password=user_data.password,  # V1 had plaintext, will be hashed
                        label=user_data.label,
                        friendly_name=user_data.friendly_name,
                        configured_email=user_data.configured_email,
                        notification_settings=notification_settings
                    )
                    
                    # Create user (this will generate correct MD5 ID)
                    db_user = user_service.create_user(user_create)
                    
                    # Update timestamps to match V1
                    if user_data.last_used:
                        try:
                            last_used = datetime.fromisoformat(user_data.last_used.replace('Z', '+00:00'))
                            db_user.last_used = last_used
                            user_service.db.commit()
                        except:
                            pass  # Use current timestamp if parsing fails
                    
                    # Migrate notification settings to user preferences
                    if notification_settings:
                        user_service.set_user_preference(
                            db_user.id,
                            "notification",
                            notification_settings
                        )
                    
                    migration_results["migrated_users"].append({
                        "user_id": db_user.id,
                        "email": db_user.email,
                        "label": db_user.label
                    })
                else:
                    # Dry run - just validate
                    migration_results["migrated_users"].append({
                        "user_id": user_data.id,
                        "email": user_data.email,
                        "label": user_data.label,
                        "would_migrate": True
                    })
                
            except Exception as e:
                migration_results["errors"].append({
                    "user": user_data.email,
                    "error": str(e)
                })
        
        # Log migration
        if not dry_run:
            background_tasks.add_task(
                logging_service.log_info,
                f"V1 user migration completed: {len(migration_results['migrated_users'])} users migrated"
            )
        
        return {
            "success": True,
            "message": f"{'Dry run completed' if dry_run else 'Migration completed'}",
            "results": migration_results
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"User migration failed: {str(e)}"
        )

@router.post("/v1-user-data/{user_id}")
async def migrate_v1_user_data(
    user_id: str,
    file_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    dry_run: bool = Query(False, description="Preview migration without making changes"),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Migrate V1 user directory data to V2 database"""
    try:
        # Verify user exists
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found. Migrate users first."
            )
        
        migration_results = {
            "dry_run": dry_run,
            "user_id": user_id,
            "user_email": user.email,
            "migrated_data": {},
            "errors": []
        }
        
        # Migrate prover preferences
        if "prover_preferences" in file_data:
            try:
                prover_data = file_data["prover_preferences"]
                if not dry_run:
                    user_service.set_user_preference(user_id, "prover", prover_data)
                migration_results["migrated_data"]["prover_preferences"] = "migrated"
            except Exception as e:
                migration_results["errors"].append(f"Prover preferences: {str(e)}")
        
        # Migrate email settings
        if "email_settings" in file_data:
            try:
                email_data = file_data["email_settings"]
                if not dry_run:
                    user_service.set_user_preference(user_id, "email", email_data)
                migration_results["migrated_data"]["email_settings"] = "migrated"
            except Exception as e:
                migration_results["errors"].append(f"Email settings: {str(e)}")
        
        # Migrate pushover settings
        if "pushover_settings" in file_data:
            try:
                pushover_data = file_data["pushover_settings"]
                if not dry_run:
                    user_service.set_user_preference(user_id, "pushover", pushover_data)
                migration_results["migrated_data"]["pushover_settings"] = "migrated"
            except Exception as e:
                migration_results["errors"].append(f"Pushover settings: {str(e)}")
        
        # Migrate activity log
        if "activity_log" in file_data:
            try:
                activities = file_data["activity_log"]
                if not dry_run:
                    for activity in activities:
                        user_service.track_activity(
                            user_id=activity.get("userId", user_id),
                            username=activity.get("username", user.email),
                            activity_type=activity.get("activityType", "migrated_activity"),
                            details=activity.get("details", {})
                        )
                migration_results["migrated_data"]["activity_log"] = f"migrated {len(activities)} activities"
            except Exception as e:
                migration_results["errors"].append(f"Activity log: {str(e)}")
        
        # Migrate dispenser data
        if "dispenser_store" in file_data:
            try:
                dispenser_data = file_data["dispenser_store"]
                dispenser_count = 0
                
                if not dry_run:
                    for work_order_id, data in dispenser_data.get("dispenserData", {}).items():
                        from ..models.user_schemas import DispenserData
                        
                        dispenser_obj = DispenserData(
                            work_order_id=work_order_id,
                            visit_id=data.get("visitId"),
                            dispenser_data=data,
                            meta_data={"migrated_from_v1": True, "migration_timestamp": datetime.utcnow().isoformat()}
                        )
                        
                        user_service.save_dispenser_data(user_id, dispenser_obj)
                        dispenser_count += 1
                
                migration_results["migrated_data"]["dispenser_data"] = f"migrated {dispenser_count} work orders"
            except Exception as e:
                migration_results["errors"].append(f"Dispenser data: {str(e)}")
        
        # Migrate completed jobs
        if "completed_jobs" in file_data:
            try:
                completed_jobs = file_data["completed_jobs"]
                if not dry_run:
                    for job in completed_jobs:
                        user_service.save_completed_job(
                            user_id,
                            job.get("job_id", "unknown"),
                            job.get("work_order_id"),
                            job.get("completion_date"),
                            job,
                            "Migrated from V1"
                        )
                migration_results["migrated_data"]["completed_jobs"] = f"migrated {len(completed_jobs)} jobs"
            except Exception as e:
                migration_results["errors"].append(f"Completed jobs: {str(e)}")
        
        # Migrate schedule changes
        if "schedule_changes" in file_data:
            try:
                # V1 stored as text file, convert to structured data
                schedule_text = file_data["schedule_changes"]
                if schedule_text and not dry_run:
                    user_service.save_schedule_change(
                        user_id,
                        "migrated_changes",
                        {"migrated_text": schedule_text},
                        schedule_text
                    )
                migration_results["migrated_data"]["schedule_changes"] = "migrated"
            except Exception as e:
                migration_results["errors"].append(f"Schedule changes: {str(e)}")
        
        # Migrate batch history
        if "batch_history" in file_data:
            try:
                batch_history = file_data["batch_history"]
                if not dry_run:
                    for batch in batch_history:
                        user_service.save_batch_history(
                            user_id,
                            batch.get("batch_id", "migrated_batch"),
                            batch.get("batch_type", "migrated"),
                            batch.get("work_orders", []),
                            batch.get("results", {}),
                            batch.get("started_at"),
                            batch.get("completed_at"),
                            batch.get("status", "completed")
                        )
                migration_results["migrated_data"]["batch_history"] = f"migrated {len(batch_history)} batches"
            except Exception as e:
                migration_results["errors"].append(f"Batch history: {str(e)}")
        
        # Log migration
        if not dry_run:
            background_tasks.add_task(
                logging_service.log_info,
                f"V1 data migration completed for user {user.email}: {migration_results['migrated_data']}"
            )
        
        return {
            "success": True,
            "message": f"{'Dry run completed' if dry_run else 'Data migration completed'}",
            "results": migration_results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"User data migration failed: {str(e)}"
        )

# ===== VALIDATION =====

@router.get("/validation/{user_id}", response_model=MigrationValidationResult)
async def validate_migration(
    user_id: str,
    user_service: UserManagementService = Depends(get_user_service)
):
    """Validate that V1 user data was migrated correctly"""
    try:
        user = user_service.get_user(user_id)
        if not user:
            return MigrationValidationResult(
                user_id=user_id,
                valid=False,
                validation_results={},
                error="User not found"
            )
        
        validation_results = {
            "user_exists": True,
            "user_id_format": len(user_id) == 32 and user_id.isalnum(),  # MD5 format
            "email_matches_id": generate_user_id(user.email) == user_id,
            "has_preferences": {},
            "has_activities": False,
            "has_dispenser_data": False,
            "has_notification_settings": user.notification_settings is not None,
            "timestamps_valid": user.created_at is not None and user.last_used is not None
        }
        
        # Check preferences
        preference_categories = ["email", "pushover", "prover", "work_week", "notification"]
        for category in preference_categories:
            pref = user_service.get_user_preference(user_id, category)
            validation_results["has_preferences"][category] = pref is not None
        
        # Check activities
        activities = user_service.get_user_activities(user_id, 1)
        validation_results["has_activities"] = len(activities) > 0
        
        # Check dispenser data
        dispenser_data = user_service.get_user_dispenser_data(user_id)
        validation_results["has_dispenser_data"] = len(dispenser_data) > 0
        
        # Overall validation
        critical_checks = [
            validation_results["user_exists"],
            validation_results["user_id_format"],
            validation_results["email_matches_id"],
            validation_results["timestamps_valid"]
        ]
        
        is_valid = all(critical_checks)
        
        return MigrationValidationResult(
            user_id=user_id,
            valid=is_valid,
            validation_results=validation_results
        )
        
    except Exception as e:
        return MigrationValidationResult(
            user_id=user_id,
            valid=False,
            validation_results={},
            error=str(e)
        )

@router.post("/validate-all")
async def validate_all_migrations(
    user_service: UserManagementService = Depends(get_user_service)
):
    """Validate all migrated users"""
    try:
        users = user_service.get_all_users()
        validation_results = []
        
        for user in users:
            result = await validate_migration(user.id, user_service)
            validation_results.append(result)
        
        # Summary statistics
        total_users = len(validation_results)
        valid_users = sum(1 for r in validation_results if r.valid)
        invalid_users = total_users - valid_users
        
        return {
            "success": True,
            "summary": {
                "total_users": total_users,
                "valid_users": valid_users,
                "invalid_users": invalid_users,
                "validation_rate": f"{(valid_users / total_users * 100):.1f}%" if total_users > 0 else "0%"
            },
            "detailed_results": validation_results
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Validation failed: {str(e)}"
        )

# ===== FILE-BASED MIGRATION =====

@router.post("/v1-directory")
async def migrate_v1_directory(
    v1_data_path: str,
    background_tasks: BackgroundTasks,
    dry_run: bool = Query(False, description="Preview migration without making changes"),
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Migrate entire V1 data directory structure"""
    try:
        v1_path = Path(v1_data_path)
        if not v1_path.exists():
            raise HTTPException(status_code=404, detail="V1 data directory not found")
        
        migration_results = {
            "dry_run": dry_run,
            "v1_path": str(v1_path),
            "users_processed": [],
            "global_settings": None,
            "tutorial_data": None,
            "errors": []
        }
        
        # Load users.json
        users_file = v1_path / "users" / "users.json"
        if users_file.exists():
            try:
                with open(users_file, 'r') as f:
                    users_data = json.load(f)
                
                # Migrate users
                user_migration_result = await migrate_v1_users(
                    [V1UserMigration(**user) for user in users_data],
                    background_tasks,
                    dry_run,
                    user_service,
                    logging_service
                )
                
                migration_results["users_processed"] = user_migration_result["results"]
                
                # Migrate individual user data
                for user in users_data:
                    user_id = user["id"]
                    user_dir = v1_path / "users" / user_id
                    
                    if user_dir.exists():
                        # Load all user files
                        user_files = {}
                        for file_path in user_dir.glob("*.json"):
                            try:
                                with open(file_path, 'r') as f:
                                    key = file_path.stem.replace('_', '_')
                                    user_files[key] = json.load(f)
                            except Exception as e:
                                migration_results["errors"].append(f"Failed to load {file_path}: {str(e)}")
                        
                        # Load text files
                        schedule_changes_file = user_dir / "schedule_changes.txt"
                        if schedule_changes_file.exists():
                            try:
                                with open(schedule_changes_file, 'r') as f:
                                    user_files["schedule_changes"] = f.read()
                            except Exception as e:
                                migration_results["errors"].append(f"Failed to load schedule_changes.txt: {str(e)}")
                        
                        # Migrate user data
                        if user_files:
                            await migrate_v1_user_data(
                                user_id,
                                user_files,
                                background_tasks,
                                dry_run,
                                user_service,
                                logging_service
                            )
                
            except Exception as e:
                migration_results["errors"].append(f"Failed to process users.json: {str(e)}")
        
        # Load global settings
        settings_file = v1_path / "settings.json"
        if settings_file.exists():
            try:
                with open(settings_file, 'r') as f:
                    settings_data = json.load(f)
                
                if not dry_run:
                    # Migrate global settings
                    user_service.set_global_setting("v1_settings", settings_data)
                
                migration_results["global_settings"] = "migrated"
            except Exception as e:
                migration_results["errors"].append(f"Failed to migrate settings.json: {str(e)}")
        
        # Load tutorial data
        tutorial_dir = v1_path / "users" / "tutorial"
        if tutorial_dir.exists():
            try:
                tutorial_files = {}
                for file_path in tutorial_dir.glob("*.json"):
                    with open(file_path, 'r') as f:
                        tutorial_files[file_path.stem] = json.load(f)
                
                if not dry_run and tutorial_files:
                    for data_type, data in tutorial_files.items():
                        user_service.save_tutorial_data(data_type, data, f"Migrated from V1 {data_type}")
                
                migration_results["tutorial_data"] = f"migrated {len(tutorial_files)} files"
            except Exception as e:
                migration_results["errors"].append(f"Failed to migrate tutorial data: {str(e)}")
        
        # Log migration
        if not dry_run:
            background_tasks.add_task(
                logging_service.log_info,
                f"Complete V1 directory migration: {len(migration_results['users_processed'])} users, "
                f"{len(migration_results['errors'])} errors"
            )
        
        return {
            "success": True,
            "message": f"{'Dry run completed' if dry_run else 'Complete directory migration completed'}",
            "results": migration_results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Directory migration failed: {str(e)}"
        )

# ===== ROLLBACK =====

@router.post("/rollback/{user_id}")
async def rollback_user_migration(
    user_id: str,
    background_tasks: BackgroundTasks,
    user_service: UserManagementService = Depends(get_user_service),
    logging_service: LoggingService = Depends(get_logging_service)
):
    """Rollback user migration (delete all V2 data for user)"""
    try:
        user = user_service.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_email = user.email
        
        # Delete user (cascades to all related data)
        success = user_service.delete_user(user_id)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to rollback user migration"
            )
        
        # Log rollback
        background_tasks.add_task(
            logging_service.log_info,
            f"User migration rolled back: {user_email} ({user_id})"
        )
        
        return {
            "success": True,
            "message": f"Migration rollback completed for user {user_email}",
            "user_id": user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Rollback failed: {str(e)}"
        )

# ===== MIGRATION STATUS =====

@router.get("/status")
async def get_migration_status(
    user_service: UserManagementService = Depends(get_user_service)
):
    """Get overall migration status and statistics"""
    try:
        users = user_service.get_all_users()
        
        # Count users with migration metadata
        migrated_users = 0
        native_v2_users = 0
        
        for user in users:
            # Check if user has migration metadata in preferences or activities
            activities = user_service.get_user_activities(user.id, 10)
            has_migration_activity = any(
                "migrated" in activity.details.get("action", "").lower() or
                activity.details.get("migrated_from_v1", False)
                for activity in activities
            )
            
            if has_migration_activity:
                migrated_users += 1
            else:
                native_v2_users += 1
        
        # Get validation statistics
        validation_result = await validate_all_migrations(user_service)
        
        return {
            "success": True,
            "migration_status": {
                "total_users": len(users),
                "migrated_from_v1": migrated_users,
                "native_v2_users": native_v2_users,
                "validation_summary": validation_result["summary"]
            },
            "last_updated": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get migration status: {str(e)}"
        )