#!/usr/bin/env python3
"""
Work Order API routes - Clean RESTful endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from typing import List, Dict, Any
import uuid
import logging
from datetime import datetime

from ..database import get_db
from ..models import User, WorkOrder, Dispenser
from ..services.browser_automation import browser_automation, BrowserAutomationService
from ..services.workfossa_scraper import WorkOrderData

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/work-orders", tags=["work-orders"])

# Global dictionary to track scraping progress
scraping_progress = {}

@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify router is working"""
    return {"message": "Work orders router is working", "timestamp": datetime.now().isoformat()}

@router.get("/debug/last-scrape")
async def debug_last_scrape():
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

@router.get("/", response_model=List[Dict[str, Any]])
async def get_work_orders(
    user_id: str = Query(..., description="User ID to fetch work orders for"),
    db: Session = Depends(get_db)
):
    """Get all work orders for a user"""
    try:
        # Query work orders from database
        work_orders = db.query(WorkOrder).filter(WorkOrder.user_id == user_id).all()
        
        result = []
        for wo in work_orders:
            # Get dispensers for this work order
            dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == wo.id).all()
            
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
                "instructions": wo.instructions,
                "scraped_data": wo.scraped_data,
                "dispensers": [
                    {
                        "id": d.id,
                        "dispenser_number": d.dispenser_number,
                        "dispenser_type": d.dispenser_type,
                        "fuel_grades": d.fuel_grades,
                        "status": d.status,
                        "progress_percentage": d.progress_percentage,
                        "automation_completed": d.automation_completed
                    }
                    for d in dispensers
                ]
            }
            result.append(wo_data)
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch work orders: {str(e)}")

@router.get("/{work_order_id}", response_model=Dict[str, Any])
async def get_work_order(
    work_order_id: str,
    user_id: str = Query(..., description="User ID to verify ownership"),
    db: Session = Depends(get_db)
):
    """Get specific work order with dispensers"""
    try:
        # Find work order
        work_order = db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id,
            WorkOrder.user_id == user_id
        ).first()
        
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")
        
        # Get dispensers
        dispensers = db.query(Dispenser).filter(Dispenser.work_order_id == work_order_id).all()
        
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
            "instructions": work_order.instructions,
            "scraped_data": work_order.scraped_data,
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
                    "updated_at": d.updated_at.isoformat()
                }
                for d in dispensers
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch work order: {str(e)}")

