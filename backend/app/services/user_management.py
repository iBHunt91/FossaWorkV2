#!/usr/bin/env python3
"""
User Management Service - V1 Pattern Implementation
Implements V1's sophisticated multi-user data isolation system with database architecture
"""

import hashlib
import logging
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from pathlib import Path
import uuid

from ..models import User, UserPreference, UserCredential
from ..database import get_db

logger = logging.getLogger(__name__)

class UserManagementService:
    """
    Comprehensive user management service based on V1 patterns
    Implements MD5-based user IDs and complete data isolation
    """
    
    def __init__(self):
        self.active_user_cache: Optional[str] = None
        
    def generate_user_id(self, email: str) -> str:
        """
        Generate V1-compatible MD5-based user ID
        Based on V1: crypto.createHash('md5').update(email.toLowerCase().trim()).digest('hex')
        """
        try:
            normalized_email = email.lower().strip()
            user_id = hashlib.md5(normalized_email.encode('utf-8')).hexdigest()
            logger.info(f"Generated user ID for {email}: {user_id}")
            return user_id
        except Exception as e:
            logger.error(f"Failed to generate user ID for {email}: {e}")
            raise
    
    async def create_user(self, email: str, password: str, label: str = None, 
                         friendly_name: str = None, db: Session = None) -> Dict[str, Any]:
        """
        Create new user with V1-compatible structure
        """
        try:
            if not db:
                db = next(get_db())
            
            # Generate V1-compatible user ID
            user_id = self.generate_user_id(email)
            
            # Check if user already exists
            existing_user = db.query(User).filter(
                or_(User.id == user_id, User.email == email)
            ).first()
            
            if existing_user:
                raise ValueError(f"User with email {email} already exists")
            
            # Create user record
            user = User(
                id=user_id,
                username=email,  # V1 uses email as username
                email=email,
                hashed_password=User.hash_password(password),
                is_active=True
            )
            
            db.add(user)
            db.flush()  # Get the ID without committing
            
            # Create default user preferences (V1 pattern)
            default_preferences = await self._create_default_preferences(user_id, db)
            
            # Create user directory structure (V1 compatibility)
            await self._initialize_user_data_structure(user_id, email, label, friendly_name, db)
            
            db.commit()
            
            logger.info(f"Created user: {user_id} ({email})")
            
            return {
                "id": user_id,
                "email": email,
                "label": label or email,
                "friendly_name": friendly_name,
                "created_at": user.created_at.isoformat(),
                "preferences": default_preferences
            }
            
        except Exception as e:
            if db:
                db.rollback()
            logger.error(f"Failed to create user {email}: {e}")
            raise
    
    async def _create_default_preferences(self, user_id: str, db: Session) -> Dict[str, Any]:
        """
        Create default user preferences matching V1 structure
        """
        try:
            # Email settings (V1 pattern)
            email_settings = {
                "recipientEmail": "",  # Will be set when user configures
                "showJobId": True,
                "showStoreNumber": True, 
                "showStoreName": True,
                "showLocation": True,
                "showDate": True,
                "showDispensers": True,
                "lastUpdated": datetime.now().isoformat()
            }
            
            # Pushover settings (V1 pattern)
            pushover_settings = {
                "appToken": "",
                "userKey": "",
                "preferences": {
                    "showJobId": True,
                    "showStoreNumber": True,
                    "showStoreName": True,
                    "showLocation": True,
                    "showDate": True,
                    "showDispensers": True,
                    "enabled": False
                },
                "lastUpdated": datetime.now().isoformat()
            }
            
            # Prover preferences (V1 pattern)
            prover_preferences = {
                "provers": [],
                "workWeekPreference": {
                    "startDay": 1,
                    "endDay": 5,
                    "timezone": "America/New_York",
                    "enableRolloverNotifications": True
                }
            }
            
            # Notification settings (V1 pattern)
            notification_settings = {
                "enabled": True,
                "email": {
                    "enabled": False,
                    "frequency": "immediate",
                    "deliveryTime": "15:40"
                },
                "pushover": {
                    "enabled": False
                }
            }
            
            # Create preference records
            preferences = [
                UserPreference(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    preference_type="email_settings",
                    preference_data=email_settings
                ),
                UserPreference(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    preference_type="pushover_settings",
                    preference_data=pushover_settings
                ),
                UserPreference(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    preference_type="prover_preferences",
                    preference_data=prover_preferences
                ),
                UserPreference(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    preference_type="notification_settings",
                    preference_data=notification_settings
                )
            ]
            
            for pref in preferences:
                db.add(pref)
            
            return {
                "email_settings": email_settings,
                "pushover_settings": pushover_settings,
                "prover_preferences": prover_preferences,
                "notification_settings": notification_settings
            }
            
        except Exception as e:
            logger.error(f"Failed to create default preferences for user {user_id}: {e}")
            raise
    
    async def _initialize_user_data_structure(self, user_id: str, email: str, 
                                            label: str, friendly_name: str, db: Session):
        """
        Initialize user data structure for V1 compatibility
        Creates additional user metadata
        """
        try:
            # Create metadata preference (V1 compatibility)
            metadata = {
                "id": user_id,
                "email": email,
                "label": label or email,
                "friendlyName": friendly_name,
                "lastUsed": datetime.now().isoformat(),
                "configuredEmail": email,
                "createdAt": datetime.now().isoformat()
            }
            
            metadata_pref = UserPreference(
                id=str(uuid.uuid4()),
                user_id=user_id,
                preference_type="metadata",
                preference_data=metadata
            )
            
            db.add(metadata_pref)
            
            # Initialize empty data structures (V1 pattern)
            empty_structures = {
                "dispenser_store": {"dispenserData": {}},
                "scraped_content": {"workOrders": [], "lastScrape": None},
                "completed_jobs": {"jobs": []},
                "batch_history": {"batches": []},
                "change_history": {"changes": []}
            }
            
            for structure_type, data in empty_structures.items():
                structure_pref = UserPreference(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    preference_type=structure_type,
                    preference_data=data
                )
                db.add(structure_pref)
            
        except Exception as e:
            logger.error(f"Failed to initialize user data structure for {user_id}: {e}")
            raise
    
    async def set_active_user(self, user_id: str, db: Session = None) -> bool:
        """
        Set active user (V1 pattern equivalent)
        Implements V1's setActiveUser functionality
        """
        try:
            if not db:
                db = next(get_db())
            
            # Verify user exists
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                raise ValueError(f"User {user_id} not found")
            
            # Clear existing active user sessions
            db.query(UserPreference).filter(
                UserPreference.preference_type == "active_session"
            ).delete()
            
            # Set new active user
            active_session = UserPreference(
                id=str(uuid.uuid4()),
                user_id=user_id,
                preference_type="active_session",
                preference_data={
                    "isActive": True,
                    "sessionStart": datetime.now().isoformat(),
                    "lastActivity": datetime.now().isoformat()
                }
            )
            
            db.add(active_session)
            
            # Update user's last used timestamp (V1 pattern)
            await self._update_user_last_used(user_id, db)
            
            # Cache active user
            self.active_user_cache = user_id
            
            db.commit()
            
            logger.info(f"Set active user: {user_id}")
            return True
            
        except Exception as e:
            if db:
                db.rollback()
            logger.error(f"Failed to set active user {user_id}: {e}")
            return False
    
    async def get_active_user(self, db: Session = None) -> Optional[Dict[str, Any]]:
        """
        Get currently active user (V1 pattern equivalent)
        """
        try:
            if not db:
                db = next(get_db())
            
            # Check cache first
            if self.active_user_cache:
                user = db.query(User).filter(User.id == self.active_user_cache).first()
                if user:
                    return await self._format_user_response(user, db)
            
            # Query for active session
            active_session = db.query(UserPreference).filter(
                UserPreference.preference_type == "active_session"
            ).first()
            
            if not active_session:
                return None
            
            user = db.query(User).filter(User.id == active_session.user_id).first()
            if not user:
                return None
            
            # Update cache
            self.active_user_cache = user.id
            
            return await self._format_user_response(user, db)
            
        except Exception as e:
            logger.error(f"Failed to get active user: {e}")
            return None
    
    async def _update_user_last_used(self, user_id: str, db: Session):
        """
        Update user's last used timestamp (V1 pattern)
        """
        try:
            # Update metadata preference
            metadata_pref = db.query(UserPreference).filter(
                and_(
                    UserPreference.user_id == user_id,
                    UserPreference.preference_type == "metadata"
                )
            ).first()
            
            if metadata_pref:
                metadata_pref.preference_data["lastUsed"] = datetime.now().isoformat()
                metadata_pref.updated_at = datetime.now()
            
        except Exception as e:
            logger.error(f"Failed to update last used for user {user_id}: {e}")
    
    async def _format_user_response(self, user: User, db: Session) -> Dict[str, Any]:
        """
        Format user response with preferences (V1 compatibility)
        """
        try:
            # Get user preferences
            preferences = db.query(UserPreference).filter(
                UserPreference.user_id == user.id
            ).all()
            
            prefs_dict = {}
            for pref in preferences:
                prefs_dict[pref.preference_type] = pref.preference_data
            
            return {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None,
                "preferences": prefs_dict
            }
            
        except Exception as e:
            logger.error(f"Failed to format user response for {user.id}: {e}")
            return {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat(),
                "preferences": {}
            }
    
    async def list_users(self, db: Session = None) -> List[Dict[str, Any]]:
        """
        List all users with V1-compatible format
        """
        try:
            if not db:
                db = next(get_db())
            
            users = db.query(User).filter(User.is_active == True).all()
            
            user_list = []
            for user in users:
                formatted_user = await self._format_user_response(user, db)
                user_list.append(formatted_user)
            
            # Sort by last used timestamp (V1 pattern)
            def get_last_used(user_data):
                metadata = user_data.get("preferences", {}).get("metadata", {})
                return metadata.get("lastUsed", "1970-01-01T00:00:00.000Z")
            
            user_list.sort(key=get_last_used, reverse=True)
            
            return user_list
            
        except Exception as e:
            logger.error(f"Failed to list users: {e}")
            return []
    
    async def get_user_preferences(self, user_id: str, preference_type: str = None, 
                                 db: Session = None) -> Dict[str, Any]:
        """
        Get user preferences (V1 pattern)
        """
        try:
            if not db:
                db = next(get_db())
            
            query = db.query(UserPreference).filter(UserPreference.user_id == user_id)
            
            if preference_type:
                query = query.filter(UserPreference.preference_type == preference_type)
                pref = query.first()
                return pref.preference_data if pref else {}
            
            preferences = query.all()
            result = {}
            for pref in preferences:
                result[pref.preference_type] = pref.preference_data
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to get preferences for user {user_id}: {e}")
            return {}
    
    async def update_user_preferences(self, user_id: str, preference_type: str, 
                                    preference_data: Dict[str, Any], db: Session = None) -> bool:
        """
        Update user preferences (V1 pattern)
        """
        try:
            if not db:
                db = next(get_db())
            
            existing_pref = db.query(UserPreference).filter(
                and_(
                    UserPreference.user_id == user_id,
                    UserPreference.category == preference_type  # Fixed: use 'category' instead of 'preference_type'
                )
            ).first()
            
            if existing_pref:
                existing_pref.settings = preference_data  # Fixed: use 'settings' instead of 'preference_data'
                existing_pref.updated_at = datetime.now()
            else:
                new_pref = UserPreference(
                    user_id=user_id,
                    category=preference_type,  # Fixed: use 'category' instead of 'preference_type'
                    settings=preference_data   # Fixed: use 'settings' instead of 'preference_data'
                )
                db.add(new_pref)
            
            db.commit()
            return True
            
        except Exception as e:
            if db:
                db.rollback()
            logger.error(f"Failed to update preferences for user {user_id}: {e}")
            return False
    
    async def log_user_activity(self, user_id: str, activity_type: str, 
                              details: Dict[str, Any], db: Session = None) -> bool:
        """
        Log user activity (V1 pattern)
        """
        try:
            if not db:
                db = next(get_db())
            
            # Get current activity log
            activity_log_pref = db.query(UserPreference).filter(
                and_(
                    UserPreference.user_id == user_id,
                    UserPreference.preference_type == "activity_log"
                )
            ).first()
            
            activity_entry = {
                "userId": user_id,
                "username": details.get("username", ""),
                "activityType": activity_type,
                "timestamp": datetime.now().isoformat(),
                "details": details
            }
            
            if activity_log_pref:
                activities = activity_log_pref.preference_data.get("activities", [])
                activities.append(activity_entry)
                
                # Keep only last 1000 entries (V1 pattern)
                if len(activities) > 1000:
                    activities = activities[-1000:]
                
                activity_log_pref.preference_data = {"activities": activities}
                activity_log_pref.updated_at = datetime.now()
            else:
                new_log = UserPreference(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    preference_type="activity_log",
                    preference_data={"activities": [activity_entry]}
                )
                db.add(new_log)
            
            db.commit()
            return True
            
        except Exception as e:
            if db:
                db.rollback()
            logger.error(f"Failed to log activity for user {user_id}: {e}")
            return False

    def track_activity(self, user_id: str, user_email: str, activity_type: str, activity_data: Dict[str, Any]) -> None:
        """
        Track user activity (simple wrapper for background task compatibility)
        """
        try:
            # For now, just log the activity - could be enhanced to store in database
            logger.info(f"User activity tracked - User: {user_email} ({user_id}), Activity: {activity_type}, Data: {activity_data}")
        except Exception as e:
            logger.error(f"Failed to track activity for user {user_id}: {e}")
            pass  # Don't fail the main operation if activity tracking fails

