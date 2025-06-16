#!/usr/bin/env python3
"""
Browser Automation API routes for WorkFossa integration
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, WebSocket
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import json
import uuid
from datetime import datetime
import asyncio

from ..database import get_db
from ..models import User, WorkOrder, Dispenser
from ..services.form_automation import form_automation_service, AutomationJob, AutomationPhase
from ..services.browser_automation import browser_automation, AutomationProgress as BrowserAutomationProgress
from ..services.job_queue import job_queue_manager, create_single_visit_job, create_batch_processing_job, JobPriority, JobStatus
from ..auth.dependencies import require_auth

router = APIRouter(prefix="/api/v1/automation", tags=["automation"])

# Active automation sessions
active_sessions: Dict[str, str] = {}  # user_id -> session_id
websocket_connections: Dict[str, WebSocket] = {}  # user_id -> websocket

@router.post("/sessions")
async def create_automation_session(
    user_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Create new browser automation session"""
    try:
        # Use current_user.id instead of getting from request
        user_id = current_user.id
        email = user_data.get('email')
        password = user_data.get('password')
        
        if not all([email, password]):
            raise HTTPException(status_code=400, detail="Missing required fields: email, password")
        
        # Initialize browser automation if needed
        if not browser_automation.browser:
            await browser_automation.initialize()
        
        # Close existing session if any
        if user_id in active_sessions:
            old_session_id = active_sessions[user_id]
            await browser_automation.close_session(old_session_id)
            del active_sessions[user_id]
        
        # Create new session
        session_id = f"automation_{user_id}_{int(datetime.now().timestamp())}"
        session_created = await browser_automation.create_session(session_id)
        
        if not session_created:
            raise HTTPException(status_code=500, detail="Failed to create browser session")
        
        active_sessions[user_id] = session_id
        
        # Attempt login with provided credentials
        credentials = {'username': email, 'password': password}
        login_success = await browser_automation.navigate_to_workfossa(session_id, credentials)
        
        return {
            "success": True,
            "session_id": session_id,
            "logged_in": login_success,
            "message": "Automation session created successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@router.post("/login")
async def login_to_workfossa(
    login_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_auth)
):
    """Login to WorkFossa platform"""
    try:
        user_id = current_user.id
        email = login_data.get('email')
        password = login_data.get('password')
        
        if user_id not in active_sessions:
            raise HTTPException(status_code=400, detail="No active session. Create session first.")
        
        session_id = active_sessions[user_id]
        job_id = str(uuid.uuid4())
        
        # Get credentials from request or use stored credentials
        credentials = {}
        if email and password:
            credentials = {'username': email, 'password': password}
        else:
            # Try to get stored credentials
            try:
                from ..services.credential_manager import credential_manager
                stored_creds = await credential_manager.get_credentials(user_id, "workfossa")
                if stored_creds:
                    credentials = stored_creds
            except:
                pass
        
        if not credentials:
            raise HTTPException(status_code=400, detail="No credentials available")
        
        # Start login process in background
        background_tasks.add_task(perform_login, session_id, job_id, user_id, credentials)
        
        return {
            "success": True,
            "job_id": job_id,
            "message": "Login started"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@router.post("/scrape")
async def trigger_work_order_scraping(
    scrape_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Trigger comprehensive work order scraping from WorkFossa"""
    try:
        user_id = current_user.id
        date_range = scrape_data.get('date_range')  # Optional date filtering
        
        if user_id not in active_sessions:
            raise HTTPException(status_code=400, detail="No active session. Create session and login first.")
        
        # User is already verified through authentication
        
        session_id = active_sessions[user_id]
        job_id = str(uuid.uuid4())
        
        # Start enhanced scraping in background
        background_tasks.add_task(perform_enhanced_scraping, session_id, job_id, user_id, date_range, db)
        
        return {
            "success": True,
            "job_id": job_id,
            "message": "Enhanced work order scraping started",
            "session_id": session_id,
            "date_range": date_range
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")

@router.post("/scrape/dispensers/{work_order_id}")
async def scrape_dispenser_details(
    work_order_id: str,
    user_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Scrape detailed dispenser information for a specific work order"""
    try:
        user_id = current_user.id
        
        if user_id not in active_sessions:
            raise HTTPException(status_code=400, detail="No active session. Create session and login first.")
        
        # Verify work order exists
        work_order = db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id,
            WorkOrder.user_id == user_id
        ).first()
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")
        
        session_id = active_sessions[user_id]
        job_id = str(uuid.uuid4())
        
        # Start dispenser scraping in background
        background_tasks.add_task(perform_dispenser_scraping, session_id, job_id, user_id, work_order_id, db)
        
        return {
            "success": True,
            "job_id": job_id,
            "work_order_id": work_order_id,
            "message": "Dispenser details scraping started"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dispenser scraping failed: {str(e)}")

@router.get("/sessions/status")
async def get_session_status(current_user: User = Depends(require_auth)):
    """Get automation session status"""
    user_id = current_user.id
    try:
        if user_id not in active_sessions:
            return {
                "active": False,
                "session_id": None,
                "logged_in": False
            }
        
        session_id = active_sessions[user_id]
        
        # Check if session exists in browser automation
        context_exists = session_id in browser_automation.contexts
        page_exists = session_id in browser_automation.pages
        
        if not context_exists or not page_exists:
            # Clean up stale reference
            del active_sessions[user_id]
            return {
                "active": False,
                "session_id": None,
                "logged_in": False
            }
        
        return {
            "active": True,
            "session_id": session_id,
            "logged_in": True,  # Assume logged in if session exists
            "browser_ready": True,
            "created_at": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")

@router.delete("/sessions")
async def close_automation_session(current_user: User = Depends(require_auth)):
    """Close automation session"""
    user_id = current_user.id
    try:
        if user_id in active_sessions:
            session_id = active_sessions[user_id]
            await browser_automation.close_session(session_id)
            del active_sessions[user_id]
            
            # Close websocket if connected
            if user_id in websocket_connections:
                await websocket_connections[user_id].close()
                del websocket_connections[user_id]
        
        return {
            "success": True,
            "message": "Session closed successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to close session: {str(e)}")

@router.websocket("/ws/{token}")
async def websocket_progress_updates(websocket: WebSocket, token: str):
    """WebSocket connection for real-time automation progress"""
    # Validate token and get user_id
    from ..auth.jwt import decode_token
    try:
        payload = decode_token(token)
        user_id = payload.get('sub')
        if not user_id:
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    websocket_connections[user_id] = websocket
    
    try:
        # Set up progress callback for this user
        async def progress_callback(progress: BrowserAutomationProgress):
            if user_id in websocket_connections:
                try:
                    await websocket_connections[user_id].send_text(json.dumps({
                        "type": "automation_progress",
                        "data": {
                            "session_id": progress.session_id,
                            "phase": progress.phase.value,
                            "percentage": progress.percentage,
                            "message": progress.message,
                            "dispenser_id": progress.dispenser_id,
                            "dispenser_title": progress.dispenser_title,
                            "fuel_grades": progress.fuel_grades,
                            "timestamp": progress.timestamp.isoformat(),
                            "error": progress.error
                        }
                    }))
                except Exception as e:
                    print(f"Failed to send WebSocket message: {e}")
        
        browser_automation.add_progress_callback(progress_callback)
        
        # Keep connection alive
        while True:
            try:
                data = await websocket.receive_text()
                # Echo back for connection testing
                await websocket.send_text(json.dumps({
                    "type": "ping_response",
                    "message": "Connection active"
                }))
            except:
                break
                
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        if user_id in websocket_connections:
            del websocket_connections[user_id]

# Background task functions
async def perform_login(session_id: str, job_id: str, user_id: str, credentials: Dict[str, str]):
    """Background task to perform WorkFossa login"""
    try:
        success = await browser_automation.navigate_to_workfossa(session_id, credentials)
        
        # Send completion update via WebSocket
        if user_id in websocket_connections:
            completion_data = {
                "type": "automation_complete",
                "data": {
                    "job_id": job_id,
                    "success": success,
                    "action": "login",
                    "message": "Login completed successfully" if success else "Login failed"
                }
            }
            try:
                await websocket_connections[user_id].send_text(json.dumps(completion_data))
            except:
                pass  # WebSocket may be closed
                
    except Exception as e:
        print(f"Login background task failed: {e}")

async def perform_scraping(session_id: str, job_id: str, user_id: str, db: Session):
    """Background task to perform work order scraping"""
    try:
        # Import WorkFossa scraper
        from ..services.workfossa_scraper import workfossa_scraper
        
        # Set up progress callback for WebSocket updates
        async def scraping_progress_callback(progress):
            if user_id in websocket_connections:
                try:
                    await websocket_connections[user_id].send_text(json.dumps({
                        "type": "scraping_progress",
                        "data": {
                            "job_id": job_id,
                            "phase": progress.phase,
                            "percentage": progress.percentage,
                            "message": progress.message,
                            "work_orders_found": progress.work_orders_found,
                            "work_orders_processed": progress.work_orders_processed,
                            "errors": progress.errors,
                            "timestamp": progress.timestamp.isoformat()
                        }
                    }))
                except Exception as e:
                    print(f"Failed to send scraping progress: {e}")
        
        workfossa_scraper.add_progress_callback(scraping_progress_callback)
        
        # Scrape work orders using the comprehensive scraper
        work_order_data_list = await workfossa_scraper.scrape_work_orders(session_id)
        
        # Convert WorkOrderData objects to dictionaries for database storage
        work_orders = []
        for wo_data in work_order_data_list:
            work_orders.append({
                'id': wo_data.id,
                'external_id': wo_data.external_id,
                'site_name': wo_data.site_name,
                'address': wo_data.address,
                'status': wo_data.status,
                'scheduled_date': wo_data.scheduled_date.isoformat() if wo_data.scheduled_date else None,
                'customer_name': wo_data.customer_name,
                'dispenser_count': wo_data.dispenser_count,
                'dispensers': wo_data.dispensers,
                'visit_url': wo_data.visit_url,
                'priority': wo_data.priority
            })
        
        # Save to database
        saved_count = 0
        for wo_data in work_orders:
            try:
                # Check if work order already exists
                existing = db.query(WorkOrder).filter(
                    WorkOrder.user_id == user_id,
                    WorkOrder.external_id == wo_data.get('external_id')
                ).first()
                
                if not existing:
                    # Create new work order
                    work_order = WorkOrder(
                        id=wo_data.get('id', str(uuid.uuid4())),
                        user_id=user_id,
                        external_id=wo_data.get('external_id'),
                        site_name=wo_data.get('site_name'),
                        address=wo_data.get('address'),
                        scheduled_date=datetime.fromisoformat(wo_data['scheduled_date']) if wo_data.get('scheduled_date') else None,
                        status=wo_data.get('status', 'pending')
                    )
                    db.add(work_order)
                    saved_count += 1
                    
            except Exception as e:
                print(f"Failed to save work order: {e}")
                continue
        
        db.commit()
        
        # Send completion update via WebSocket
        if user_id in websocket_connections:
            completion_data = {
                "type": "automation_complete",
                "data": {
                    "job_id": job_id,
                    "success": True,
                    "action": "scraping",
                    "message": f"Scraped and saved {saved_count} work orders",
                    "work_orders_count": len(work_orders),
                    "saved_count": saved_count
                }
            }
            try:
                await websocket_connections[user_id].send_text(json.dumps(completion_data))
            except:
                pass
                
    except Exception as e:
        print(f"Scraping background task failed: {e}")
        # Send error via WebSocket
        if user_id in websocket_connections:
            error_data = {
                "type": "automation_error",
                "data": {
                    "job_id": job_id,
                    "action": "scraping",
                    "error": str(e)
                }
            }
            try:
                await websocket_connections[user_id].send_text(json.dumps(error_data))
            except:
                pass

async def perform_enhanced_scraping(session_id: str, job_id: str, user_id: str, 
                                  date_range: Optional[Dict], db: Session):
    """Enhanced background task for comprehensive work order scraping"""
    try:
        # Import WorkFossa scraper
        from ..services.workfossa_scraper import workfossa_scraper
        
        # Set up progress callback for WebSocket updates
        async def enhanced_scraping_progress_callback(progress):
            if user_id in websocket_connections:
                try:
                    await websocket_connections[user_id].send_text(json.dumps({
                        "type": "enhanced_scraping_progress",
                        "data": {
                            "job_id": job_id,
                            "phase": progress.phase,
                            "percentage": progress.percentage,
                            "message": progress.message,
                            "work_orders_found": progress.work_orders_found,
                            "work_orders_processed": progress.work_orders_processed,
                            "errors": progress.errors,
                            "timestamp": progress.timestamp.isoformat(),
                            "session_id": session_id
                        }
                    }))
                except Exception as e:
                    print(f"Failed to send enhanced scraping progress: {e}")
        
        workfossa_scraper.add_progress_callback(enhanced_scraping_progress_callback)
        
        # Scrape work orders using the comprehensive scraper with date filtering
        work_order_data_list = await workfossa_scraper.scrape_work_orders(session_id, date_range)
        
        # Process and save work orders
        saved_count = 0
        updated_count = 0
        skipped_count = 0
        
        for wo_data in work_order_data_list:
            try:
                # Check if work order already exists
                existing = db.query(WorkOrder).filter(
                    WorkOrder.user_id == user_id,
                    WorkOrder.external_id == wo_data.external_id
                ).first()
                
                if existing:
                    # Update existing work order with new data
                    existing.site_name = wo_data.site_name
                    existing.address = wo_data.address
                    existing.status = wo_data.status
                    if wo_data.scheduled_date:
                        existing.scheduled_date = wo_data.scheduled_date
                    existing.updated_at = datetime.now()
                    updated_count += 1
                else:
                    # Create new work order
                    work_order = WorkOrder(
                        id=wo_data.id,
                        user_id=user_id,
                        external_id=wo_data.external_id,
                        site_name=wo_data.site_name,
                        address=wo_data.address,
                        scheduled_date=wo_data.scheduled_date,
                        status=wo_data.status
                    )
                    db.add(work_order)
                    saved_count += 1
                    
                    # Create dispenser records if available
                    if wo_data.dispensers:
                        for dispenser_data in wo_data.dispensers:
                            dispenser = Dispenser(
                                id=str(uuid.uuid4()),
                                work_order_id=wo_data.id,
                                dispenser_number=dispenser_data.get('dispenser_number'),
                                dispenser_type=dispenser_data.get('dispenser_type'),
                                fuel_grades=dispenser_data.get('fuel_grades', {}),
                                automation_completed=False,
                                progress_percentage=0.0
                            )
                            db.add(dispenser)
                    
            except Exception as e:
                print(f"Failed to save work order {wo_data.external_id}: {e}")
                skipped_count += 1
                continue
        
        db.commit()
        
        # Send completion update via WebSocket
        if user_id in websocket_connections:
            completion_data = {
                "type": "enhanced_scraping_complete",
                "data": {
                    "job_id": job_id,
                    "success": True,
                    "action": "enhanced_scraping",
                    "message": f"Enhanced scraping completed: {saved_count} new, {updated_count} updated, {skipped_count} skipped",
                    "results": {
                        "total_found": len(work_order_data_list),
                        "new_work_orders": saved_count,
                        "updated_work_orders": updated_count,
                        "skipped_work_orders": skipped_count,
                        "dispensers_created": sum(len(wo.dispensers) for wo in work_order_data_list if wo.dispensers)
                    },
                    "timestamp": datetime.now().isoformat()
                }
            }
            try:
                await websocket_connections[user_id].send_text(json.dumps(completion_data))
            except:
                pass
                
    except Exception as e:
        print(f"Enhanced scraping background task failed: {e}")
        # Send error via WebSocket
        if user_id in websocket_connections:
            error_data = {
                "type": "enhanced_scraping_error",
                "data": {
                    "job_id": job_id,
                    "action": "enhanced_scraping",
                    "error": str(e),
                    "timestamp": datetime.now().isoformat()
                }
            }
            try:
                await websocket_connections[user_id].send_text(json.dumps(error_data))
            except:
                pass

async def perform_dispenser_scraping(session_id: str, job_id: str, user_id: str, 
                                   work_order_id: str, db: Session):
    """Background task for detailed dispenser scraping"""
    try:
        # Import WorkFossa scraper
        from ..services.workfossa_scraper import workfossa_scraper
        
        # Scrape detailed dispenser information
        dispensers = await workfossa_scraper.scrape_dispenser_details(session_id, work_order_id)
        
        # Update database with dispenser information
        saved_count = 0
        updated_count = 0
        
        for dispenser_data in dispensers:
            try:
                # Check if dispenser already exists
                existing = db.query(Dispenser).filter(
                    Dispenser.work_order_id == work_order_id,
                    Dispenser.dispenser_number == dispenser_data['dispenser_number']
                ).first()
                
                if existing:
                    # Update existing dispenser
                    existing.dispenser_type = dispenser_data['dispenser_type']
                    existing.fuel_grades = dispenser_data['fuel_grades']
                    existing.updated_at = datetime.now()
                    updated_count += 1
                else:
                    # Create new dispenser
                    dispenser = Dispenser(
                        id=str(uuid.uuid4()),
                        work_order_id=work_order_id,
                        dispenser_number=dispenser_data['dispenser_number'],
                        dispenser_type=dispenser_data['dispenser_type'],
                        fuel_grades=dispenser_data['fuel_grades'],
                        automation_completed=False,
                        progress_percentage=0.0
                    )
                    db.add(dispenser)
                    saved_count += 1
                    
            except Exception as e:
                print(f"Failed to save dispenser {dispenser_data['dispenser_number']}: {e}")
                continue
        
        db.commit()
        
        # Send completion update via WebSocket
        if user_id in websocket_connections:
            completion_data = {
                "type": "dispenser_scraping_complete",
                "data": {
                    "job_id": job_id,
                    "work_order_id": work_order_id,
                    "success": True,
                    "message": f"Dispenser scraping completed: {saved_count} new, {updated_count} updated",
                    "dispensers_found": len(dispensers),
                    "dispensers_saved": saved_count,
                    "dispensers_updated": updated_count
                }
            }
            try:
                await websocket_connections[user_id].send_text(json.dumps(completion_data))
            except:
                pass
                
    except Exception as e:
        print(f"Dispenser scraping background task failed: {e}")
        # Send error via WebSocket
        if user_id in websocket_connections:
            error_data = {
                "type": "dispenser_scraping_error",
                "data": {
                    "job_id": job_id,
                    "work_order_id": work_order_id,
                    "error": str(e)
                }
            }
            try:
                await websocket_connections[user_id].send_text(json.dumps(error_data))
            except:
                pass

# FORM AUTOMATION ENDPOINTS

@router.post("/form/process-visit")
async def process_visit_automation(
    automation_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Start form automation for a single visit"""
    try:
        user_id = current_user.id
        visit_url = automation_data.get('visit_url')
        work_order_id = automation_data.get('work_order_id')
        dispensers = automation_data.get('dispensers', [])
        credentials = automation_data.get('credentials', {})
        
        if not all([visit_url, work_order_id]):
            raise HTTPException(status_code=400, detail="Missing required fields: visit_url, work_order_id")
        
        # User is already verified through authentication
        
        # Verify work order exists
        work_order = db.query(WorkOrder).filter(
            WorkOrder.id == work_order_id,
            WorkOrder.user_id == user_id
        ).first()
        if not work_order:
            raise HTTPException(status_code=404, detail="Work order not found")
        
        # Set up form automation service with browser automation
        if not form_automation_service.browser_automation:
            form_automation_service.browser_automation = browser_automation
        
        # Add WebSocket progress callback
        async def websocket_progress_callback(progress):
            if user_id in websocket_connections:
                try:
                    await websocket_connections[user_id].send_text(json.dumps({
                        "type": "form_automation_progress",
                        "data": {
                            "job_id": progress.job_id,
                            "phase": progress.phase.value,
                            "percentage": progress.percentage,
                            "message": progress.message,
                            "dispenser_id": progress.dispenser_id,
                            "dispenser_title": progress.dispenser_title,
                            "fuel_grades": progress.fuel_grades,
                            "timestamp": progress.timestamp.isoformat()
                        }
                    }))
                except Exception as e:
                    print(f"Failed to send form automation progress: {e}")
        
        form_automation_service.add_progress_callback(websocket_progress_callback)
        
        # Start form automation in background
        options = {'credentials': credentials}
        background_tasks.add_task(
            run_form_automation,
            user_id, visit_url, work_order_id, dispensers, options, db
        )
        
        return {
            "success": True,
            "message": "Form automation started",
            "visit_url": visit_url,
            "dispensers_count": len(dispensers)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start form automation: {str(e)}")

@router.post("/form/process-batch")
async def process_batch_automation(
    batch_data: Dict[str, Any],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Start enhanced form automation for multiple visits (batch processing)"""
    try:
        user_id = current_user.id
        visits = batch_data.get('visits', [])
        credentials = batch_data.get('credentials', {})
        batch_config = batch_data.get('batch_config', {})
        
        if not visits:
            raise HTTPException(status_code=400, detail="Missing required field: visits")
        
        # User is already verified through authentication
        
        # Set up form automation service
        if not form_automation_service.browser_automation:
            form_automation_service.browser_automation = browser_automation
        
        # Generate batch ID and store batch metadata
        batch_id = str(uuid.uuid4())
        batch_metadata = {
            'batch_id': batch_id,
            'user_id': user_id,
            'total_visits': len(visits),
            'concurrent_jobs': batch_config.get('concurrent_jobs', 1),
            'delay_between_jobs': batch_config.get('delay_between_jobs', 5000),
            'retry_attempts': batch_config.get('retry_attempts', 3),
            'auto_continue_on_error': batch_config.get('auto_continue_on_error', False),
            'notify_on_completion': batch_config.get('notify_on_completion', True),
            'created_at': datetime.now().isoformat(),
            'status': 'running'
        }
        
        # Add enhanced WebSocket progress callback for batch
        async def enhanced_batch_progress_callback(progress):
            if user_id in websocket_connections:
                try:
                    await websocket_connections[user_id].send_text(json.dumps({
                        "type": "batch_automation_progress",
                        "data": {
                            "batch_id": batch_id,
                            "job_id": progress.job_id,
                            "phase": progress.phase.value,
                            "percentage": progress.percentage,
                            "message": progress.message,
                            "dispenser_id": getattr(progress, 'dispenser_id', None),
                            "dispenser_title": getattr(progress, 'dispenser_title', None),
                            "fuel_grades": getattr(progress, 'fuel_grades', []),
                            "timestamp": progress.timestamp.isoformat(),
                            "batch_metadata": batch_metadata
                        }
                    }))
                except Exception as e:
                    print(f"Failed to send enhanced batch progress: {e}")
        
        form_automation_service.add_progress_callback(enhanced_batch_progress_callback)
        
        # Get credentials from secure storage if not provided
        if not credentials or not credentials.get('username'):
            try:
                from ..services.credential_manager import credential_manager
                stored_credentials = await credential_manager.get_credentials(user_id, "workfossa")
                if stored_credentials:
                    credentials = stored_credentials
            except ImportError:
                logger.warning("Credential manager not available")
        
        # Start enhanced batch automation in background
        options = {
            'credentials': credentials,
            'batch_config': batch_config,
            'batch_metadata': batch_metadata
        }
        background_tasks.add_task(
            run_enhanced_batch_automation,
            user_id, visits, options, db, batch_id
        )
        
        return {
            "success": True,
            "batch_id": batch_id,
            "message": "Enhanced batch form automation started",
            "visits_count": len(visits),
            "batch_config": batch_config,
            "estimated_duration_minutes": len(visits) * 5  # Estimate 5 minutes per visit
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start batch automation: {str(e)}")

@router.get("/form/jobs/{job_id}/status")
async def get_form_automation_status(job_id: str, current_user: User = Depends(require_auth)):
    """Get status of form automation job"""
    try:
        status = await form_automation_service.get_job_status(job_id)
        if not status:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {
            "success": True,
            "job": status
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job status: {str(e)}")

@router.post("/form/jobs/{job_id}/cancel")
async def cancel_form_automation(job_id: str, current_user: User = Depends(require_auth)):
    """Cancel running form automation job"""
    try:
        success = await form_automation_service.cancel_job(job_id)
        if not success:
            raise HTTPException(status_code=404, detail="Job not found or already completed")
        
        return {
            "success": True,
            "message": "Job cancelled successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel job: {str(e)}")

@router.get("/form/fuel-templates")
async def get_fuel_grade_templates(current_user: User = Depends(require_auth)):
    """Get available fuel grade templates"""
    try:
        from ..services.form_automation import FuelGradeTemplates
        
        templates = {
            "regular_plus_premium": FuelGradeTemplates.REGULAR_PLUS_PREMIUM,
            "regular_plus_premium_diesel": FuelGradeTemplates.REGULAR_PLUS_PREMIUM_DIESEL,
            "ethanol_free_variants": FuelGradeTemplates.ETHANOL_FREE_VARIANTS,
            "three_grade_ethanol_diesel": FuelGradeTemplates.THREE_GRADE_ETHANOL_DIESEL
        }
        
        return {
            "success": True,
            "templates": templates
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get templates: {str(e)}")

# Background task functions for form automation
async def run_form_automation(user_id: str, visit_url: str, work_order_id: str, 
                            dispensers: List[Dict[str, Any]], options: Dict[str, Any], db: Session):
    """Background task to run single visit form automation"""
    try:
        job_id = await form_automation_service.process_visit(
            user_id=user_id,
            visit_url=visit_url,
            work_order_id=work_order_id,
            dispensers=dispensers,
            options=options
        )
        
        # Update dispensers in database with automation results
        try:
            for dispenser_data in dispensers:
                if dispenser_data.get('automation_completed'):
                    # Find and update dispenser record
                    dispenser = db.query(Dispenser).filter(
                        Dispenser.work_order_id == work_order_id,
                        Dispenser.dispenser_number == dispenser_data['dispenser_number']
                    ).first()
                    
                    if dispenser:
                        dispenser.automation_completed = True
                        dispenser.progress_percentage = dispenser_data.get('progress_percentage', 100.0)
                    else:
                        # Create new dispenser record
                        new_dispenser = Dispenser(
                            id=str(uuid.uuid4()),
                            work_order_id=work_order_id,
                            dispenser_number=dispenser_data['dispenser_number'],
                            dispenser_type=dispenser_data.get('dispenser_type'),
                            fuel_grades=dispenser_data.get('fuel_grades', {}),
                            automation_completed=True,
                            progress_percentage=dispenser_data.get('progress_percentage', 100.0)
                        )
                        db.add(new_dispenser)
            
            db.commit()
            
        except Exception as e:
            print(f"Failed to update dispensers in database: {e}")
        
        # Send completion notification
        if user_id in websocket_connections:
            try:
                await websocket_connections[user_id].send_text(json.dumps({
                    "type": "form_automation_complete",
                    "data": {
                        "job_id": job_id,
                        "visit_url": visit_url,
                        "message": "Form automation completed successfully",
                        "dispensers_processed": len(dispensers)
                    }
                }))
            except:
                pass
                
    except Exception as e:
        print(f"Form automation background task failed: {e}")
        # Send error notification
        if user_id in websocket_connections:
            try:
                await websocket_connections[user_id].send_text(json.dumps({
                    "type": "form_automation_error",
                    "data": {
                        "visit_url": visit_url,
                        "error": str(e)
                    }
                }))
            except:
                pass

async def run_batch_automation(user_id: str, visits: List[Dict[str, Any]], 
                             options: Dict[str, Any], db: Session):
    """Background task to run batch form automation"""
    try:
        job_ids = await form_automation_service.process_batch(
            user_id=user_id,
            batch_data=visits,
            options=options
        )
        
        # Send completion notification
        if user_id in websocket_connections:
            try:
                await websocket_connections[user_id].send_text(json.dumps({
                    "type": "batch_automation_complete",
                    "data": {
                        "job_ids": job_ids,
                        "message": f"Batch automation completed: {len(job_ids)} jobs processed",
                        "visits_processed": len(visits)
                    }
                }))
            except:
                pass
                
    except Exception as e:
        print(f"Batch automation background task failed: {e}")
        # Send error notification
        if user_id in websocket_connections:
            try:
                await websocket_connections[user_id].send_text(json.dumps({
                    "type": "batch_automation_error",
                    "data": {
                        "error": str(e),
                        "visits_count": len(visits)
                    }
                }))
            except:
                pass

async def run_enhanced_batch_automation(user_id: str, visits: List[Dict[str, Any]], 
                                      options: Dict[str, Any], db: Session, batch_id: str):
    """Enhanced background task for batch form automation with advanced features"""
    try:
        batch_config = options.get('batch_config', {})
        batch_metadata = options.get('batch_metadata', {})
        
        # Update batch metadata
        batch_metadata['status'] = 'running'
        batch_metadata['started_at'] = datetime.now().isoformat()
        
        # Process visits with configuration
        concurrent_jobs = batch_config.get('concurrent_jobs', 1)
        delay_between_jobs = batch_config.get('delay_between_jobs', 5000) / 1000  # Convert to seconds
        retry_attempts = batch_config.get('retry_attempts', 3)
        auto_continue_on_error = batch_config.get('auto_continue_on_error', False)
        
        job_ids = []
        successful_jobs = 0
        failed_jobs = 0
        errors = []
        
        # Process visits with concurrency control
        for i in range(0, len(visits), concurrent_jobs):
            batch = visits[i:i + concurrent_jobs]
            batch_tasks = []
            
            for visit in batch:
                # Send batch progress update
                if user_id in websocket_connections:
                    try:
                        await websocket_connections[user_id].send_text(json.dumps({
                            "type": "batch_automation_progress",
                            "data": {
                                "batch_id": batch_id,
                                "phase": "processing",
                                "percentage": (i / len(visits)) * 100,
                                "message": f"Processing work order {visit.get('work_order_id', 'unknown')}",
                                "current_visit": visit.get('work_order_id'),
                                "completed_visits": successful_jobs,
                                "total_visits": len(visits),
                                "timestamp": datetime.now().isoformat(),
                                "batch_metadata": batch_metadata
                            }
                        }))
                    except:
                        pass
                
                # Process individual visit with retry logic
                for attempt in range(retry_attempts + 1):
                    try:
                        job_id = await form_automation_service.process_visit(
                            user_id=user_id,
                            visit_url=visit.get('visit_url', ''),
                            work_order_id=visit.get('work_order_id', ''),
                            dispensers=visit.get('dispensers', []),
                            options=options
                        )
                        job_ids.append(job_id)
                        successful_jobs += 1
                        break
                        
                    except Exception as e:
                        if attempt < retry_attempts:
                            print(f"Attempt {attempt + 1} failed for {visit.get('work_order_id')}: {e}")
                            await asyncio.sleep(2)  # Wait before retry
                        else:
                            failed_jobs += 1
                            error_msg = f"Work order {visit.get('work_order_id')}: {str(e)}"
                            errors.append(error_msg)
                            print(f"All retry attempts failed for {visit.get('work_order_id')}: {e}")
                            
                            if not auto_continue_on_error:
                                # Stop batch on error if not configured to continue
                                raise Exception(f"Batch stopped due to error: {error_msg}")
                
                # Delay between jobs
                if delay_between_jobs > 0:
                    await asyncio.sleep(delay_between_jobs)
        
        # Update final batch metadata
        batch_metadata['status'] = 'completed' if failed_jobs == 0 else 'completed_with_errors'
        batch_metadata['completed_at'] = datetime.now().isoformat()
        batch_metadata['results'] = {
            'successful': successful_jobs,
            'failed': failed_jobs,
            'errors': errors
        }
        
        # Send final completion notification
        if user_id in websocket_connections:
            try:
                await websocket_connections[user_id].send_text(json.dumps({
                    "type": "batch_automation_complete",
                    "data": {
                        "batch_id": batch_id,
                        "job_ids": job_ids,
                        "message": f"Enhanced batch completed: {successful_jobs} successful, {failed_jobs} failed",
                        "successful": successful_jobs,
                        "failed": failed_jobs,
                        "errors": errors,
                        "batch_metadata": batch_metadata,
                        "timestamp": datetime.now().isoformat()
                    }
                }))
            except:
                pass
                
    except Exception as e:
        print(f"Enhanced batch automation failed: {e}")
        
        # Update batch metadata for failure
        batch_metadata['status'] = 'failed'
        batch_metadata['completed_at'] = datetime.now().isoformat()
        batch_metadata['error'] = str(e)
        
        # Send error notification
        if user_id in websocket_connections:
            try:
                await websocket_connections[user_id].send_text(json.dumps({
                    "type": "batch_automation_error",
                    "data": {
                        "batch_id": batch_id,
                        "error": str(e),
                        "batch_metadata": batch_metadata,
                        "timestamp": datetime.now().isoformat()
                    }
                }))
            except:
                pass

# Enhanced batch management endpoints
@router.get("/batch/{batch_id}/status")
async def get_batch_status(batch_id: str, current_user: User = Depends(require_auth)):
    """Get detailed status of a batch automation job"""
    try:
        # In a production system, this would query a database
        # For now, we'll return a mock response
        return {
            "batch_id": batch_id,
            "status": "running",
            "progress": {
                "total_visits": 5,
                "completed_visits": 2,
                "current_visit": "WO-110159",
                "total_dispensers": 15,
                "completed_dispensers": 8,
                "current_dispenser": "3"
            },
            "started_at": datetime.now().isoformat(),
            "estimated_completion": (datetime.now().timestamp() + 900),  # 15 minutes from now
            "results": {
                "successful": 2,
                "failed": 0,
                "errors": []
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get batch status: {str(e)}")

@router.post("/batch/{batch_id}/pause")
async def pause_batch(batch_id: str, current_user: User = Depends(require_auth)):
    """Pause a running batch automation job"""
    try:
        # Implementation would pause the actual batch process
        return {
            "success": True,
            "batch_id": batch_id,
            "message": "Batch automation paused",
            "paused_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to pause batch: {str(e)}")

@router.post("/batch/{batch_id}/resume")
async def resume_batch(batch_id: str, current_user: User = Depends(require_auth)):
    """Resume a paused batch automation job"""
    try:
        # Implementation would resume the actual batch process
        return {
            "success": True,
            "batch_id": batch_id,
            "message": "Batch automation resumed",
            "resumed_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume batch: {str(e)}")

@router.post("/batch/{batch_id}/cancel")
async def cancel_batch(batch_id: str, current_user: User = Depends(require_auth)):
    """Cancel a running batch automation job"""
    try:
        # Implementation would cancel the actual batch process
        return {
            "success": True,
            "batch_id": batch_id,
            "message": "Batch automation cancelled",
            "cancelled_at": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel batch: {str(e)}")

@router.get("/batches")
async def list_user_batches(status: Optional[str] = None, limit: int = 20, current_user: User = Depends(require_auth)):
    user_id = current_user.id
    """List batch automation jobs for a user"""
    try:
        # In production, this would query the database
        mock_batches = [
            {
                "batch_id": "batch_001",
                "name": "Morning Route Batch",
                "status": "completed",
                "work_orders_count": 3,
                "dispensers_count": 9,
                "created_at": datetime.now().isoformat(),
                "completed_at": datetime.now().isoformat(),
                "results": {"successful": 3, "failed": 0}
            },
            {
                "batch_id": "batch_002", 
                "name": "Emergency Calibration Batch",
                "status": "running",
                "work_orders_count": 5,
                "dispensers_count": 15,
                "created_at": datetime.now().isoformat(),
                "progress": {"completed_visits": 2, "total_visits": 5}
            }
        ]
        
        # Filter by status if provided
        if status:
            mock_batches = [b for b in mock_batches if b['status'] == status]
        
        return {
            "batches": mock_batches[:limit],
            "total_count": len(mock_batches),
            "user_id": user_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list batches: {str(e)}")

# JOB QUEUE MANAGEMENT ENDPOINTS

@router.post("/queue/jobs")
async def submit_automation_job(
    job_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_auth)
):
    """Submit a new automation job to the queue"""
    try:
        user_id = current_user.id
        job_type = job_data.get('job_type')  # 'single_visit' or 'batch_processing'
        priority = job_data.get('priority', 'normal')
        
        if not job_type:
            raise HTTPException(status_code=400, detail="Missing required field: job_type")
        
        # User is already verified through authentication
        
        # Convert priority string to enum
        priority_map = {
            'low': JobPriority.LOW,
            'normal': JobPriority.NORMAL,
            'high': JobPriority.HIGH,
            'urgent': JobPriority.URGENT,
            'critical': JobPriority.CRITICAL
        }
        job_priority = priority_map.get(priority.lower(), JobPriority.NORMAL)
        
        # Create appropriate job based on type
        if job_type == 'single_visit':
            work_order_id = job_data.get('work_order_id')
            visit_url = job_data.get('visit_url')
            dispensers = job_data.get('dispensers', [])
            
            if not all([work_order_id, visit_url]):
                raise HTTPException(status_code=400, detail="Missing required fields for single visit: work_order_id, visit_url")
            
            job = create_single_visit_job(
                user_id=user_id,
                work_order_id=work_order_id,
                visit_url=visit_url,
                dispensers=dispensers,
                priority=job_priority
            )
            
        elif job_type == 'batch_processing':
            batch_data = job_data.get('batch_data', {})
            if not batch_data or not batch_data.get('visits'):
                raise HTTPException(status_code=400, detail="Missing required field for batch processing: batch_data.visits")
            
            job = create_batch_processing_job(
                user_id=user_id,
                batch_data=batch_data,
                priority=job_priority
            )
            
        else:
            raise HTTPException(status_code=400, detail=f"Unknown job type: {job_type}")
        
        # Submit job to queue
        job_id = await job_queue_manager.submit_job(job)
        
        return {
            "success": True,
            "job_id": job_id,
            "message": f"Job submitted to queue with priority {priority}",
            "queue_position": "calculating...",  # Could be enhanced to show actual position
            "estimated_start_time": "calculating..."  # Could be enhanced with actual estimates
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit job: {str(e)}")

@router.get("/queue/jobs/{job_id}")
async def get_job_status(job_id: str, current_user: User = Depends(require_auth)):
    """Get detailed status of a queued automation job"""
    try:
        status = job_queue_manager.get_job_status(job_id)
        if not status:
            raise HTTPException(status_code=404, detail="Job not found")
        
        return {
            "success": True,
            "job": status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job status: {str(e)}")

@router.post("/queue/jobs/{job_id}/cancel")
async def cancel_queued_job(job_id: str, current_user: User = Depends(require_auth)):
    """Cancel a queued or running automation job"""
    try:
        success = await job_queue_manager.cancel_job(job_id)
        if not success:
            raise HTTPException(status_code=404, detail="Job not found or cannot be cancelled")
        
        return {
            "success": True,
            "message": "Job cancelled successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel job: {str(e)}")

@router.get("/queue/status")
async def get_queue_status(current_user: User = Depends(require_auth)):
    """Get overall job queue status and metrics"""
    try:
        status = job_queue_manager.get_queue_status()
        return {
            "success": True,
            "queue_status": status
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get queue status: {str(e)}")

@router.post("/queue/start")
async def start_queue_processing(current_user: User = Depends(require_auth)):
    """Start queue processing (admin function)"""
    try:
        await job_queue_manager.start_processing()
        return {
            "success": True,
            "message": "Queue processing started"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start queue processing: {str(e)}")

@router.post("/queue/stop")
async def stop_queue_processing(current_user: User = Depends(require_auth)):
    """Stop queue processing (admin function)"""
    try:
        await job_queue_manager.stop_processing()
        return {
            "success": True,
            "message": "Queue processing stopped"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop queue processing: {str(e)}")

@router.get("/queue/jobs")
async def list_jobs(status: Optional[str] = None, limit: int = 50, current_user: User = Depends(require_auth)):
    user_id = current_user.id
    """List jobs in the queue with optional filtering"""
    try:
        # Get all jobs from queue manager
        all_jobs = []
        for job_id, job in job_queue_manager.jobs.items():
            job_status = job_queue_manager.get_job_status(job_id)
            if job_status:
                # Apply filters - always filter by current user
                if job_status.get('user_id') != user_id:
                    continue
                if status and job_status.get('status') != status:
                    continue
                    
                all_jobs.append(job_status)
        
        # Sort by creation time (newest first)
        all_jobs.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return {
            "success": True,
            "jobs": all_jobs[:limit],
            "total_count": len(all_jobs),
            "filters": {
                "user_id": user_id,
                "status": status,
                "limit": limit
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list jobs: {str(e)}")

@router.websocket("/queue/ws/{token}")
async def queue_websocket_updates(websocket: WebSocket, token: str):
    """WebSocket connection for real-time queue updates"""
    # Validate token and get user_id
    from ..auth.jwt import decode_token
    try:
        payload = decode_token(token)
        user_id = payload.get('sub')
        if not user_id:
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    
    try:
        # Add progress callback for queue events
        async def queue_progress_callback(event_data):
            if event_data.get('user_id') == user_id:
                try:
                    await websocket.send_text(json.dumps({
                        "type": "queue_event",
                        "data": event_data
                    }))
                except Exception as e:
                    print(f"Failed to send queue WebSocket message: {e}")
        
        job_queue_manager.add_job_callback(queue_progress_callback)
        
        # Keep connection alive and handle messages
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle ping/status requests
                if message.get('type') == 'ping':
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "queue_status": job_queue_manager.get_queue_status()
                    }))
                elif message.get('type') == 'get_status':
                    await websocket.send_text(json.dumps({
                        "type": "status_response",
                        "data": job_queue_manager.get_queue_status()
                    }))
                    
            except:
                break
                
    except Exception as e:
        print(f"Queue WebSocket error: {e}")
    finally:
        # Cleanup: remove callback (if we had a way to remove specific callbacks)
        pass