@router.get("/scrape/progress/{user_id}")
async def get_scraping_progress(user_id: str):
    """Get current scraping progress for a user"""
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
    db: Session = Depends(get_db)
):
    """Trigger work order scraping for a user"""
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
    db: Session = Depends(get_db)
):
    """Open work order visit in browser with auto-login"""
    try:
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
        update_progress("initializing", 10, "Creating browser automation service...")
        workfossa_automation = WorkFossaAutomationService()
        
        # Create automation session with credentials
        logger.info("[SCRAPE] Creating automation session...")
        update_progress("initializing", 20, "Starting browser session...")
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
        update_progress("logging_in", 30, "Logging in to WorkFossa...")
        
        # Login to WorkFossa using the proper automation service
        logger.info("[SCRAPE] Logging in to WorkFossa...")
        login_success = await workfossa_automation.login_to_workfossa(session_id)
        if not login_success:
            logger.error("[SCRAPE] Failed to login to WorkFossa")
            update_progress("error", 0, "Failed to login to WorkFossa - please check your credentials", error="Login failed")
            await workfossa_automation.cleanup_session(session_id)
            return
        logger.info("[SCRAPE] Successfully logged in to WorkFossa")
        update_progress("logged_in", 40, "Successfully logged in, navigating to work orders...")
        
        # Get the page from WorkFossa automation service
        session_data = workfossa_automation.sessions.get(session_id)
        if not session_data or 'page' not in session_data:
            logger.error("[SCRAPE] No page found in session")
            await workfossa_automation.cleanup_session(session_id)
            return
        
        page = session_data['page']
        
        # Use the scraper to get work orders, passing the page
        logger.info("[SCRAPE] Starting work order scraping...")
        update_progress("scraping", 50, "Scraping work orders from WorkFossa...")
        
        # Add progress callback to get real-time updates
        async def scraping_progress_callback(progress):
            if hasattr(progress, 'percentage') and hasattr(progress, 'message'):
                update_progress("scraping", 50 + (progress.percentage * 0.4), progress.message, progress.work_orders_found)
        
        workfossa_scraper.add_progress_callback(scraping_progress_callback)
        work_orders = await workfossa_scraper.scrape_work_orders(session_id, page=page)
        await workfossa_automation.cleanup_session(session_id)
        
        logger.info(f"[SCRAPE] Scraped {len(work_orders)} work orders")
        update_progress("storing", 90, f"Storing {len(work_orders)} work orders in database...", len(work_orders))
        
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
                existing.instructions = wo_data.instructions
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
                    instructions=wo_data.instructions,
                    scraped_data={
                        "raw_html": wo_data.raw_html,
                        "address_components": wo_data.address_components,
                        "service_info": {
                            "type": wo_data.service_type,
                            "quantity": wo_data.service_quantity
                        },
                        "customer_url": wo_data.customer_url
                    }
                )
                db.add(work_order)
                db.flush()  # Get the ID
            
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
                    automation_completed=False
                )
                db.add(dispenser)
        
        db.commit()
        logger.info(f"Successfully stored {len(work_orders)} work orders in database")
        
        # Update progress to complete
        update_progress("completed", 100, f"Successfully scraped {len(work_orders)} work orders", len(work_orders))
        if user_id in scraping_progress:
            scraping_progress[user_id]["status"] = "completed"
            scraping_progress[user_id]["completed_at"] = datetime.now().isoformat()
        
    except Exception as e:
        logger.error(f"Scraping failed for user {user_id}: {e}", exc_info=True)
        db.rollback()
        
        # Update progress with error
        update_progress("error", 0, f"Scraping failed: {str(e)}", error=str(e))
        if user_id in scraping_progress:
            scraping_progress[user_id]["status"] = "failed"
            scraping_progress[user_id]["completed_at"] = datetime.now().isoformat()
        
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
    db: Session = Depends(get_db)
):
    """Update work order status"""
    try:
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
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """Trigger dispenser scraping for a specific work order"""
    try:
        # Verify work order exists and belongs to user
        work_order = db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id,
            WorkOrder.user_id == user_id
        ).first()
        
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")
        
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
        raise HTTPException(status_code=500, detail=f"Failed to start dispenser scraping: {str(e)}")


