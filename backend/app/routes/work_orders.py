#!/usr/bin/env python3
"""
Work Order API routes - Clean RESTful endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Dict, Any
import uuid
import logging
import asyncio
from datetime import datetime

from ..database import get_db
from ..models import User, WorkOrder, Dispenser
from ..utils.query_profiler import QueryProfiler
from ..services.browser_automation import browser_automation, BrowserAutomationService
from ..services.workfossa_scraper import WorkOrderData
from ..core.security_deps import require_auth, require_user_access, log_security_violation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/work-orders", tags=["work-orders"])

# Global dictionary to track scraping progress with TTL cleanup
from threading import Timer

scraping_progress = {}

def cleanup_scraping_progress(progress_key: str):
    """Remove scraping progress after completion"""
    if progress_key in scraping_progress:
        logger.info(f"[CLEANUP] Removing completed progress: {progress_key}")
        del scraping_progress[progress_key]
        
def schedule_scraping_cleanup(progress_key: str, delay_minutes: int = 15):
    """Schedule cleanup of scraping progress after delay"""
    timer = Timer(delay_minutes * 60, cleanup_scraping_progress, args=[progress_key])
    timer.start()
    return timer

def cleanup_user_progress(user_id: str):
    """Clean up all progress entries for a specific user"""
    keys_to_remove = []
    for key in scraping_progress.keys():
        if key == user_id or key.startswith(f"single_dispenser_{user_id}_") or key == f"dispensers_{user_id}":
            keys_to_remove.append(key)
    
    for key in keys_to_remove:
        logger.info(f"[CLEANUP] Removing user progress: {key}")
        del scraping_progress[key]

@router.get("/test")
async def test_endpoint(current_user: User = Depends(require_auth)):
    """Test endpoint to verify router is working"""
    return {"message": "Work orders router is working", "timestamp": datetime.now().isoformat()}

@router.get("/debug/last-scrape")
async def debug_last_scrape(current_user: User = Depends(require_auth)):
    """Debug endpoint to check the last scraping attempt"""
    import os
    
    # Check for recent screenshots
    screenshots = []
    screenshot_dirs = [
        "/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend/screenshots",
        "/Users/ibhunt/Documents/GitHub/FossaWorkV2/backend"
    ]
    
    for screenshot_dir in screenshot_dirs:
        if os.path.exists(screenshot_dir):
            for file in os.listdir(screenshot_dir):
                if "pagesize" in file.lower() or "workfossa" in file.lower():
                    file_path = os.path.join(screenshot_dir, file)
                    if os.path.isfile(file_path):
                        stat = os.stat(file_path)
                        screenshots.append({
                            "name": file,
                            "path": file_path,
                            "size": stat.st_size,
                            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
                        })
    
    # Sort by modification time
    screenshots.sort(key=lambda x: x["modified"], reverse=True)
    
    return {
        "message": "Debug info for last scraping attempt",
        "timestamp": datetime.now().isoformat(),
        "recent_screenshots": screenshots[:5],  # Last 5 screenshots
        "global_progress": scraping_progress,
        "note": "If you see 25 work orders but page size change failed, check the server console logs for detailed debugging output starting with '[SCRAPE] ========== PAGE SIZE CHANGE DEBUGGING =========='",
        "tip": "Run the scraping again to see the new detailed logging in the server console"
    }

async def generate_test_work_orders() -> List[WorkOrderData]:
    """Generate test work order data for testing purposes"""
    import random
    from datetime import timedelta
    
    # Sample data pools
    store_types = ["7-Eleven", "Circle K", "Wawa", "Cumberland Farms", "Shell"]
    store_numbers = ["#1234", "#5678", "#9012", "#3456", "#7890"]
    service_codes = ["2861", "2862", "3146", "3002"]
    service_descriptions = {
        "2861": "All Dispensers AccuMeasure Test",
        "2862": "Specific Dispensers AccuMeasure Test", 
        "3146": "Open Neck Prover Test",
        "3002": "All Dispensers Test"
    }
    
    # Generate 3-5 test work orders
    work_orders = []
    for i in range(random.randint(3, 5)):
        store_type = random.choice(store_types)
        store_num = random.choice(store_numbers)
        service_code = random.choice(service_codes)
        
        # Generate realistic work order data
        work_order = WorkOrderData(
            id=f"W-{random.randint(100000, 999999)}",
            external_id=f"W-{random.randint(100000, 999999)}",
            site_name=f"{store_type} {store_num}",
            address=f"{random.randint(100, 9999)} Main St, {random.choice(['Anytown', 'Springfield', 'Madison', 'Franklin'])}, {random.choice(['CA', 'TX', 'FL', 'NY'])} {random.randint(10000, 99999)}",
            scheduled_date=datetime.now() + timedelta(days=random.randint(0, 14)),
            status="pending",
            customer_name=store_type,
            store_number=store_num,
            service_code=service_code,
            service_description=service_descriptions[service_code],
            service_type="Testing",
            service_quantity=random.randint(2, 8),
            visit_id=f"visit_{random.randint(1000, 9999)}",
            visit_url=f"https://app.workfossa.com/visits/{random.randint(1000, 9999)}",
            instructions=random.choice([
                None,
                "Call manager before arrival",
                "Use back entrance - front under construction",
                "Test during off-peak hours only",
                "Special safety requirements - see notes"
            ]),
            address_components={
                "street": f"{random.randint(100, 9999)} Main St",
                "intersection": None,
                "cityState": f"{random.choice(['Anytown', 'Springfield', 'Madison'])}, {random.choice(['CA', 'TX', 'FL'])} {random.randint(10000, 99999)}",
                "county": f"{random.choice(['Orange', 'Los Angeles', 'Sacramento'])} County"
            },
            dispensers=[
                {
                    "dispenser_number": str(j + 1),
                    "dispenser_type": random.choice(["Wayne 300", "Gilbarco Encore", "Dresser", "Tokheim"]),
                    "fuel_grades": {
                        "regular": {"octane": 87},
                        "plus": {"octane": 89},
                        "premium": {"octane": 91}
                    }
                }
                for j in range(random.randint(2, 6))
            ]
        )
        work_orders.append(work_order)
    
    return work_orders

def convert_fuel_grades_to_list(fuel_grades: Dict[str, Any]) -> List[str]:
    """Convert fuel_grades dict to list of grade names for frontend display"""
    if not fuel_grades or not isinstance(fuel_grades, dict):
        return []
    
    # Extract grade names from the dict format
    grade_names = []
    for key, value in fuel_grades.items():
        # Skip API error keys and other non-fuel keys
        key_lower = key.lower()
        if ('api' in key_lower or 'error' in key_lower or 'type' in key_lower or 
            'work order' in key_lower or 'description' in key_lower):
            continue
        
        # Get the name from the value if it's a dict, otherwise use the key
        if isinstance(value, dict) and 'name' in value:
            grade_names.append(value['name'])
        elif isinstance(value, str) and not any(x in value.lower() for x in ['api', 'error', 'type']):
            grade_names.append(value)
        else:
            # Capitalize and clean the key as the grade name
            clean_name = key.replace('_', ' ').title()
            # Only add if it looks like a fuel grade
            if clean_name.lower() in ['regular', 'plus', 'premium', 'diesel', 'e85', 'def', 'super', 'mid', 'midgrade']:
                grade_names.append(clean_name)
    
    return grade_names


def get_scraped_dispenser_details(work_order: WorkOrder, dispenser_number: str) -> Dict[str, Any]:
    """Extract scraped dispenser details from work order scraped_data"""
    if not work_order.scraped_data or 'dispensers' not in work_order.scraped_data:
        return {}
    
    scraped_dispensers = work_order.scraped_data.get('dispensers', [])
    
    # Find matching dispenser by number
    for scraped in scraped_dispensers:
        if str(scraped.get('dispenser_number', '')) == str(dispenser_number):
            # Return the extra fields that aren't in the base Dispenser model
            return {
                'title': scraped.get('title'),  # Added title field
                'serial_number': scraped.get('serial_number'),
                'make': scraped.get('make'),
                'model': scraped.get('model'),
                'stand_alone_code': scraped.get('stand_alone_code'),
                'number_of_nozzles': scraped.get('number_of_nozzles'),
                'meter_type': scraped.get('meter_type'),
                'grades_list': scraped.get('grades_list', []),
                'dispenser_numbers': scraped.get('dispenser_numbers', []),  # Added dispenser_numbers array
                'custom_fields': scraped.get('custom_fields', {})
            }
    
    return {}


@router.get("/", response_model=List[Dict[str, Any]])
async def get_work_orders(
    request: Request,
    user_id: str = Query(..., description="User ID to fetch work orders for"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Number of records to return (max 500)"),
    start_date: str = Query(None, description="Filter work orders from this date (ISO 8601 format)"),
    end_date: str = Query(None, description="Filter work orders until this date (ISO 8601 format)"),
    profile_queries: bool = Query(False, description="Enable query profiling (dev mode only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get all work orders for a user with pagination"""
    logger.info(f"[WORK_ORDERS] Getting work orders for user {user_id}")
    logger.info(f"[WORK_ORDERS] Pagination: skip={skip}, limit={limit}")
    logger.info(f"[WORK_ORDERS] Date filters: start_date={start_date}, end_date={end_date}")
    
    # Enhanced security check with logging
    await require_user_access(user_id, request, current_user)
    
    # Initialize query profiler if requested (only in dev mode)
    profiler = None
    if profile_queries:
        import os
        if os.getenv("WORKFOSSA_DEV_MODE", "false").lower() == "true":
            profiler = QueryProfiler()
            profiler.start()
            logger.info("Query profiling enabled for this request")
        else:
            logger.warning("Query profiling requested but not in dev mode")
    
    try:
        # Query work orders with eager loading of dispensers
        # This fixes the N+1 query problem by loading all dispensers in a single query
        from sqlalchemy.orm import joinedload
        
        # Build base query with eager loading
        query = db.query(WorkOrder)\
            .filter(WorkOrder.user_id == user_id)\
            .options(joinedload(WorkOrder.dispensers))
        
        logger.debug(f"[WORK_ORDERS] Base query built for user {user_id}")
        
        # Apply date filtering if provided
        if start_date:
            try:
                start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(WorkOrder.scheduled_date >= start_datetime)
                logger.info(f"[WORK_ORDERS] Applied start date filter: {start_datetime}")
            except ValueError:
                logger.error(f"[WORK_ORDERS] Invalid start_date format: {start_date}")
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use ISO 8601 format.")
        
        if end_date:
            try:
                end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(WorkOrder.scheduled_date <= end_datetime)
                logger.info(f"[WORK_ORDERS] Applied end date filter: {end_datetime}")
            except ValueError:
                logger.error(f"[WORK_ORDERS] Invalid end_date format: {end_date}")
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use ISO 8601 format.")
        
        # Get total count for pagination info
        logger.debug("[WORK_ORDERS] Counting total work orders...")
        total_count = query.count()
        logger.info(f"[WORK_ORDERS] Total work orders matching query: {total_count}")
        
        # Apply pagination
        logger.debug(f"[WORK_ORDERS] Applying pagination and ordering...")
        work_orders = query\
            .order_by(WorkOrder.scheduled_date.desc(), WorkOrder.created_at.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()
        
        logger.info(f"[WORK_ORDERS] Retrieved {len(work_orders)} work orders from database")
        
        result = []
        for wo in work_orders:
            # Use scraped visit URL if available, otherwise generate it
            if wo.visit_url:
                visit_url = wo.visit_url
            else:
                # Generate visit URL as fallback
                from ..services.url_generator import WorkFossaURLGenerator
                url_generator = WorkFossaURLGenerator()
                
                # Prepare work order data for URL generation
                wo_data_for_url = {
                    "basic_info": {
                        "id": wo.id,
                        "external_id": wo.external_id,
                        "store_info": getattr(wo, 'store_info', wo.site_name)
                    },
                    "location": {
                        "site_name": wo.site_name
                    },
                    "scheduling": {
                        "status": wo.status
                    }
                }
                
                visit_url = url_generator.generate_visit_url(wo_data_for_url)
            
            wo_data = {
                "id": wo.id,
                "external_id": wo.external_id,
                "site_name": wo.site_name,
                "address": wo.address,
                "scheduled_date": wo.scheduled_date.isoformat() if wo.scheduled_date else None,
                "status": wo.status,
                "visit_url": visit_url,
                "created_at": wo.created_at.isoformat(),
                "updated_at": wo.updated_at.isoformat(),
                # V1 fields
                "store_number": wo.store_number,
                "service_code": wo.service_code,
                "service_description": wo.service_description,
                "visit_id": wo.visit_id,
                "visit_number": wo.visit_number,
                "instructions": wo.instructions,
                "scraped_data": wo.scraped_data,
                # New fields
                "service_name": wo.service_name,
                "service_items": wo.service_items,
                "street": wo.street,
                "city_state": wo.city_state,
                "county": wo.county,
                "created_date": wo.created_date.isoformat() if wo.created_date else None,
                "created_by": wo.created_by,
                "customer_url": wo.customer_url,
                "dispensers": [
                    {
                        "id": d.id,
                        "dispenser_number": d.dispenser_number,
                        "dispenser_type": d.dispenser_type,
                        "fuel_grades": d.fuel_grades,
                        "status": d.status,
                        "progress_percentage": d.progress_percentage,
                        "automation_completed": d.automation_completed,
                        # Add fields from the dispenser model directly
                        "make": d.make,
                        "model": d.model,
                        "serial_number": d.serial_number,
                        "meter_type": d.meter_type,
                        "number_of_nozzles": d.number_of_nozzles,
                        # Get additional fields from form_data
                        "stand_alone_code": d.form_data.get('stand_alone_code') if d.form_data else None,
                        "title": d.form_data.get('title') if d.form_data else None,
                        "dispenser_numbers": d.form_data.get('dispenser_numbers', []) if d.form_data else [],
                        "custom_fields": d.form_data.get('custom_fields', {}) if d.form_data else {},
                        # Get grades_list from form_data
                        "grades_list": d.form_data.get('grades_list', []) if d.form_data else [],
                        # Provide fuel_grades_list for frontend compatibility
                        "fuel_grades_list": (
                            d.form_data.get('grades_list', []) if d.form_data else []
                        ) or convert_fuel_grades_to_list(d.fuel_grades)
                    }
                    for d in wo.dispensers  # Now using pre-loaded dispensers
                ]
            }
            result.append(wo_data)
        
        # Add pagination metadata to response headers
        from fastapi import Response
        response = Response()
        response.headers["X-Total-Count"] = str(total_count)
        response.headers["X-Skip"] = str(skip)
        response.headers["X-Limit"] = str(limit)
        
        # Add profiling results if enabled
        if profiler:
            profiling_results = profiler.stop()
            # Add profiling summary to response headers
            response.headers["X-Query-Count"] = str(profiling_results['total_queries'])
            response.headers["X-Query-Duration"] = f"{profiling_results['total_duration']:.3f}s"
            
            # Log profiling results
            if profiling_results['n_plus_one_candidates']:
                logger.warning(f"Potential N+1 queries detected: {len(profiling_results['n_plus_one_candidates'])}")
                for candidate in profiling_results['n_plus_one_candidates'][:3]:
                    logger.warning(f"  - Pattern executed {candidate['count']} times: {candidate['pattern'][:80]}...")
        
        # Log final results
        logger.info(f"[WORK_ORDERS] Successfully returned {len(result)} work orders")
        if result:
            # Log sample work order for debugging
            sample_wo = result[0]
            logger.debug(f"[WORK_ORDERS] Sample work order: ID={sample_wo.get('id')}, Store={sample_wo.get('external_id')}, Date={sample_wo.get('scheduled_date')}")
            logger.debug(f"[WORK_ORDERS] Sample has {len(sample_wo.get('dispensers', []))} dispensers")
        
        return result
        
    except Exception as e:
        logger.error(f"[WORK_ORDERS] Failed to fetch work orders: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch work orders: {str(e)}")

@router.get("/{work_order_id}", response_model=Dict[str, Any])
async def get_work_order(
    work_order_id: str,
    user_id: str = Query(..., description="User ID to verify ownership"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get specific work order with dispensers"""
    # Verify user can only access their own data
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to access this user's work orders")
    
    try:
        # Find work order with eager loading of dispensers
        from sqlalchemy.orm import joinedload
        
        work_order = db.query(WorkOrder)\
            .filter(
                WorkOrder.id == work_order_id,
                WorkOrder.user_id == user_id
            )\
            .options(joinedload(WorkOrder.dispensers))\
            .first()
        
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")
        
        # Dispensers are already loaded via eager loading
        dispensers = work_order.dispensers
        
        # Use scraped visit URL if available, otherwise generate it
        if work_order.visit_url:
            visit_url = work_order.visit_url
        else:
            # Generate visit URL as fallback
            from ..services.url_generator import WorkFossaURLGenerator
            url_generator = WorkFossaURLGenerator()
            
            # Prepare work order data for URL generation
            wo_data_for_url = {
                "basic_info": {
                    "id": work_order.id,
                    "external_id": work_order.external_id,
                    "store_info": getattr(work_order, 'store_info', work_order.site_name)
                },
                "location": {
                    "site_name": work_order.site_name
                },
                "scheduling": {
                    "status": work_order.status
                }
            }
            
            visit_url = url_generator.generate_visit_url(wo_data_for_url)
        
        return {
            "id": work_order.id,
            "external_id": work_order.external_id,
            "site_name": work_order.site_name,
            "address": work_order.address,
            "scheduled_date": work_order.scheduled_date.isoformat() if work_order.scheduled_date else None,
            "status": work_order.status,
            "visit_url": visit_url,
            "notes": work_order.notes,
            "created_at": work_order.created_at.isoformat(),
            "updated_at": work_order.updated_at.isoformat(),
            # V1 fields
            "store_number": work_order.store_number,
            "service_code": work_order.service_code,
            "service_description": work_order.service_description,
            "visit_id": work_order.visit_id,
            "visit_number": work_order.visit_number,
            "instructions": work_order.instructions,
            "scraped_data": work_order.scraped_data,
            # New fields
            "service_name": work_order.service_name,
            "service_items": work_order.service_items,
            "street": work_order.street,
            "city_state": work_order.city_state,
            "county": work_order.county,
            "created_date": work_order.created_date.isoformat() if work_order.created_date else None,
            "created_by": work_order.created_by,
            "customer_url": work_order.customer_url,
            "dispensers": [
                {
                    "id": d.id,
                    "dispenser_number": d.dispenser_number,
                    "dispenser_type": d.dispenser_type,
                    "fuel_grades": d.fuel_grades,
                    "status": d.status,
                    "progress_percentage": d.progress_percentage,
                    "automation_completed": d.automation_completed,
                    "created_at": d.created_at.isoformat(),
                        "updated_at": d.updated_at.isoformat(),
                    # Add fields from the dispenser model directly
                    "make": d.make,
                    "model": d.model,
                    "serial_number": d.serial_number,
                    "meter_type": d.meter_type,
                    "number_of_nozzles": d.number_of_nozzles,
                    # Get additional fields from form_data
                    "stand_alone_code": d.form_data.get('stand_alone_code') if d.form_data else None,
                    "title": d.form_data.get('title') if d.form_data else None,
                    "dispenser_numbers": d.form_data.get('dispenser_numbers', []) if d.form_data else [],
                    "custom_fields": d.form_data.get('custom_fields', {}) if d.form_data else {},
                    # Get grades_list from form_data
                    "grades_list": d.form_data.get('grades_list', []) if d.form_data else [],
                    # Provide fuel_grades_list for frontend compatibility
                    "fuel_grades_list": (
                        d.form_data.get('grades_list', []) if d.form_data else []
                    ) or convert_fuel_grades_to_list(d.fuel_grades)
                }
                for d in dispensers
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch work order: {str(e)}")

@router.get("/scrape/progress/{user_id}")
async def get_scraping_progress(
    user_id: str,
    current_user: User = Depends(require_auth)
):
    """Get current scraping progress for a user"""
    # Verify user can only access their own data
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to access this user's progress")
    
    progress = scraping_progress.get(user_id, {
        "status": "idle",
        "phase": "not_started",
        "percentage": 0,
        "message": "No scraping in progress",
        "work_orders_found": 0,
        "started_at": None,
        "completed_at": None,
        "error": None
    })
    return progress

@router.post("/scrape")
async def trigger_scrape(
    user_id: str = Query(..., description="User ID to scrape work orders for"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Trigger work order scraping for a user"""
    # Verify user can only scrape their own data
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to scrape for this user")
    
    try:
        # Verify user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning(f"[SCRAPE] User not found: {user_id}")
            # Check if any users exist
            user_count = db.query(User).count()
            if user_count == 0:
                raise HTTPException(
                    status_code=404, 
                    detail="No users found in database. Please log in first to create your user profile."
                )
            raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
        
        # Try to get user's WorkFossa credentials from database
        from ..models.user_models import UserCredential
        user_credential = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == "workfossa"
        ).first()
        
        if user_credential:
            # Decrypt credentials from database
            credentials = {
                "username": user_credential.username,  # Will be decrypted by property
                "password": user_credential.password   # Will be decrypted by property
            }
        else:
            # Try credential manager as fallback
            from ..services.credential_manager import CredentialManager
            credential_manager = CredentialManager()
            credentials_obj = credential_manager.retrieve_credentials(user_id)
            
            if not credentials_obj or not credentials_obj.username or not credentials_obj.password:
                raise HTTPException(
                    status_code=400, 
                    detail="WorkFossa credentials not configured. Please set up your credentials in Settings."
                )
            
            credentials = {
                "username": credentials_obj.username,
                "password": credentials_obj.password
            }
        
        # Initialize progress tracking
        scraping_progress[user_id] = {
            "status": "in_progress",
            "phase": "initializing",
            "percentage": 0,
            "message": "Starting work order scraping...",
            "work_orders_found": 0,
            "started_at": datetime.now().isoformat(),
            "completed_at": None,
            "error": None
        }
        
        background_tasks.add_task(perform_scrape, user_id, credentials)
        
        return {
            "status": "scraping_started",
            "message": "Work order scraping initiated",
            "user_id": user_id,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start scraping: {str(e)}")

@router.post("/{work_order_id}/open-visit")
async def open_work_order_visit(
    work_order_id: str,
    user_id: str = Query(..., description="User ID to verify ownership"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Open work order visit in browser with auto-login"""
    try:
        # Verify user can only access their own data
        if current_user.id != user_id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to access work orders for this user")
        # Verify work order exists and belongs to user
        work_order = db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id,
            WorkOrder.user_id == user_id
        ).first()
        
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")
        
        # Use scraped visit URL if available, otherwise generate it
        if work_order.visit_url:
            visit_url = work_order.visit_url
        else:
            # Generate visit URL as fallback
            from ..services.url_generator import WorkFossaURLGenerator
            url_generator = WorkFossaURLGenerator()
            
            # Prepare work order data for URL generation
            wo_data_for_url = {
                "basic_info": {
                    "id": work_order.id,
                    "external_id": work_order.external_id,
                    "store_info": getattr(work_order, 'store_info', work_order.site_name)
                },
                "location": {
                    "site_name": work_order.site_name
                },
                "scheduling": {
                    "status": work_order.status
                }
            }
            
            visit_url = url_generator.generate_visit_url(wo_data_for_url)
        
        # For now, just return the visit URL without auto-login
        # TODO: Implement auto-login functionality
        
        return {
            "visit_url": visit_url,
            "auto_login_url": visit_url,  # Same as visit_url for now
            "message": "Visit URL generated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate visit URL: {str(e)}")

async def perform_scrape(user_id: str, credentials: Dict[str, str]):
    """Background task to perform actual scraping"""
    session_id = f"scrape_{user_id}_{datetime.now().timestamp()}"
    start_time = datetime.utcnow()
    
    logger.info(f"[SCRAPE] Starting scraping for user {user_id}")
    logger.info(f"[SCRAPE] Session ID: {session_id}")
    logger.info(f"[SCRAPE] Credentials username: {credentials.get('username', 'NO USERNAME')}")
    
    # Update progress
    def update_progress(phase: str, percentage: float, message: str, work_orders_found: int = 0, error: str = None):
        if user_id in scraping_progress:
            scraping_progress[user_id].update({
                "phase": phase,
                "percentage": percentage,
                "message": message,
                "work_orders_found": work_orders_found,
                "error": error
            })
            if error:
                scraping_progress[user_id]["status"] = "failed"
            logger.info(f"[PROGRESS] {user_id}: {phase} ({percentage}%) - {message}")
    
    # Create a new database session for the background task
    from ..database import SessionLocal
    db = SessionLocal()
    
    try:
        # Import the scraper and WorkFossa automation service
        from ..services.workfossa_scraper import workfossa_scraper
        from ..services.workfossa_automation import WorkFossaAutomationService
        
        logger.info("[SCRAPE] Creating WorkFossa automation service...")
        update_progress("initializing", 5, "Creating browser automation service...")
        
        # Load user's browser settings
        import json
        from pathlib import Path
        browser_settings = {}
        try:
            settings_path = Path(f"data/users/{user_id}/settings/browser_settings.json")
            if settings_path.exists():
                with open(settings_path, 'r') as f:
                    browser_settings = json.load(f)
                logger.info(f"[SCRAPE] Loaded browser settings for user {user_id}: headless={browser_settings.get('headless', True)}")
        except Exception as e:
            logger.warning(f"[SCRAPE] Could not load browser settings: {e}")
        
        workfossa_automation = WorkFossaAutomationService(
            headless=browser_settings.get('headless', True),  # Use user preference, default to True
            user_settings={'browser_settings': browser_settings}
        )
        
        # Create automation session with credentials
        logger.info("[SCRAPE] Creating automation session...")
        update_progress("initializing", 10, "Starting browser session...")
        try:
            await workfossa_automation.create_session(
                session_id=session_id,
                user_id=user_id,
                credentials=credentials
            )
        except Exception as e:
            logger.error(f"[SCRAPE] Failed to create automation session: {e}")
            update_progress("error", 0, "Failed to create browser session", error=str(e))
            return
        
        logger.info("[SCRAPE] Automation session created")
        update_progress("logging_in", 15, "Logging in to WorkFossa...")
        
        # Login to WorkFossa using the proper automation service
        logger.info("[SCRAPE] Logging in to WorkFossa...")
        login_success = await workfossa_automation.login_to_workfossa(session_id)
        if not login_success:
            logger.error("[SCRAPE] Failed to login to WorkFossa")
            update_progress("error", 0, "Failed to login to WorkFossa - please check your credentials", error="Login failed")
            await workfossa_automation.cleanup_session(session_id)
            return
        logger.info("[SCRAPE] Successfully logged in to WorkFossa")
        update_progress("logged_in", 20, "Successfully logged in, navigating to work orders...")
        
        # Get the page from WorkFossa automation service
        session_data = workfossa_automation.sessions.get(session_id)
        if not session_data or 'page' not in session_data:
            logger.error("[SCRAPE] No page found in session")
            await workfossa_automation.cleanup_session(session_id)
            return
        
        page = session_data['page']
        
        # Use the scraper to get work orders, passing the page
        logger.info("[SCRAPE] Starting work order scraping...")
        update_progress("scraping", 25, "Starting work order discovery...")
        
        # Add progress callback to get real-time updates
        async def scraping_progress_callback(progress):
            if hasattr(progress, 'percentage') and hasattr(progress, 'message'):
                # Map the scraper's 0-100% to our 40-90% range (since scraping is the main work)
                mapped_percentage = 40 + (progress.percentage * 0.5)
                update_progress("scraping", mapped_percentage, progress.message, progress.work_orders_found)
        
        workfossa_scraper.add_progress_callback(scraping_progress_callback)
        work_orders = await workfossa_scraper.scrape_work_orders(session_id, page=page)
        await workfossa_automation.cleanup_session(session_id)
        
        logger.info(f"[SCRAPE] Scraped {len(work_orders)} work orders")
        update_progress("storing", 90, f"Storing {len(work_orders)} work orders in database...", len(work_orders))
        
        # Get all current work order external IDs from the scrape
        current_external_ids = {wo_data.external_id for wo_data in work_orders}
        logger.info(f"[SCRAPE] Current scrape found {len(current_external_ids)} work orders")
        
        # Get all existing work orders for this user
        existing_work_orders = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).all()
        logger.info(f"[SCRAPE] Database has {len(existing_work_orders)} work orders for user")
        
        # Find and remove work orders that are no longer present (completed/removed)
        removed_count = 0
        added_count = 0
        updated_count = 0
        for existing_wo in existing_work_orders:
            if existing_wo.external_id not in current_external_ids:
                logger.info(f"[SCRAPE] Removing completed work order: {existing_wo.external_id} - {existing_wo.site_name}")
                
                # First, delete associated dispensers to avoid foreign key constraint violations
                dispensers_to_delete = db.query(Dispenser).filter(
                    Dispenser.work_order_id == existing_wo.id
                ).all()
                
                for dispenser in dispensers_to_delete:
                    logger.debug(f"[SCRAPE] Deleting dispenser {dispenser.dispenser_number} for work order {existing_wo.external_id}")
                    db.delete(dispenser)
                
                # Then delete the work order
                db.delete(existing_wo)
                removed_count += 1
        
        if removed_count > 0:
            logger.info(f"[SCRAPE] Removed {removed_count} completed work orders")
        
        # Store in database
        for wo_data in work_orders:
            # Check if work order already exists
            existing = db.query(WorkOrder).filter(
                WorkOrder.external_id == wo_data.external_id,
                WorkOrder.user_id == user_id
            ).first()
            
            if existing:
                # Update existing work order with all V1 fields
                existing.site_name = wo_data.site_name
                existing.address = wo_data.address
                existing.scheduled_date = wo_data.scheduled_date
                existing.status = wo_data.status
                existing.store_number = wo_data.store_number
                existing.service_code = wo_data.service_code
                existing.service_description = wo_data.service_description
                existing.visit_id = wo_data.visit_id
                existing.visit_url = wo_data.visit_url
                existing.visit_number = wo_data.visit_number
                existing.instructions = wo_data.instructions
                # Update new fields
                existing.service_name = wo_data.service_name
                existing.service_items = wo_data.service_items
                existing.street = wo_data.street
                existing.city_state = wo_data.city_state
                existing.county = wo_data.county
                existing.created_date = wo_data.created_date
                existing.created_by = wo_data.created_by
                existing.customer_url = wo_data.customer_url
                existing.scraped_data = {
                    "raw_html": wo_data.raw_html,
                    "address_components": wo_data.address_components,
                    "service_info": {
                        "type": wo_data.service_type,
                        "quantity": wo_data.service_quantity
                    },
                    "customer_url": wo_data.customer_url
                }
                existing.updated_at = datetime.now()
                work_order = existing
                updated_count += 1
            else:
                # Create new work order with all V1 fields
                work_order = WorkOrder(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    external_id=wo_data.external_id,
                    site_name=wo_data.site_name,
                    address=wo_data.address,
                    scheduled_date=wo_data.scheduled_date,
                    status=wo_data.status,
                    store_number=wo_data.store_number,
                    service_code=wo_data.service_code,
                    service_description=wo_data.service_description,
                    visit_id=wo_data.visit_id,
                    visit_url=wo_data.visit_url,
                    visit_number=wo_data.visit_number,
                    instructions=wo_data.instructions,
                    # New fields
                    service_name=wo_data.service_name,
                    service_items=wo_data.service_items,
                    street=wo_data.street,
                    city_state=wo_data.city_state,
                    county=wo_data.county,
                    created_date=wo_data.created_date,
                    created_by=wo_data.created_by,
                    customer_url=wo_data.customer_url,
                    scraped_data={
                        "raw_html": wo_data.raw_html,
                        "address_components": wo_data.address_components,
                        "service_info": {
                            "type": wo_data.service_type,
                            "quantity": wo_data.service_quantity
                        },
                        "visit_info": {
                            "date": wo_data.scheduled_date.isoformat() if wo_data.scheduled_date else None,
                            "url": wo_data.visit_url,
                            "visit_id": wo_data.visit_id
                        },
                        "customer_url": wo_data.customer_url
                    }
                )
                db.add(work_order)
                db.flush()  # Get the ID
                added_count += 1
            
            # Clear existing dispensers if updating
            if existing:
                db.query(Dispenser).filter(Dispenser.work_order_id == work_order.id).delete()
            
            # Create dispensers
            for disp_data in wo_data.dispensers:
                dispenser = Dispenser(
                    id=str(uuid.uuid4()),
                    work_order_id=work_order.id,
                    dispenser_number=disp_data.get("dispenser_number", ""),
                    dispenser_type=disp_data.get("dispenser_type", ""),
                    fuel_grades=disp_data.get("fuel_grades", {}),
                    status="pending",
                    progress_percentage=0.0,
                    automation_completed=False,
                    # Add new fields if they exist in the dispenser data
                    make=disp_data.get("make"),
                    model=disp_data.get("model"),
                    serial_number=disp_data.get("serial_number"),
                    meter_type=disp_data.get("meter_type"),
                    number_of_nozzles=disp_data.get("number_of_nozzles")
                )
                db.add(dispenser)
        
        db.commit()
        logger.info(f"Successfully stored {len(work_orders)} work orders in database")
        
        # Create history record for manual scrape
        from ..models.scraping_models import ScrapingHistory
        history = ScrapingHistory(
            user_id=user_id,
            schedule_type="work_orders",
            started_at=start_time,
            completed_at=datetime.utcnow(),
            success=True,
            items_processed=len(work_orders),
            items_added=added_count,
            items_updated=updated_count,
            items_failed=0,
            duration_seconds=(datetime.utcnow() - start_time).total_seconds(),
            trigger_type="manual"  # Mark as manual run
        )
        db.add(history)
        db.commit()
        logger.info(f"Created ScrapingHistory record for manual scrape - items: {len(work_orders)}")
        
        # Update progress to complete
        completion_message = f"Successfully scraped {len(work_orders)} work orders"
        if removed_count > 0:
            completion_message += f" (removed {removed_count} completed)"
        
        update_progress("completed", 100, completion_message, len(work_orders))
        if user_id in scraping_progress:
            scraping_progress[user_id]["status"] = "completed"
            scraping_progress[user_id]["completed_at"] = datetime.now().isoformat()
            scraping_progress[user_id]["removed_count"] = removed_count
            # Schedule cleanup of completed scraping progress
            schedule_scraping_cleanup(user_id, delay_minutes=10)
        
    except Exception as e:
        logger.error(f"Scraping failed for user {user_id}: {e}", exc_info=True)
        db.rollback()
        
        # Create history record for failed manual scrape
        try:
            from ..models.scraping_models import ScrapingHistory
            history = ScrapingHistory(
                user_id=user_id,
                schedule_type="work_orders",
                started_at=start_time,
                completed_at=datetime.utcnow(),
                success=False,
                items_processed=0,
                items_added=0,
                items_updated=0,
                items_failed=0,
                error_message=str(e),
                duration_seconds=(datetime.utcnow() - start_time).total_seconds(),
                trigger_type="manual"  # Mark as manual run
            )
            db.add(history)
            db.commit()
            logger.info(f"Created ScrapingHistory record for failed manual scrape")
        except Exception as hist_error:
            logger.error(f"Failed to create history record: {hist_error}")
        
        # Update progress with error
        update_progress("error", 0, f"Scraping failed: {str(e)}", error=str(e))
        if user_id in scraping_progress:
            scraping_progress[user_id]["status"] = "failed"
            scraping_progress[user_id]["completed_at"] = datetime.now().isoformat()
            # Schedule cleanup of failed scraping progress
            schedule_scraping_cleanup(user_id, delay_minutes=5)
        
        # Cleanup on error
        try:
            if 'workfossa_automation' in locals():
                await workfossa_automation.cleanup_session(session_id)
        except:
            pass
    finally:
        # Always close the database session
        db.close()

@router.patch("/{work_order_id}/status")
async def update_work_order_status(
    work_order_id: str,
    user_id: str = Query(..., description="User ID to verify ownership"),
    status_data: Dict[str, str] = {},
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Update work order status"""
    try:
        # Verify user can only update their own data
        if current_user.id != user_id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to update work orders for this user")
        work_order = db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id,
            WorkOrder.user_id == user_id
        ).first()
        
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")
        
        # Validate status
        valid_statuses = ["pending", "in_progress", "completed", "failed", "cancelled"]
        new_status = status_data.get("status")
        
        if new_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
        
        # Update status
        work_order.status = new_status
        work_order.updated_at = datetime.now()
        
        db.commit()
        
        return {
            "status": "success",
            "work_order_id": work_order_id,
            "new_status": new_status,
            "updated_at": work_order.updated_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update status: {str(e)}")

@router.post("/{work_order_id}/scrape-dispensers")
async def scrape_dispensers(
    work_order_id: str,
    user_id: str = Query(..., description="User ID to verify ownership"),
    force_refresh: bool = Query(False, description="Force re-scrape even if dispensers exist"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Trigger dispenser scraping for a specific work order"""
    logger.info(f"[DISPENSER_SCRAPE] Starting dispenser scraping for work order {work_order_id}")
    logger.info(f"[DISPENSER_SCRAPE] User: {user_id}, Force refresh: {force_refresh}")
    
    try:
        # Verify work order exists and belongs to user
        work_order = db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id,
            WorkOrder.user_id == user_id
        ).first()
        
        if not work_order:
            logger.error(f"[DISPENSER_SCRAPE] Work order {work_order_id} not found for user {user_id}")
            raise HTTPException(status_code=404, detail="Work order not found")
        
        logger.info(f"[DISPENSER_SCRAPE] Found work order: {work_order.external_id}, Customer URL: {getattr(work_order, 'customer_url', 'None')}")
        
        # Check if dispensers already exist (unless force_refresh is True)
        if not force_refresh:
            existing_dispensers = db.query(Dispenser).filter(
                Dispenser.work_order_id == work_order_id
            ).count()
            
            logger.info(f"[DISPENSER_SCRAPE] Found {existing_dispensers} existing dispensers for work order {work_order.external_id}")
            
            if existing_dispensers > 0:
                logger.info(f"[DISPENSER_SCRAPE] Skipping dispenser scrape for {work_order.external_id} - already has {existing_dispensers} dispensers")
                return {
                    "status": "skipped",
                    "message": f"Work order {work_order.external_id} already has {existing_dispensers} dispensers. Use force_refresh=true to re-scrape.",
                    "work_order_id": work_order_id,
                    "dispenser_count": existing_dispensers,
                    "timestamp": datetime.now().isoformat()
                }
        else:
            logger.info(f"[DISPENSER_SCRAPE] Force refresh enabled - will re-scrape dispensers")
        
        # Get user credentials
        from ..models.user_models import UserCredential
        user_credential = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == "workfossa"
        ).first()
        
        if not user_credential:
            # Try credential manager as fallback
            from ..services.credential_manager import CredentialManager
            credential_manager = CredentialManager()
            credentials_obj = credential_manager.retrieve_credentials(user_id)
            
            if not credentials_obj or not credentials_obj.username or not credentials_obj.password:
                raise HTTPException(
                    status_code=400, 
                    detail="WorkFossa credentials not configured. Please set up your credentials in Settings."
                )
            
            credentials = {
                "username": credentials_obj.username,
                "password": credentials_obj.password
            }
        else:
            credentials = {
                "username": user_credential.username,
                "password": user_credential.password
            }
        
        # Use scraped customer URL if available (preferred for dispenser scraping)
        customer_url = None
        if hasattr(work_order, 'customer_url') and work_order.customer_url:
            customer_url = work_order.customer_url
        elif work_order.scraped_data and work_order.scraped_data.get('customer_url'):
            customer_url = work_order.scraped_data.get('customer_url')
        
        if not customer_url:
            return {
                "status": "error",
                "message": f"No customer URL available for work order {work_order.external_id}. Cannot scrape dispensers without customer location page URL.",
                "work_order_id": work_order_id,
                "timestamp": datetime.now().isoformat()
            }
        
        # Add background task to scrape dispensers
        background_tasks.add_task(
            perform_dispenser_scrape, 
            work_order_id, 
            user_id, 
            credentials, 
            customer_url
        )
        
        logger.info(f"[DISPENSER_SCRAPE] Initiated background scraping for work order {work_order.external_id}")
        logger.info(f"[DISPENSER_SCRAPE] Customer URL: {customer_url}")
        
        return {
            "status": "scraping_started",
            "message": f"Dispenser scraping initiated for work order {work_order.external_id}",
            "work_order_id": work_order_id,
            "customer_url": customer_url,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DISPENSER_SCRAPE] Failed to start dispenser scraping: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start dispenser scraping: {str(e)}")


async def perform_dispenser_scrape(work_order_id: str, user_id: str, credentials: dict, customer_url: str):
    """Background task to scrape dispensers for a work order"""
    logger.info(f"[DISPENSER_SCRAPE_BG] Starting background dispenser scrape for work order {work_order_id}")
    logger.info(f"[DISPENSER_SCRAPE_BG] User: {user_id}, Customer URL: {customer_url}")
    
    # Import the database session
    from ..database import SessionLocal
    db = SessionLocal()
    session_id = None
    
    # Set up progress tracking for single work order
    progress_key = f"single_dispenser_{user_id}_{work_order_id}"
    scraping_progress[progress_key] = {
        "status": "in_progress",
        "phase": "initializing",
        "percentage": 0,
        "message": "Starting dispenser scrape...",
        "work_order_id": work_order_id,
        "started_at": datetime.now().isoformat()
    }
    
    logger.info(f"[DISPENSER_SCRAPE_BG] Progress tracking initialized with key: {progress_key}")
    
    def update_progress(phase: str, percentage: float, message: str, error: str = None):
        if progress_key in scraping_progress:
            scraping_progress[progress_key].update({
                "phase": phase,
                "percentage": percentage,
                "message": message,
                "error": error
            })
            if error:
                scraping_progress[progress_key]["status"] = "failed"
            logger.info(f"[SINGLE_DISPENSER] {work_order_id}: {phase} ({percentage}%) - {message}")
    
    try:
        logger.info(f"🔧 [SINGLE_DISPENSER] Starting dispenser scrape for work order {work_order_id}")
        update_progress("initializing", 5, "Setting up browser automation...")
        
        # Import automation services
        from ..services.workfossa_automation import WorkFossaAutomationService, WorkFossaCredentials
        from ..services.workfossa_scraper import workfossa_scraper
        
        # Create credentials object
        workfossa_creds = WorkFossaCredentials(
            email=credentials["username"],
            password=credentials["password"],
            user_id=user_id
        )
        
        # Load user's browser settings
        import json
        from pathlib import Path
        browser_settings = {}
        try:
            settings_path = Path(f"data/users/{user_id}/settings/browser_settings.json")
            if settings_path.exists():
                with open(settings_path, 'r') as f:
                    browser_settings = json.load(f)
                logger.info(f"[SINGLE_DISPENSER] Loaded browser settings for user {user_id}: headless={browser_settings.get('headless', True)}")
        except Exception as e:
            logger.warning(f"[SINGLE_DISPENSER] Could not load browser settings: {e}")
        
        # Create automation service with user settings
        workfossa_automation = WorkFossaAutomationService(
            headless=browser_settings.get('headless', True),
            user_settings={'browser_settings': browser_settings}
        )
        
        # Create browser session
        update_progress("connecting", 10, "Creating browser session...")
        session_id = await workfossa_automation.create_automation_session(user_id, workfossa_creds)
        
        # Login
        update_progress("logging_in", 20, "Logging in to WorkFossa...")
        login_success = await workfossa_automation.login_to_workfossa(session_id)
        if not login_success:
            update_progress("error", 0, "Failed to login to WorkFossa", error="Login failed")
            raise Exception("Failed to login to WorkFossa")
        
        # Get the page from session
        session_data = workfossa_automation.sessions.get(session_id)
        if not session_data or 'page' not in session_data:
            raise Exception("No page found in session")
        
        page = session_data['page']
        
        # Verify page is still valid
        try:
            await page.evaluate("() => document.title")
        except Exception as e:
            logger.error(f"Page is no longer valid: {e}")
            raise Exception("Browser page is no longer valid. Session may have timed out.")
        
        # Use dispenser scraper directly with the page
        update_progress("navigating", 30, f"Navigating to customer location page...")
        from ..services.dispenser_scraper import dispenser_scraper
        
        update_progress("scraping", 50, "Scraping dispenser information...")
        dispenser_infos, raw_html = await dispenser_scraper.scrape_dispensers_for_work_order(
            page=page,
            work_order_id=work_order_id,
            visit_url=customer_url
        )
        
        update_progress("processing", 80, f"Processing {len(dispenser_infos)} dispensers...")
        
        # Convert DispenserInfo objects to dictionaries
        dispensers = []
        for info in dispenser_infos:
            dispenser_dict = {
                'dispenser_number': info.dispenser_number,
                'dispenser_type': info.make or 'Unknown',  # Use make as dispenser_type
                'title': info.title,
                'serial_number': info.serial_number,
                'make': info.make,
                'model': info.model,
                'stand_alone_code': info.stand_alone_code,
                'number_of_nozzles': info.number_of_nozzles,
                'meter_type': info.meter_type,
                'fuel_grades': info.fuel_grades or {},
                'grades_list': info.grades_list or [],
                'dispenser_numbers': info.dispenser_numbers or [],
                'custom_fields': info.custom_fields or {}
            }
            dispensers.append(dispenser_dict)
        
        logger.info(f"📋 Scraper returned {len(dispensers)} dispensers for work order {work_order_id}")
        
        # Update database
        work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        if work_order:
            if dispensers:
                logger.info(f"✅ Found {len(dispensers)} dispensers for {work_order.external_id}")
                
                # Log each dispenser found
                for j, disp in enumerate(dispensers):
                    logger.info(f"  Dispenser {j+1}: Number={disp.get('dispenser_number', 'Unknown')}, Type={disp.get('dispenser_type', 'Unknown')}")
                
                # Update database
                logger.info(f"💾 Updating database for {work_order.external_id}...")
                
                # Delete existing dispensers
                deleted_count = db.query(Dispenser).filter(Dispenser.work_order_id == work_order_id).delete()
                logger.info(f"🗑️ Deleted {deleted_count} existing dispensers for {work_order.external_id}")
                
                # Add new dispensers
                logger.info(f"➕ Adding {len(dispensers)} new dispensers...")
                for i, disp in enumerate(dispensers):
                    # Extract dispenser type from title or use make/model (same as batch)
                    dispenser_type = "Unknown"
                    if disp.get("title"):
                        # Extract from title (e.g., "1/2 - Regular, Plus, Diesel - Gilbarco")
                        title_parts = disp["title"].split(" - ")
                        if len(title_parts) > 1:
                            # Get the last part which usually has the manufacturer
                            type_part = title_parts[-1].strip()
                            # Extract just the manufacturer name
                            dispenser_type = type_part.split("\n")[0].strip()
                    
                    # If we have make/model info, use that
                    if "Make:" in disp.get("title", ""):
                        import re
                        make_match = re.search(r"Make:\s*(\w+)", disp["title"])
                        model_match = re.search(r"Model:\s*(\w+)", disp["title"])
                        if make_match:
                            make = make_match.group(1)
                            model = model_match.group(1) if model_match else ""
                            dispenser_type = f"{make} {model}".strip()
                    
                    dispenser = Dispenser(
                        id=str(uuid.uuid4()),
                        work_order_id=work_order_id,
                        dispenser_number=disp.get("dispenser_number", str(i + 1)),
                        dispenser_type=dispenser_type,
                        fuel_grades=disp.get("fuel_grades", {}),
                        status="pending",
                        progress_percentage=0.0,
                        automation_completed=False,
                        # Store all scraped fields (same as batch scraping)
                        make=disp.get("make"),
                        model=disp.get("model"),
                        serial_number=disp.get("serial_number"),
                        meter_type=disp.get("meter_type"),
                        number_of_nozzles=disp.get("number_of_nozzles"),
                        # Store additional data in form_data field
                        form_data={
                            "stand_alone_code": disp.get("stand_alone_code"),
                            "grades_list": disp.get("grades_list", []),
                            "title": disp.get("title"),
                            "dispenser_numbers": disp.get("dispenser_numbers", []),
                            "custom_fields": disp.get("custom_fields", {})
                        }
                    )
                    db.add(dispenser)
                    logger.info(f"  ➕ Added dispenser {i+1}: {dispenser.dispenser_number} - {dispenser.dispenser_type}")
                
                # Update scraped data (matching batch process exactly)
                logger.info(f"📝 Updating scraped_data for {work_order.external_id}...")
                if work_order.scraped_data is None:
                    work_order.scraped_data = {}
                    logger.info(f"📝 Created new scraped_data dict")
                
                work_order.scraped_data["dispensers"] = dispensers
                work_order.scraped_data["dispenser_count"] = len(dispensers)
                work_order.scraped_data["dispenser_scrape_date"] = datetime.now().isoformat()
                work_order.scraped_data["dispensers_scraped_at"] = datetime.now().isoformat()
                logger.info(f"📝 Updated scraped_data with {len(dispensers)} dispensers")
                
                # IMPORTANT: Mark JSON field as modified for SQLite
                flag_modified(work_order, "scraped_data")
                logger.info(f"🔧 Marked scraped_data as modified for SQLite")
                
                # Commit changes
                logger.info(f"💾 Committing database changes...")
                update_progress("saving", 90, "Saving dispensers to database...")
                db.commit()
                logger.info(f"✅ Successfully updated {work_order.external_id} with {len(dispensers)} dispensers")
                update_progress("completed", 100, f"Successfully scraped {len(dispensers)} dispensers")
            else:
                logger.warning(f"⚠️ No dispensers found for {work_order.external_id}")
                update_progress("completed", 100, "No dispensers found")
        
        # Mark as completed
        if progress_key in scraping_progress:
            scraping_progress[progress_key]["status"] = "completed"
            scraping_progress[progress_key]["completed_at"] = datetime.now().isoformat()
            # Schedule cleanup of completed single dispenser progress
            schedule_scraping_cleanup(progress_key, delay_minutes=10)
        
        # Cleanup
        await workfossa_automation.close_session(session_id)
        
    except Exception as e:
        logger.error(f"[DISPENSER_SCRAPE_BG] Dispenser scraping failed for work order {work_order_id}: {e}", exc_info=True)
        logger.error(f"[DISPENSER_SCRAPE_BG] Failure details - User: {user_id}, Customer URL: {customer_url}")
        update_progress("error", 0, f"Scraping failed: {str(e)}", error=str(e))
        if progress_key in scraping_progress:
            scraping_progress[progress_key]["status"] = "failed"
            scraping_progress[progress_key]["completed_at"] = datetime.now().isoformat()
            # Schedule cleanup of failed single dispenser progress
            schedule_scraping_cleanup(progress_key, delay_minutes=5)
        db.rollback()
        # Try to cleanup session if it was created
        if session_id:
            try:
                await workfossa_automation.close_session(session_id)
            except:
                pass
    finally:
        db.close()


@router.get("/{work_order_id}/scrape-dispensers/progress")
async def get_single_dispenser_scraping_progress(
    work_order_id: str,
    user_id: str = Query(..., description="User ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Get the progress of single work order dispenser scraping"""
    progress_key = f"single_dispenser_{user_id}_{work_order_id}"
    
    if progress_key in scraping_progress:
        return scraping_progress[progress_key]
    
    return {
        "status": "not_found",
        "message": "No active scraping session found for this work order"
    }


@router.post("/scrape-dispensers-batch")
async def scrape_dispensers_batch(
    user_id: str = Query(..., description="User ID to scrape dispensers for"),
    work_order_ids: List[str] = Query(None, description="Optional list of specific work order IDs to scrape"),
    force_refresh: bool = Query(False, description="Force re-scrape even if dispensers exist"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Trigger batch dispenser scraping for all or selected work orders with dispenser-related service codes"""
    try:
        # Verify user can only scrape their own data
        if current_user.id != user_id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to scrape for this user")
        # Verify user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail=f"User not found: {user_id}")
        
        # Get user credentials
        from ..models.user_models import UserCredential
        user_credential = db.query(UserCredential).filter(
            UserCredential.user_id == user_id,
            UserCredential.service_name == "workfossa"
        ).first()
        
        if not user_credential:
            # Try credential manager as fallback
            from ..services.credential_manager import CredentialManager
            credential_manager = CredentialManager()
            credentials_obj = credential_manager.retrieve_credentials(user_id)
            
            if not credentials_obj or not credentials_obj.username or not credentials_obj.password:
                raise HTTPException(
                    status_code=400, 
                    detail="WorkFossa credentials not configured. Please set up your credentials in Settings."
                )
            
            credentials = {
                "username": credentials_obj.username,
                "password": credentials_obj.password
            }
        else:
            credentials = {
                "username": user_credential.username,
                "password": user_credential.password
            }
        
        # Find work orders to process
        dispenser_service_codes = ["2861", "2862", "3146", "3002"]
        
        if work_order_ids:
            # If specific work order IDs provided, use those
            work_orders = db.query(WorkOrder).filter(
                WorkOrder.user_id == user_id,
                WorkOrder.id.in_(work_order_ids),
                WorkOrder.service_code.in_(dispenser_service_codes)
            ).all()
        else:
            # Otherwise get all work orders with dispenser service codes
            work_orders = db.query(WorkOrder).filter(
                WorkOrder.user_id == user_id,
                WorkOrder.service_code.in_(dispenser_service_codes)
            ).all()
        
        if not work_orders:
            return {
                "status": "no_work_orders",
                "message": "No work orders found with dispenser service codes",
                "timestamp": datetime.now().isoformat()
            }
        
        # Filter out work orders that already have dispensers (unless force_refresh is True)
        work_orders_to_process = []
        skipped_count = 0
        
        if not force_refresh:
            for work_order in work_orders:
                existing_dispensers = db.query(Dispenser).filter(
                    Dispenser.work_order_id == work_order.id
                ).count()
                
                if existing_dispensers > 0:
                    logger.info(f"Skipping {work_order.external_id} - already has {existing_dispensers} dispensers")
                    skipped_count += 1
                else:
                    work_orders_to_process.append(work_order)
        else:
            work_orders_to_process = work_orders
        
        if not work_orders_to_process:
            return {
                "status": "all_skipped",
                "message": f"All {len(work_orders)} work orders already have dispensers. Use force_refresh=true to re-scrape.",
                "total_work_orders": len(work_orders),
                "skipped_count": skipped_count,
                "timestamp": datetime.now().isoformat()
            }
        
        # Initialize progress tracking
        scraping_progress[f"dispensers_{user_id}"] = {
            "status": "in_progress",
            "phase": "initializing",
            "percentage": 0,
            "message": "Starting batch dispenser scraping...",
            "total_work_orders": len(work_orders_to_process),
            "skipped_work_orders": skipped_count,
            "processed": 0,
            "successful": 0,
            "failed": 0,
            "started_at": datetime.now().isoformat(),
            "completed_at": None,
            "error": None
        }
        
        # Extract work order data before passing to background task
        # We can't pass ORM objects across sessions
        work_order_data = []
        for wo in work_orders_to_process:
            work_order_data.append({
                "id": wo.id,
                "external_id": wo.external_id,
                "site_name": wo.site_name,
                "scraped_data": wo.scraped_data,
                "customer_url": wo.scraped_data.get("customer_url") if wo.scraped_data else None
            })
        
        # Add background task to scrape dispensers for all work orders
        background_tasks.add_task(
            perform_batch_dispenser_scrape, 
            user_id, 
            credentials, 
            work_order_data
        )
        
        return {
            "status": "scraping_started",
            "message": f"Batch dispenser scraping initiated for {len(work_orders_to_process)} work orders" + (f" ({skipped_count} skipped)" if skipped_count > 0 else ""),
            "work_order_count": len(work_orders_to_process),
            "skipped_count": skipped_count,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start batch dispenser scraping: {str(e)}")


@router.get("/scrape-dispensers/progress/{user_id}")
async def get_dispenser_scraping_progress(
    user_id: str,
    current_user: User = Depends(require_auth)
):
    """Get current dispenser scraping progress for a user"""
    # Verify user can only access their own progress
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to access this user's progress")
    progress = scraping_progress.get(f"dispensers_{user_id}", {
        "status": "idle",
        "phase": "not_started",
        "percentage": 0,
        "message": "No dispenser scraping in progress",
        "total_work_orders": 0,
        "processed": 0,
        "successful": 0,
        "failed": 0,
        "started_at": None,
        "completed_at": None,
        "error": None
    })
    return progress


async def perform_batch_dispenser_scrape(user_id: str, credentials: dict, work_order_data: list):
    """Background task to scrape dispensers for multiple work orders"""
    # Import the database session
    from ..database import SessionLocal
    db = SessionLocal()
    
    progress_key = f"dispensers_{user_id}"
    
    def update_progress(phase: str, percentage: float, message: str, processed: int = None, successful: int = None, failed: int = None, error: str = None):
        if progress_key in scraping_progress:
            if processed is not None:
                scraping_progress[progress_key]["processed"] = processed
            if successful is not None:
                scraping_progress[progress_key]["successful"] = successful
            if failed is not None:
                scraping_progress[progress_key]["failed"] = failed
            scraping_progress[progress_key].update({
                "phase": phase,
                "percentage": percentage,
                "message": message,
                "error": error
            })
            if error:
                scraping_progress[progress_key]["status"] = "failed"
            logger.info(f"[DISPENSER BATCH] {user_id}: {phase} ({percentage}%) - {message}")
    
    try:
        logger.info(f"Starting batch dispenser scrape for {len(work_order_data)} work orders")
        update_progress("initializing", 5, f"Preparing to scrape {len(work_order_data)} work orders...")
        
        # Import automation services
        from ..services.workfossa_automation import WorkFossaAutomationService
        from ..services.dispenser_scraper import dispenser_scraper
        from ..models import WorkOrder, Dispenser
        
        # Create session
        session_id = f"batch_dispenser_{user_id}_{datetime.now().timestamp()}"
        
        # Load user's browser settings
        import json
        from pathlib import Path
        browser_settings = {}
        try:
            settings_path = Path(f"data/users/{user_id}/settings/browser_settings.json")
            if settings_path.exists():
                with open(settings_path, 'r') as f:
                    browser_settings = json.load(f)
                logger.info(f"[BATCH_DISPENSER] Loaded browser settings for user {user_id}: headless={browser_settings.get('headless', True)}")
        except Exception as e:
            logger.warning(f"[BATCH_DISPENSER] Could not load browser settings: {e}")
        
        workfossa_automation = WorkFossaAutomationService(
            headless=browser_settings.get('headless', True),  # Use user preference, default to True
            user_settings={'browser_settings': browser_settings}
        )
        
        # Create automation session
        update_progress("connecting", 10, "Connecting to WorkFossa...")
        await workfossa_automation.create_session(
            session_id=session_id,
            user_id=user_id,
            credentials=credentials
        )
        
        # Login
        update_progress("logging_in", 15, "Logging in to WorkFossa...")
        login_success = await workfossa_automation.login_to_workfossa(session_id)
        if not login_success:
            raise Exception("Failed to login to WorkFossa")
        
        # Get the page from session
        session_data = workfossa_automation.sessions.get(session_id)
        if not session_data or 'page' not in session_data:
            raise Exception("No page found in session")
        
        page = session_data['page']
        
        # Verify page is still valid
        try:
            await page.evaluate("() => document.title")
        except Exception as e:
            logger.error(f"Page is no longer valid: {e}")
            raise Exception("Browser page is no longer valid. Session may have timed out.")
        
        # Process each work order
        successful = 0
        failed = 0
        
        for i, wo_data in enumerate(work_order_data):
            try:
                # More accurate progress: 0-20% setup, 20-95% actual scraping, 95-100% cleanup
                progress_percentage = 20 + (((i + 1) / len(work_order_data)) * 75)
                logger.info(f"🔄 [BATCH_DISPENSER] Processing work order {i+1}/{len(work_order_data)}: {wo_data['external_id']}")
                
                # Verify session is still valid before each work order
                try:
                    await page.evaluate("() => document.title")
                except Exception as e:
                    logger.warning(f"⚠️ [BATCH_DISPENSER] Session expired, recreating...")
                    # Recreate session
                    await workfossa_automation.create_session(
                        session_id=session_id,
                        user_id=user_id,
                        credentials=credentials
                    )
                    login_success = await workfossa_automation.login_to_workfossa(session_id)
                    if not login_success:
                        raise Exception("Failed to re-login to WorkFossa")
                    
                    # Get the new page
                    session_data = workfossa_automation.sessions.get(session_id)
                    if not session_data or 'page' not in session_data:
                        raise Exception("No page found in recreated session")
                    page = session_data['page']
                
                # Fetch the work order from database in this session
                work_order = db.query(WorkOrder).filter(WorkOrder.id == wo_data["id"]).first()
                if not work_order:
                    logger.error(f"Work order {wo_data['id']} not found in database")
                    failed += 1
                    continue
                
                update_progress(
                    "scraping",
                    progress_percentage,
                    f"Scraping dispensers for work order {i+1}/{len(work_order_data)}: {work_order.external_id}",
                    processed=i + 1,
                    successful=successful,
                    failed=failed
                )
                
                # Use scraped customer URL if available (preferred for dispenser scraping)
                customer_url = None
                logger.info(f"🔍 [BATCH_DISPENSER] Looking for customer URL for work order {work_order.external_id}...")
                
                if hasattr(work_order, 'customer_url') and work_order.customer_url:
                    customer_url = work_order.customer_url
                    logger.info(f"✅ [BATCH_DISPENSER] Found customer URL from work_order.customer_url: {customer_url}")
                elif work_order.scraped_data and work_order.scraped_data.get('customer_url'):
                    customer_url = work_order.scraped_data.get('customer_url')
                    logger.info(f"✅ [BATCH_DISPENSER] Found customer URL from scraped_data: {customer_url}")
                else:
                    logger.info(f"🔍 [BATCH_DISPENSER] No customer URL found in obvious places, checking all scraped_data...")
                    if work_order.scraped_data:
                        logger.info(f"🔍 [BATCH_DISPENSER] Scraped data keys: {list(work_order.scraped_data.keys())}")
                        logger.info(f"🔍 [BATCH_DISPENSER] Scraped data content: {work_order.scraped_data}")
                
                if not customer_url:
                    logger.error(f"❌ [BATCH_DISPENSER] No customer URL available for work order {work_order.external_id}. Skipping dispenser scraping.")
                    logger.info(f"🔍 [BATCH_DISPENSER] Work order details for debugging:")
                    logger.info(f"  - ID: {work_order.id}")
                    logger.info(f"  - External ID: {work_order.external_id}")
                    logger.info(f"  - Site name: {work_order.site_name}")
                    logger.info(f"  - Has customer_url attr: {hasattr(work_order, 'customer_url')}")
                    logger.info(f"  - Has scraped_data: {work_order.scraped_data is not None}")
                    if work_order.scraped_data:
                        logger.info(f"  - Scraped data type: {type(work_order.scraped_data)}")
                    failed += 1
                    continue
                
                # Scrape dispensers for this work order using customer location page
                logger.info(f"🏪 [BATCH_DISPENSER] Scraping dispensers for {work_order.external_id} at customer location: {customer_url}")
                
                # Use the dispenser scraper directly with the existing page
                # This avoids creating new sessions and keeps the browser connection alive
                logger.info(f"🔧 [BATCH_DISPENSER] Using dispenser_scraper with existing page...")
                from ..services.dispenser_scraper import dispenser_scraper
                
                # Navigate to customer URL and scrape dispensers
                dispenser_infos, raw_html = await dispenser_scraper.scrape_dispensers_for_work_order(
                    page=page,
                    work_order_id=work_order.id,
                    visit_url=customer_url  # This will navigate to the customer URL
                )
                
                # Convert DispenserInfo objects to dictionaries
                dispensers = []
                for info in dispenser_infos:
                    dispenser_dict = {
                        'dispenser_number': info.dispenser_number,
                        'dispenser_type': info.make or 'Unknown',  # Use make as dispenser_type
                        'title': info.title,
                        'serial_number': info.serial_number,
                        'make': info.make,
                        'model': info.model,
                        'stand_alone_code': info.stand_alone_code,
                        'number_of_nozzles': info.number_of_nozzles,
                        'meter_type': info.meter_type,
                        'fuel_grades': info.fuel_grades or {},
                        'grades_list': info.grades_list or [],
                        'dispenser_numbers': info.dispenser_numbers or [],
                        'custom_fields': info.custom_fields or {}
                    }
                    dispensers.append(dispenser_dict)
                
                logger.info(f"📋 [BATCH_DISPENSER] Scraper returned {len(dispensers)} dispensers for {work_order.external_id}")
                
                if dispensers:
                    logger.info(f"✅ [BATCH_DISPENSER] Found {len(dispensers)} dispensers for {work_order.external_id}")
                    
                    # Log each dispenser found
                    for j, disp in enumerate(dispensers):
                        logger.info(f"  Dispenser {j+1}: Number={disp.get('dispenser_number', 'Unknown')}, Type={disp.get('dispenser_type', 'Unknown')}")
                    
                    # Update database
                    logger.info(f"💾 [BATCH_DISPENSER] Updating database for {work_order.external_id}...")
                    
                    # Delete existing dispensers
                    deleted_count = db.query(Dispenser).filter(Dispenser.work_order_id == work_order.id).delete()
                    logger.info(f"🗑️ [BATCH_DISPENSER] Deleted {deleted_count} existing dispensers for {work_order.external_id}")
                    
                    # Add new dispensers
                    logger.info(f"➕ [BATCH_DISPENSER] Adding {len(dispensers)} new dispensers...")
                    for i, disp in enumerate(dispensers):
                        # Extract dispenser type from title or use make/model
                        dispenser_type = "Unknown"
                        if disp.get("title"):
                            # Extract from title (e.g., "1/2 - Regular, Plus, Diesel - Gilbarco")
                            title_parts = disp["title"].split(" - ")
                            if len(title_parts) > 1:
                                # Get the last part which usually has the manufacturer
                                type_part = title_parts[-1].strip()
                                # Extract just the manufacturer name
                                dispenser_type = type_part.split("\n")[0].strip()
                        
                        # If we have make/model info, use that
                        if "Make:" in disp.get("title", ""):
                            import re
                            make_match = re.search(r"Make:\s*(\w+)", disp["title"])
                            model_match = re.search(r"Model:\s*(\w+)", disp["title"])
                            if make_match:
                                make = make_match.group(1)
                                model = model_match.group(1) if model_match else ""
                                dispenser_type = f"{make} {model}".strip()
                        
                        dispenser = Dispenser(
                            id=str(uuid.uuid4()),
                            work_order_id=work_order.id,
                            dispenser_number=disp.get("dispenser_number", str(i + 1)),
                            dispenser_type=dispenser_type,
                            fuel_grades=disp.get("fuel_grades", {}),
                            status="pending",
                            progress_percentage=0.0,
                            automation_completed=False,
                            # Store all scraped fields (same as single work order scraping)
                            make=disp.get("make"),
                            model=disp.get("model"),
                            serial_number=disp.get("serial_number"),
                            meter_type=disp.get("meter_type"),
                            number_of_nozzles=disp.get("number_of_nozzles"),
                            # Store additional data in form_data field
                            form_data={
                                "stand_alone_code": disp.get("stand_alone_code"),
                                "grades_list": disp.get("grades_list", []),
                                "title": disp.get("title"),
                                "dispenser_numbers": disp.get("dispenser_numbers", []),
                                "custom_fields": disp.get("custom_fields", {})
                            }
                        )
                        db.add(dispenser)
                        logger.info(f"  ➕ Added dispenser {i+1}: {dispenser.dispenser_number} - {dispenser.dispenser_type}")
                    
                    # Update scraped data
                    logger.info(f"📝 [BATCH_DISPENSER] Updating scraped_data for {work_order.external_id}...")
                    if work_order.scraped_data is None:
                        work_order.scraped_data = {}
                        logger.info(f"📝 [BATCH_DISPENSER] Created new scraped_data dict")
                    
                    work_order.scraped_data["dispensers"] = dispensers
                    work_order.scraped_data["dispenser_count"] = len(dispensers)
                    work_order.scraped_data["dispenser_scrape_date"] = datetime.now().isoformat()
                    work_order.scraped_data["dispensers_scraped_at"] = datetime.now().isoformat()
                    logger.info(f"📝 [BATCH_DISPENSER] Updated scraped_data with {len(dispensers)} dispensers")
                    
                    # IMPORTANT: Mark JSON field as modified for SQLite
                    from sqlalchemy.orm.attributes import flag_modified
                    flag_modified(work_order, "scraped_data")
                    logger.info(f"🔧 [BATCH_DISPENSER] Marked scraped_data as modified for SQLite")
                    
                    # Commit changes
                    logger.info(f"💾 [BATCH_DISPENSER] Committing database changes...")
                    db.commit()
                    logger.info(f"✅ [BATCH_DISPENSER] Successfully updated {work_order.external_id} with {len(dispensers)} dispensers")
                    successful += 1
                else:
                    logger.warning(f"⚠️ [BATCH_DISPENSER] No dispensers found for {work_order.external_id}")
                    failed += 1
                
            except Exception as e:
                logger.error(f"❌ [BATCH_DISPENSER] Error scraping dispensers for {work_order.external_id}: {e}")
                import traceback
                logger.error(f"❌ [BATCH_DISPENSER] Traceback: {traceback.format_exc()}")
                failed += 1
                db.rollback()
                continue
            finally:
                # Add a small delay between work orders to prevent overwhelming the server
                if i < len(work_order_data) - 1:  # Don't delay after the last work order
                    await asyncio.sleep(2)  # 2 second delay between work orders
        
        # Update final progress
        update_progress(
            "completed",
            100,
            f"Batch dispenser scraping completed: {successful} successful, {failed} failed",
            processed=len(work_order_data),
            successful=successful,
            failed=failed
        )
        
        if progress_key in scraping_progress:
            scraping_progress[progress_key]["status"] = "completed"
            scraping_progress[progress_key]["completed_at"] = datetime.now().isoformat()
            # Schedule cleanup of completed batch dispenser progress
            schedule_scraping_cleanup(progress_key, delay_minutes=10)
        
        # Cleanup
        await workfossa_automation.cleanup_session(session_id)
        
    except Exception as e:
        logger.error(f"Batch dispenser scraping failed: {e}", exc_info=True)
        update_progress("error", 0, f"Batch scraping failed: {str(e)}", error=str(e))
        if progress_key in scraping_progress:
            scraping_progress[progress_key]["status"] = "failed"
            scraping_progress[progress_key]["completed_at"] = datetime.now().isoformat()
            # Schedule cleanup of failed batch dispenser progress
            schedule_scraping_cleanup(progress_key, delay_minutes=5)
        db.rollback()
    finally:
        db.close()


@router.delete("/clear-all")
async def clear_all_work_orders(
    user_id: str = Query(..., description="User ID to clear work orders for"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Clear all work orders and dispensers for a user"""
    try:
        # Verify user can only clear their own data
        if current_user.id != user_id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to clear work orders for this user")
        # Get all work orders for the user
        work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).all()
        
        if not work_orders:
            return {
                "status": "success",
                "message": "No work orders found to delete",
                "deleted_count": 0
            }
        
        work_order_ids = [wo.id for wo in work_orders]
        
        # Delete all dispensers for these work orders
        dispensers_deleted = db.query(Dispenser).filter(
            Dispenser.work_order_id.in_(work_order_ids)
        ).delete(synchronize_session=False)
        
        # Delete all work orders for the user
        work_orders_deleted = db.query(WorkOrder).filter(
            WorkOrder.user_id == user_id
        ).delete(synchronize_session=False)
        
        db.commit()
        
        logger.info(f"Cleared {work_orders_deleted} work orders and {dispensers_deleted} dispensers for user {user_id}")
        
        return {
            "status": "success",
            "message": f"Successfully cleared all work order data for user",
            "deleted_work_orders": work_orders_deleted,
            "deleted_dispensers": dispensers_deleted
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to clear work orders for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear work orders: {str(e)}")

@router.delete("/{work_order_id}")
async def delete_work_order(
    work_order_id: str,
    user_id: str = Query(..., description="User ID to verify ownership"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Delete work order and associated dispensers"""
    try:
        # Verify user can only delete their own data
        if current_user.id != user_id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to delete work orders for this user")
        work_order = db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id,
            WorkOrder.user_id == user_id
        ).first()
        
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")
        
        # Delete associated dispensers first
        db.query(Dispenser).filter(Dispenser.work_order_id == work_order_id).delete()
        
        # Delete work order
        db.delete(work_order)
        db.commit()
        
        return {
            "status": "success",
            "message": "Work order deleted successfully",
            "work_order_id": work_order_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete work order: {str(e)}")

@router.delete("/{work_order_id}/dispensers")
async def clear_dispensers(
    work_order_id: str,
    user_id: str = Query(..., description="User ID to verify ownership"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Clear all dispensers for a specific work order"""
    try:
        # Verify user can only clear their own data
        if current_user.id != user_id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to clear dispensers for this user")
        
        # Verify work order exists and belongs to user
        work_order = db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id,
            WorkOrder.user_id == user_id
        ).first()
        
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")
        
        # Delete all dispensers for this work order
        cleared_count = db.query(Dispenser).filter(
            Dispenser.work_order_id == work_order_id
        ).delete()
        
        # Clear dispenser data from scraped_data
        if work_order.scraped_data:
            work_order.scraped_data.pop("dispensers", None)
            work_order.scraped_data.pop("dispenser_count", None)
            work_order.scraped_data.pop("dispenser_scrape_date", None)
            work_order.scraped_data.pop("dispensers_scraped_at", None)
            flag_modified(work_order, "scraped_data")
        
        work_order.updated_at = datetime.now()
        
        db.commit()
        
        logger.info(f"Cleared {cleared_count} dispensers for work order {work_order_id}")
        
        return {
            "status": "success",
            "message": f"Successfully cleared {cleared_count} dispensers",
            "work_order_id": work_order_id,
            "cleared_count": cleared_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to clear dispensers: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear dispensers: {str(e)}")