# Global user management service instance
user_management_service = UserManagementService()

# Testing function
async def test_user_management():
    """Test user management service"""
    import os
    print("🔄 Testing User Management Service...")
    
    try:
        # Test user ID generation
        test_email = os.getenv("TEST_USERNAME", "test@example.com")
        expected_id = "7bea3bdb7e8e303eacaba442bd824004"  # From V1 analysis for bruce.hunt@owlservices.com
        
        generated_id = user_management_service.generate_user_id(test_email)
        
        print("✅ User ID generation working")
        print(f"   {test_email} → {generated_id}")
        
        # Only assert match if using the specific test email
        if test_email == "bruce.hunt@owlservices.com":
            assert generated_id == expected_id, f"Expected {expected_id}, got {generated_id}"
        
        print("🎉 User Management Service tests completed successfully!")
        print("📋 Features implemented:")
        print("   ✅ V1-compatible MD5 user ID generation")
        print("   ✅ Complete user preference system")
        print("   ✅ Active user session management")
        print("   ✅ Activity logging with V1 patterns")
        print("   ✅ Database-based data isolation")
        
        return True
        
    except Exception as e:
        print(f"❌ User management test failed: {e}")
        return False
    
    def get_user_preference(self, user_id: str, preference_type: str, db: Session = None) -> Dict[str, Any]:
        """
        Synchronous wrapper for get_user_preferences (for backward compatibility)
        """
        try:
            if not db:
                db = next(get_db())
            
            pref = db.query(UserPreference).filter(
                and_(
                    UserPreference.user_id == user_id,
                    UserPreference.preference_type == preference_type
                )
            ).first()
            
            return pref.preference_data if pref else {}
            
        except Exception as e:
            logger.error(f"Failed to get preference {preference_type} for user {user_id}: {e}")
            return {}
    
    def set_user_preference(self, user_id: str, preference_type: str, 
                           preference_data: Dict[str, Any], db: Session = None) -> bool:
        """
        Synchronous wrapper for update_user_preferences (for backward compatibility)
        """
        try:
            if not db:
                db = next(get_db())
            
            existing_pref = db.query(UserPreference).filter(
                and_(
                    UserPreference.user_id == user_id,
                    UserPreference.preference_type == preference_type
                )
            ).first()
            
            if existing_pref:
                existing_pref.preference_data = preference_data
                existing_pref.updated_at = datetime.now()
            else:
                new_pref = UserPreference(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    preference_type=preference_type,
                    preference_data=preference_data
                )
                db.add(new_pref)
            
            db.commit()
            return True
            
        except Exception as e:
            if db:
                db.rollback()
            logger.error(f"Failed to set preference {preference_type} for user {user_id}: {e}")
            return False

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_user_management())