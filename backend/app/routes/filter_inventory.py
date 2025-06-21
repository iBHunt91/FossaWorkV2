#!/usr/bin/env python3
"""
Filter Inventory API Routes

Provides REST endpoints for filter inventory management including:
- Current inventory status
- Stock transactions (add/remove)
- Usage recording from work orders
- Allocation management
- Analytics and reporting
- Reorder management
"""

from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import json

from ..database import get_db
from ..services.filter_inventory_service import FilterInventoryService
from ..services.filter_calculation import FilterCalculationService
from ..services.logging_service import LoggingService
from ..models.user_models import User

router = APIRouter()


class StockAddRequest(BaseModel):
    """Request model for adding stock"""
    part_number: str
    quantity: int = Field(..., gt=0, description="Quantity to add")
    reference_type: str = Field(..., description="PURCHASE_ORDER, MANUAL, RETURN")
    reference_id: str = Field(..., description="PO number or reference")
    unit_cost: Optional[float] = Field(None, ge=0, description="Cost per filter")
    notes: Optional[str] = None


class StockAdjustmentRequest(BaseModel):
    """Request model for stock adjustments"""
    part_number: str
    quantity: int = Field(..., description="Positive to add, negative to remove")
    reason: str = Field(..., description="Reason for adjustment")
    notes: Optional[str] = None


class FilterAllocationRequest(BaseModel):
    """Request model for allocating filters"""
    work_order_id: str
    filter_requirements: Dict[str, int] = Field(..., description="Part number to quantity mapping")
    expected_use_date: datetime


class RecordUsageRequest(BaseModel):
    """Request model for recording filter usage"""
    work_order_id: str
    filter_calculation_result: Dict[str, Any] = Field(..., description="Result from filter calculation")


class ReorderRequest(BaseModel):
    """Request model for creating reorder"""
    items: List[Dict[str, Any]] = Field(..., description="List of {part_number, quantity, unit_cost}")
    supplier_name: str
    expected_delivery: Optional[datetime] = None
    notes: Optional[str] = None