async def perform_dispenser_scrape(work_order_id: str, user_id: str, credentials: dict, customer_url: str):
    """Background task to scrape dispensers for a work order"""
    # Import the database session
    from ..database import SessionLocal
    db = SessionLocal()
    
    try:
        logger.info(f"Starting dispenser scrape for work order {work_order_id}")
        
        # Import automation services
        from ..services.workfossa_automation import workfossa_automation, WorkFossaCredentials
        from ..services.workfossa_scraper import workfossa_scraper
        
        # Create session
        session_id = f"dispenser_scrape_{work_order_id}"
        
        # Create credentials object
        workfossa_creds = WorkFossaCredentials(
            email=credentials["username"],
            password=credentials["password"],
            user_id=user_id
        )
        
        # Create browser session
        await workfossa_automation.create_automation_session(user_id, workfossa_creds)
        
        # Login
        login_success = await workfossa_automation.login_to_workfossa(user_id)
        if not login_success:
            raise Exception("Failed to login to WorkFossa")
        
        # Scrape dispensers
        dispensers = await workfossa_scraper.scrape_dispenser_details(
            session_id=user_id,  # Using user_id as session_id for the automation service
            work_order_id=work_order_id,
            customer_url=customer_url
        )
        
        logger.info(f"Scraped {len(dispensers)} dispensers for work order {work_order_id}")
        
        # Update database
        work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
        if work_order:
            # Delete existing dispensers
            db.query(Dispenser).filter(Dispenser.work_order_id == work_order_id).delete()
            
            # Add new dispensers
            for i, d in enumerate(dispensers):
                dispenser = Dispenser(
                    id=str(uuid.uuid4()),
                    work_order_id=work_order_id,
                    dispenser_number=d.get("dispenser_number", str(i + 1)),
                    dispenser_type=d.get("dispenser_type", "Unknown"),
                    fuel_grades=d.get("fuel_grades", {}),
                    status="pending",
                    progress_percentage=0.0,
                    automation_completed=False
                )
                db.add(dispenser)
            
            # Update scraped data
            if work_order.scraped_data is None:
                work_order.scraped_data = {}
            
            work_order.scraped_data["dispensers"] = dispensers
            work_order.scraped_data["dispenser_count"] = len(dispensers)
            work_order.scraped_data["dispenser_scrape_date"] = datetime.now().isoformat()
            work_order.scraped_data["dispensers_scraped_at"] = datetime.now().isoformat()
            
            # IMPORTANT: Mark JSON field as modified for SQLite
            flag_modified(work_order, "scraped_data")
            
            db.commit()
            logger.info(f"Updated work order {work_order_id} with {len(dispensers)} dispensers")
        
        # Cleanup
        await workfossa_automation.cleanup_session(user_id)
        
    except Exception as e:
        logger.error(f"Dispenser scraping failed for work order {work_order_id}: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


@router.post("/scrape-dispensers-batch")
async def scrape_dispensers_batch(
    user_id: str = Query(..., description="User ID to scrape dispensers for"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db)
):
    """Trigger batch dispenser scraping for all work orders with dispenser-related service codes"""
    try:
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
        
        # Find all work orders with dispenser service codes
        dispenser_service_codes = ["2861", "2862", "3146", "3002"]
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
        
        # Initialize progress tracking
        scraping_progress[f"dispensers_{user_id}"] = {
            "status": "in_progress",
            "phase": "initializing",
            "percentage": 0,
            "message": "Starting batch dispenser scraping...",
            "total_work_orders": len(work_orders),
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
        for wo in work_orders:
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
            "message": f"Batch dispenser scraping initiated for {len(work_orders)} work orders",
            "work_order_count": len(work_orders),
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start batch dispenser scraping: {str(e)}")


@router.get("/scrape-dispensers/progress/{user_id}")
async def get_dispenser_scraping_progress(user_id: str):
    """Get current dispenser scraping progress for a user"""
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
        workfossa_automation = WorkFossaAutomationService()
        
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
        
        # Process each work order
        successful = 0
        failed = 0
        
        for i, wo_data in enumerate(work_order_data):
            try:
                progress_percentage = 20 + ((i / len(work_order_data)) * 70)
                logger.info(f"🔄 [BATCH_DISPENSER] Processing work order {i+1}/{len(work_order_data)}: {wo_data['external_id']}")
                
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
                    processed=i,
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
                
                # Use the updated WorkFossa scraper method that navigates to customer page
                # Create scraper instance with the correct automation service
                from ..services.workfossa_scraper import WorkFossaScraper
                scraper = WorkFossaScraper(workfossa_automation)
                logger.info(f"🔧 [BATCH_DISPENSER] Calling scraper.scrape_dispenser_details...")
                dispensers = await scraper.scrape_dispenser_details(
                    session_id=session_id,
                    work_order_id=work_order.id,
                    customer_url=customer_url
                )
                
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
                            automation_completed=False
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
        
        # Cleanup
        await workfossa_automation.cleanup_session(session_id)
        
    except Exception as e:
        logger.error(f"Batch dispenser scraping failed: {e}", exc_info=True)
        update_progress("error", 0, f"Batch scraping failed: {str(e)}", error=str(e))
        if progress_key in scraping_progress:
            scraping_progress[progress_key]["status"] = "failed"
            scraping_progress[progress_key]["completed_at"] = datetime.now().isoformat()
        db.rollback()
    finally:
        db.close()


@router.delete("/clear-all")
async def clear_all_work_orders(
    user_id: str = Query(..., description="User ID to clear work orders for"),
    db: Session = Depends(get_db)
):
    """Clear all work orders and dispensers for a user"""
    try:
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
    db: Session = Depends(get_db)
):
    """Delete work order and associated dispensers"""
    try:
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