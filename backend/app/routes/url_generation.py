#!/usr/bin/env python3
"""
URL Generation API routes for WorkFossa integration
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
import json
import logging

from ..database import get_db
from ..models import WorkOrder
from ..services.url_generator import WorkFossaURLGenerator, enhance_work_orders_with_urls

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/urls", tags=["url_generation"])

@router.post("/generate-visit-urls")
async def generate_visit_urls(
    work_order_data: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Generate visit URLs for work orders"""
    try:
        work_orders = work_order_data.get('work_orders', [])
        
        if not work_orders:
            raise HTTPException(status_code=400, detail="No work orders provided")
        
        # Generate URLs
        url_generator = WorkFossaURLGenerator()
        enhanced_orders = enhance_work_orders_with_urls(work_orders)
        
        # Count successful generations
        successful = sum(1 for wo in enhanced_orders 
                        if wo.get('visit_info', {}).get('url_generated', False))
        
        return {
            "success": True,
            "message": f"Generated URLs for {successful}/{len(work_orders)} work orders",
            "work_orders": enhanced_orders,
            "statistics": {
                "total_work_orders": len(work_orders),
                "urls_generated": successful,
                "generation_rate": successful / len(work_orders) if work_orders else 0
            }
        }
        
    except Exception as e:
        logger.error(f"URL generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"URL generation failed: {str(e)}")

@router.post("/generate-single-url")
async def generate_single_url(work_order: Dict[str, Any]):
    """Generate visit URL for a single work order"""
    try:
        url_generator = WorkFossaURLGenerator()
        visit_url = url_generator.generate_visit_url(work_order)
        
        if not visit_url:
            raise HTTPException(status_code=400, detail="Could not generate visit URL")
        
        is_valid = url_generator.validate_url(visit_url)
        
        return {
            "success": True,
            "visit_url": visit_url,
            "is_valid": is_valid,
            "work_order_id": work_order.get('basic_info', {}).get('id'),
            "external_id": work_order.get('basic_info', {}).get('external_id')
        }
        
    except Exception as e:
        logger.error(f"Single URL generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Single URL generation failed: {str(e)}")

@router.get("/workfossa-urls")
async def get_workfossa_urls():
    """Get essential WorkFossa URLs for automation"""
    try:
        url_generator = WorkFossaURLGenerator()
        
        return {
            "success": True,
            "urls": {
                "login": url_generator.get_workfossa_login_url(),
                "dashboard": url_generator.get_dashboard_url(),
                "base_url": url_generator.config.base_url,
                "visit_base": f"{url_generator.config.base_url}{url_generator.config.visit_base}",
                "work_order_base": f"{url_generator.config.base_url}{url_generator.config.work_order_base}"
            },
            "config": {
                "base_url": url_generator.config.base_url,
                "patterns": url_generator.config.visit_patterns
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get WorkFossa URLs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get WorkFossa URLs: {str(e)}")

@router.post("/enhance-work-orders")
async def enhance_work_orders_endpoint(
    work_order_ids: List[str],
    db: Session = Depends(get_db)
):
    """Enhance stored work orders with generated visit URLs"""
    try:
        # Get work orders from database
        work_orders = db.query(WorkOrder).filter(WorkOrder.id.in_(work_order_ids)).all()
        
        if not work_orders:
            raise HTTPException(status_code=404, detail="No work orders found")
        
        # Convert to dictionary format for URL generation
        work_order_dicts = []
        for wo in work_orders:
            work_order_dict = {
                'basic_info': {
                    'id': wo.id,
                    'external_id': wo.external_id,
                    'brand': getattr(wo, 'brand', None),
                    'store_info': getattr(wo, 'store_info', None)
                },
                'location': {
                    'site_name': wo.site_name,
                    'address': wo.address
                },
                'scheduling': {
                    'status': wo.status,
                    'scheduled_date': wo.scheduled_date.isoformat() if wo.scheduled_date else None
                }
            }
            work_order_dicts.append(work_order_dict)
        
        # Generate URLs
        enhanced_orders = enhance_work_orders_with_urls(work_order_dicts)
        
        # Update database with generated URLs
        updated_count = 0
        for enhanced_order in enhanced_orders:
            visit_info = enhanced_order.get('visit_info', {})
            visit_url = visit_info.get('visit_url')
            
            if visit_url:
                work_order_id = enhanced_order['basic_info']['id']
                work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
                if work_order:
                    # Store URL in a JSON field or create a separate field
                    # For now, we'll add it to the work order object
                    setattr(work_order, 'visit_url', visit_url)
                    updated_count += 1
        
        db.commit()
        
        return {
            "success": True,
            "message": f"Enhanced {updated_count} work orders with visit URLs",
            "enhanced_work_orders": enhanced_orders,
            "statistics": {
                "requested": len(work_order_ids),
                "found": len(work_orders),
                "enhanced": updated_count
            }
        }
        
    except Exception as e:
        logger.error(f"Work order enhancement failed: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Work order enhancement failed: {str(e)}")

@router.get("/test-real-data")
async def test_url_generation_with_real_data():
    """Test URL generation with real exported data"""
    try:
        import os
        
        # Load real data
        export_file = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'exports', 'work_orders_export_20250607_163409.json')
        
        if not os.path.exists(export_file):
            raise HTTPException(status_code=404, detail="Real data export file not found")
        
        with open(export_file, 'r') as f:
            data = json.load(f)
        
        work_orders = data.get('work_orders', [])[:5]  # Test with first 5
        
        if not work_orders:
            raise HTTPException(status_code=404, detail="No work orders in export file")
        
        # Generate URLs
        enhanced_orders = enhance_work_orders_with_urls(work_orders)
        
        # Collect statistics
        total = len(enhanced_orders)
        successful = sum(1 for wo in enhanced_orders 
                        if wo.get('visit_info', {}).get('url_generated', False))
        
        sample_urls = []
        for wo in enhanced_orders[:3]:  # Show first 3 as samples
            visit_info = wo.get('visit_info', {})
            if visit_info.get('visit_url'):
                sample_urls.append({
                    'work_order_id': wo.get('basic_info', {}).get('id'),
                    'external_id': wo.get('basic_info', {}).get('external_id'),
                    'visit_url': visit_info.get('visit_url'),
                    'site_name': wo.get('location', {}).get('site_name')
                })
        
        return {
            "success": True,
            "message": f"Tested URL generation with real data",
            "statistics": {
                "total_work_orders": total,
                "urls_generated": successful,
                "generation_rate": successful / total if total else 0,
                "sample_count": len(sample_urls)
            },
            "sample_urls": sample_urls,
            "export_file_info": {
                "file_exists": True,
                "total_work_orders_in_file": len(data.get('work_orders', [])),
                "tested_count": total
            }
        }
        
    except Exception as e:
        logger.error(f"Real data URL generation test failed: {e}")
        raise HTTPException(status_code=500, detail=f"Real data test failed: {str(e)}")