@router.post("/initialize", response_model=Dict[str, Any])
async def initialize_inventory(
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Initialize inventory records for all known filter part numbers
    
    Creates inventory records with default reorder points based on
    filter series and typical usage patterns.
    """
    try:
        service = FilterInventoryService(db)
        user_id = current_user.id if current_user else "system"
        
        result = await service.initialize_inventory(user_id)
        
        return {
            "status": "success",
            "initialized": result["initialized"],
            "part_numbers": result["part_numbers"]
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Inventory initialization failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to initialize inventory: {str(e)}"
        )


@router.get("/status", response_model=List[Dict[str, Any]])
async def get_inventory_status(
    part_number: Optional[str] = Query(None, description="Filter by part number"),
    filter_type: Optional[str] = Query(None, description="Filter by type (GAS/DIESEL/DEF)"),
    low_stock_only: bool = Query(False, description="Show only low stock items"),
    include_allocations: bool = Query(True, description="Include allocation details"),
    db: Session = Depends(get_db)
):
    """
    Get current inventory status
    
    Returns detailed inventory information including stock levels,
    allocations, and reorder status.
    """
    try:
        service = FilterInventoryService(db)
        
        inventory_status = await service.get_inventory_status(
            part_number=part_number,
            filter_type=filter_type,
            include_allocations=include_allocations
        )
        
        # Filter for low stock if requested
        if low_stock_only:
            inventory_status = [
                item for item in inventory_status
                if item["needs_reorder"] or item["stock_level"] in ["LOW_STOCK", "OUT_OF_STOCK"]
            ]
        
        return inventory_status
        
    except Exception as e:
        await LoggingService().log_error(
            f"Failed to get inventory status: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get inventory status: {str(e)}"
        )


@router.post("/add-stock", response_model=Dict[str, Any])
async def add_stock(
    request: StockAddRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Add stock to inventory (receive filters)
    
    Records receipt of filters and updates inventory levels.
    Clears low stock alerts if applicable.
    """
    try:
        service = FilterInventoryService(db)
        user_id = current_user.id if current_user else "system"
        
        transaction = await service.add_stock(
            part_number=request.part_number,
            quantity=request.quantity,
            reference_type=request.reference_type,
            reference_id=request.reference_id,
            unit_cost=request.unit_cost,
            user_id=user_id,
            notes=request.notes
        )
        
        return {
            "status": "success",
            "transaction_id": transaction.id,
            "part_number": transaction.part_number,
            "quantity_added": request.quantity,
            "new_quantity": transaction.quantity_after
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await LoggingService().log_error(
            f"Failed to add stock: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to add stock: {str(e)}"
        )


@router.post("/record-usage", response_model=Dict[str, Any])
async def record_usage(
    request: RecordUsageRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Record filter usage from a completed work order
    
    Automatically deducts filters from inventory based on the
    filter calculation result. Handles multi-day job logic.
    """
    try:
        service = FilterInventoryService(db)
        user_id = current_user.id if current_user else "system"
        
        transactions = await service.record_filter_usage(
            work_order_id=request.work_order_id,
            filter_calculation_result=request.filter_calculation_result,
            user_id=user_id
        )
        
        return {
            "status": "success",
            "work_order_id": request.work_order_id,
            "transactions": len(transactions),
            "filters_used": {
                trans.part_number: abs(trans.quantity)
                for trans in transactions
            }
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Failed to record usage: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to record usage: {str(e)}"
        )


@router.post("/allocate", response_model=Dict[str, Any])
async def allocate_filters(
    request: FilterAllocationRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Allocate filters for an upcoming work order
    
    Reserves filters to ensure availability when the work is performed.
    Returns any items with insufficient stock.
    """
    try:
        service = FilterInventoryService(db)
        user_id = current_user.id if current_user else "system"
        
        allocations = await service.allocate_filters(
            work_order_id=request.work_order_id,
            filter_requirements=request.filter_requirements,
            expected_use_date=request.expected_use_date,
            user_id=user_id
        )
        
        return {
            "status": "success",
            "work_order_id": request.work_order_id,
            "allocations": [
                {
                    "part_number": alloc.part_number,
                    "quantity": alloc.quantity,
                    "allocation_id": alloc.id
                }
                for alloc in allocations
            ]
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Failed to allocate filters: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to allocate filters: {str(e)}"
        )


@router.get("/analytics", response_model=Dict[str, Any])
async def get_usage_analytics(
    start_date: date = Query(..., description="Start date for analysis"),
    end_date: date = Query(..., description="End date for analysis"),
    part_number: Optional[str] = Query(None, description="Filter by part number"),
    db: Session = Depends(get_db)
):
    """
    Get filter usage analytics for the specified period
    
    Provides detailed analytics including usage patterns, work order counts,
    and current stock levels with days of supply calculations.
    """
    try:
        service = FilterInventoryService(db)
        
        analytics = await service.get_usage_analytics(
            start_date=start_date,
            end_date=end_date,
            part_number=part_number
        )
        
        return analytics
        
    except Exception as e:
        await LoggingService().log_error(
            f"Failed to get analytics: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get analytics: {str(e)}"
        )


@router.get("/reorder-suggestions", response_model=Dict[str, Any])
async def get_reorder_suggestions(
    include_all: bool = Query(False, description="Include all items, not just low stock"),
    db: Session = Depends(get_db)
):
    """
    Get reorder suggestions based on current stock and usage patterns
    
    Analyzes inventory levels and recent usage to suggest reorder quantities
    and timing.
    """
    try:
        service = FilterInventoryService(db)
        
        # Get current inventory status
        inventory_status = await service.get_inventory_status()
        
        # Get last 30 days usage analytics
        end_date = date.today()
        start_date = end_date - timedelta(days=30)
        analytics = await service.get_usage_analytics(start_date, end_date)
        
        suggestions = []
        for item in inventory_status:
            # Calculate suggestion based on stock level and usage
            if item["needs_reorder"] or include_all:
                avg_daily_usage = 0
                if item["part_number"] in analytics["by_part_number"]:
                    usage_data = analytics["by_part_number"][item["part_number"]]
                    avg_daily_usage = usage_data["quantity_used"] / 30
                
                days_of_supply = (
                    item["quantity_available"] / avg_daily_usage
                    if avg_daily_usage > 0 else 999
                )
                
                suggestion = {
                    "part_number": item["part_number"],
                    "description": item["description"],
                    "current_stock": item["quantity_on_hand"],
                    "available": item["quantity_available"],
                    "reorder_point": item["reorder_point"],
                    "suggested_quantity": item["reorder_quantity"],
                    "avg_daily_usage": round(avg_daily_usage, 2),
                    "days_of_supply": round(days_of_supply, 1),
                    "urgency": "HIGH" if days_of_supply < 7 else "MEDIUM" if days_of_supply < 14 else "LOW"
                }
                
                suggestions.append(suggestion)
        
        # Sort by urgency and days of supply
        suggestions.sort(key=lambda x: (
            {"HIGH": 0, "MEDIUM": 1, "LOW": 2}[x["urgency"]],
            x["days_of_supply"]
        ))
        
        return {
            "analysis_period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "suggestions": suggestions,
            "total_items": len(suggestions),
            "urgent_items": len([s for s in suggestions if s["urgency"] == "HIGH"])
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Failed to get reorder suggestions: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get reorder suggestions: {str(e)}"
        )


@router.get("/transactions/{part_number}", response_model=List[Dict[str, Any]])
async def get_transaction_history(
    part_number: str,
    transaction_type: Optional[str] = Query(None, description="Filter by transaction type"),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """
    Get transaction history for a specific part number
    
    Returns recent transactions including usage, receipts, adjustments,
    and allocations.
    """
    try:
        from ..models.filter_inventory_models import FilterInventoryTransaction
        
        query = db.query(FilterInventoryTransaction).filter_by(
            part_number=part_number
        )
        
        if transaction_type:
            query = query.filter_by(transaction_type=transaction_type)
        
        transactions = query.order_by(
            FilterInventoryTransaction.created_at.desc()
        ).limit(limit).all()
        
        return [
            {
                "transaction_id": trans.id,
                "type": trans.transaction_type,
                "quantity": trans.quantity,
                "reference_type": trans.reference_type,
                "reference_id": trans.reference_id,
                "work_order_id": trans.work_order_id,
                "station_name": trans.station_name,
                "notes": trans.notes,
                "created_at": trans.created_at.isoformat(),
                "user_id": trans.user_id
            }
            for trans in transactions
        ]
        
    except Exception as e:
        await LoggingService().log_error(
            f"Failed to get transaction history: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get transaction history: {str(e)}"
        )