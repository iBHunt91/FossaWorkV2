#!/usr/bin/env python3
"""
Work Order API routes - Clean RESTful endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import uuid
from datetime import datetime

from ..database import get_db
from ..models import User, WorkOrder, Dispenser
from ..services.browser_automation import browser_automation

router = APIRouter(prefix="/api/v1/work-orders", tags=["work-orders"])

@router.get("/", response_model=List[Dict[str, Any]])
async def get_work_orders(
    user_id: str,
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
            
            # Generate visit URL
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
    user_id: str,
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
        
        # Generate visit URL
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

@router.post("/scrape")
async def trigger_scrape(
    user_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Trigger work order scraping for a user"""
    try:
        # Verify user exists
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # TODO: Get actual credentials from encrypted storage
        # For now use placeholder
        credentials = {"username": "placeholder", "password": "placeholder"}
        
        # Add scraping task to background
        background_tasks.add_task(perform_scrape, user_id, credentials, db)
        
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
    user_id: str,
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
        
        # Get user credentials
        from ..services.credentials_service import get_user_credentials
        credentials = get_user_credentials(user_id)
        
        if not credentials:
            raise HTTPException(status_code=400, detail="User credentials not configured")
        
        # Generate visit URL
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
        
        # Create auto-login URL
        from ..services.browser_automation import BrowserAutomation
        browser = BrowserAutomation()
        
        # Generate a session token for auto-login
        session_token = browser.create_auto_login_session(
            user_id=user_id,
            credentials=credentials,
            redirect_url=visit_url
        )
        
        auto_login_url = f"https://app.workfossa.com/auto-login?token={session_token}&redirect={visit_url}"
        
        return {
            "visit_url": visit_url,
            "auto_login_url": auto_login_url,
            "message": "Visit URL generated successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate visit URL: {str(e)}")

async def perform_scrape(user_id: str, credentials: Dict[str, str], db: Session):
    """Background task to perform actual scraping using browser automation"""
    try:
        # Create browser session
        session = await browser_automation.create_session(user_id, credentials)
        
        # Login to WorkFossa
        login_success = await browser_automation.login_to_workfossa(session, credentials)
        if not login_success:
            # TODO: Log error and notify user
            return
        
        # Perform work order scraping
        work_orders = await browser_automation.scrape_work_orders(session)
        
        # Store in database
        for wo_data in work_orders:
            # Create work order
            work_order = WorkOrder(
                id=wo_data.id,
                user_id=user_id,
                external_id=wo_data.external_id,
                site_name=wo_data.site_name,
                address=wo_data.address,
                scheduled_date=datetime.fromisoformat(wo_data.scheduled_date.replace('Z', '+00:00')) if wo_data.scheduled_date else None,
                status=wo_data.status
            )
            
            db.add(work_order)
            db.flush()  # Get the ID
            
            # Create dispensers
            for disp_data in wo_data.dispensers:
                dispenser = Dispenser(
                    id=str(uuid.uuid4()),
                    work_order_id=work_order.id,
                    dispenser_number=disp_data.get("dispenser_number", ""),
                    dispenser_type=disp_data.get("dispenser_type", ""),
                    fuel_grades=disp_data.get("fuel_grades", {}),
                    status=disp_data.get("status", "pending"),
                    progress_percentage=disp_data.get("progress_percentage", 0.0),
                    automation_completed=disp_data.get("automation_completed", False)
                )
                db.add(dispenser)
        
        db.commit()
        
        # Close browser session
        await browser_automation.close_session(session.session_id)
        
    except Exception as e:
        db.rollback()
        # TODO: Log error properly
        print(f"Scraping failed for user {user_id}: {e}")
        
        # Close session on error
        if 'session' in locals():
            await browser_automation.close_session(session.session_id)

@router.patch("/{work_order_id}/status")
async def update_work_order_status(
    work_order_id: str,
    user_id: str,
    status_data: Dict[str, str],
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

@router.delete("/{work_order_id}")
async def delete_work_order(
    work_order_id: str,
    user_id: str,
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