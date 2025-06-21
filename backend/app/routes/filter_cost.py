#!/usr/bin/env python3
"""
Filter Cost Calculation API Routes

Provides REST endpoints for filter cost analysis including:
- Work order cost calculation
- Cost trend analysis
- Budget management
- Supplier price comparison
- ROI metrics
"""

from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, condecimal
import json

from ..database import get_db
from ..services.filter_cost_calculation import FilterCostCalculationService
from ..services.filter_calculation import FilterCalculationService
from ..services.logging_service import LoggingService
from ..models.user_models import User

router = APIRouter()


class CostUpdateRequest(BaseModel):
    """Request model for updating filter costs"""
    part_number: str
    cost_per_box: condecimal(decimal_places=2, ge=0)
    supplier: Optional[str] = None
    notes: Optional[str] = None


class BudgetReportRequest(BaseModel):
    """Request model for budget report generation"""
    budget_amount: condecimal(decimal_places=2, ge=0)
    period_start: date
    period_end: date


class TrendAnalysisRequest(BaseModel):
    """Request model for cost trend analysis"""
    start_date: date
    end_date: date
    period: str = Field(default="monthly", pattern="^(daily|weekly|monthly|yearly)$")
    station_filter: Optional[str] = None


@router.post("/calculate/{work_order_id}", response_model=Dict[str, Any])
async def calculate_work_order_cost(
    work_order_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Calculate filter costs for a work order
    
    Uses the filter calculation result to determine total costs
    and provides detailed breakdown by filter type.
    """
    try:
        # First get filter calculation for this work order
        filter_service = FilterCalculationService(db)
        
        # Get work order details (mock for now)
        work_order = {
            "id": work_order_id,
            "station_name": "Test Station #123",
            "services": [
                {"type": "Fuel Filter Replacement", "description": "Replace gas filters"}
            ],
            "vehicle_info": {
                "dispensers": [
                    {"type": "gas", "count": 4},
                    {"type": "diesel", "count": 2}
                ]
            }
        }
        
        # Calculate filters needed
        filter_result = await filter_service.calculate_filters_for_work_order(
            work_order=work_order,
            visit_number=1,
            total_visits=1
        )
        
        # Calculate costs
        cost_service = FilterCostCalculationService(db)
        cost_result = await cost_service.calculate_work_order_cost(
            work_order_id=work_order_id,
            filter_calculation_result=filter_result
        )
        
        return {
            "work_order_id": cost_result.work_order_id,
            "station_name": cost_result.station_name,
            "total_cost": float(cost_result.total_cost),
            "filter_breakdown": cost_result.filter_costs,
            "calculation_date": cost_result.date.isoformat() if cost_result.date else None,
            "filters_summary": {
                "total_filters": sum(
                    f["quantity"] for f in cost_result.filter_costs.values()
                ),
                "filter_types": len(cost_result.filter_costs)
            }
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Work order cost calculation failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate costs: {str(e)}"
        )


@router.get("/filter/{part_number}", response_model=Dict[str, Any])
async def get_filter_cost(
    part_number: str,
    db: Session = Depends(get_db)
):
    """
    Get current cost information for a specific filter
    
    Returns unit cost, box cost, and price history.
    """
    try:
        service = FilterCostCalculationService(db)
        filter_cost = await service.get_filter_cost(part_number)
        
        if not filter_cost:
            raise HTTPException(
                status_code=404,
                detail=f"Filter {part_number} not found"
            )
        
        return {
            "part_number": filter_cost.part_number,
            "unit_cost": float(filter_cost.unit_cost),
            "box_cost": float(filter_cost.box_cost),
            "filters_per_box": filter_cost.filters_per_box,
            "cost_per_filter": float(filter_cost.unit_cost),
            "supplier": filter_cost.supplier,
            "last_updated": filter_cost.last_price_update.isoformat(),
            "price_history": filter_cost.price_history
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await LoggingService().log_error(
            f"Failed to get filter cost: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get filter cost: {str(e)}"
        )


@router.put("/filter/{part_number}", response_model=Dict[str, Any])
async def update_filter_cost(
    part_number: str,
    request: CostUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Update cost information for a filter
    
    Records price changes and maintains history for analysis.
    """
    try:
        service = FilterCostCalculationService(db)
        
        updated_cost = await service.update_filter_cost(
            part_number=part_number,
            new_cost_per_box=request.cost_per_box,
            supplier=request.supplier,
            notes=request.notes
        )
        
        return {
            "status": "success",
            "part_number": updated_cost.part_number,
            "new_unit_cost": float(updated_cost.unit_cost),
            "new_box_cost": float(updated_cost.box_cost),
            "supplier": updated_cost.supplier,
            "updated_by": current_user.username if current_user else "system",
            "updated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Failed to update filter cost: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update cost: {str(e)}"
        )


@router.post("/trends", response_model=Dict[str, Any])
async def analyze_cost_trends(
    request: TrendAnalysisRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Analyze filter cost trends over time
    
    Provides insights into spending patterns, identifies
    cost drivers, and forecasts future expenses.
    """
    try:
        service = FilterCostCalculationService(db)
        
        trends = await service.analyze_cost_trends(
            start_date=request.start_date,
            end_date=request.end_date,
            period=request.period,
            station_filter=request.station_filter
        )
        
        # Format response
        formatted_trends = []
        total_cost = Decimal("0.00")
        
        for trend in trends:
            total_cost += trend.total_cost
            formatted_trends.append({
                "period": {
                    "type": trend.period,
                    "start": trend.start_date.isoformat(),
                    "end": trend.end_date.isoformat()
                },
                "costs": {
                    "total": float(trend.total_cost),
                    "average_daily": float(trend.average_cost)
                },
                "filter_breakdown": {
                    part: float(cost) 
                    for part, cost in trend.filter_breakdown.items()
                },
                "trend": trend.trend_direction,
                "forecast_next": float(trend.forecast_next_period)
            })
        
        # Calculate summary statistics
        avg_period_cost = total_cost / len(trends) if trends else Decimal("0.00")
        
        return {
            "analysis_period": {
                "start": request.start_date.isoformat(),
                "end": request.end_date.isoformat(),
                "period_type": request.period
            },
            "summary": {
                "total_cost": float(total_cost),
                "period_count": len(trends),
                "average_per_period": float(avg_period_cost),
                "trend_direction": trends[-1].trend_direction if trends else "unknown"
            },
            "trends": formatted_trends,
            "insights": await _generate_trend_insights(trends)
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Cost trend analysis failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze trends: {str(e)}"
        )


@router.post("/budget/report", response_model=Dict[str, Any])
async def generate_budget_report(
    request: BudgetReportRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = None
):
    """
    Generate budget vs actual report
    
    Compares actual filter spending against budget with
    projections and alerts for budget overruns.
    """
    try:
        service = FilterCostCalculationService(db)
        user_id = current_user.id if current_user else "system"
        
        report = await service.generate_budget_report(
            user_id=user_id,
            budget_amount=request.budget_amount,
            period_start=request.period_start,
            period_end=request.period_end
        )
        
        return report
        
    except Exception as e:
        await LoggingService().log_error(
            f"Budget report generation failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate budget report: {str(e)}"
        )


@router.get("/suppliers/compare", response_model=Dict[str, Any])
async def compare_supplier_prices(
    part_numbers: Optional[str] = Query(None, description="Comma-separated part numbers"),
    db: Session = Depends(get_db)
):
    """
    Compare filter prices across suppliers
    
    Identifies cost-saving opportunities by analyzing
    price differences between suppliers.
    """
    try:
        service = FilterCostCalculationService(db)
        
        # Parse part numbers if provided
        part_list = None
        if part_numbers:
            part_list = [p.strip() for p in part_numbers.split(",")]
        
        comparison = await service.compare_supplier_prices(part_list)
        
        return comparison
        
    except Exception as e:
        await LoggingService().log_error(
            f"Supplier comparison failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to compare suppliers: {str(e)}"
        )


@router.get("/roi/metrics", response_model=Dict[str, Any])
async def calculate_roi_metrics(
    start_date: date = Query(..., description="Start of analysis period"),
    end_date: date = Query(..., description="End of analysis period"),
    db: Session = Depends(get_db)
):
    """
    Calculate return on investment metrics
    
    Provides comprehensive analysis of filter program
    efficiency and cost-effectiveness.
    """
    try:
        service = FilterCostCalculationService(db)
        
        metrics = await service.calculate_roi_metrics(
            period_start=start_date,
            period_end=end_date
        )
        
        return metrics
        
    except Exception as e:
        await LoggingService().log_error(
            f"ROI calculation failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to calculate ROI: {str(e)}"
        )


@router.get("/summary/monthly", response_model=Dict[str, Any])
async def get_monthly_cost_summary(
    year: int = Query(..., ge=2020, le=2030),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db)
):
    """
    Get cost summary for a specific month
    
    Provides quick overview of monthly filter expenses
    with breakdowns by filter type and station.
    """
    try:
        # Calculate date range
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        
        service = FilterCostCalculationService(db)
        
        # Get cost trends for the month (daily)
        trends = await service.analyze_cost_trends(
            start_date=start_date,
            end_date=end_date,
            period="daily"
        )
        
        # Calculate totals
        total_cost = sum(t.total_cost for t in trends)
        filter_totals = {}
        
        for trend in trends:
            for part, cost in trend.filter_breakdown.items():
                if part not in filter_totals:
                    filter_totals[part] = Decimal("0.00")
                filter_totals[part] += cost
        
        # Get top stations for the month
        from ..services.filter_inventory_service import FilterInventoryService
        inventory_service = FilterInventoryService(db)
        
        # Format response
        return {
            "period": {
                "year": year,
                "month": month,
                "month_name": start_date.strftime("%B"),
                "days": len(trends)
            },
            "summary": {
                "total_cost": float(total_cost),
                "daily_average": float(total_cost / len(trends)) if trends else 0,
                "filter_types_used": len(filter_totals)
            },
            "filter_breakdown": {
                part: {
                    "total_cost": float(cost),
                    "percentage": float(cost / total_cost * 100) if total_cost > 0 else 0
                }
                for part, cost in sorted(
                    filter_totals.items(),
                    key=lambda x: x[1],
                    reverse=True
                )
            },
            "daily_costs": [
                {
                    "date": trend.start_date.isoformat(),
                    "cost": float(trend.total_cost)
                }
                for trend in trends
            ]
        }
        
    except Exception as e:
        await LoggingService().log_error(
            f"Monthly summary failed: {str(e)}"
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get monthly summary: {str(e)}"
        )


# Helper functions

async def _generate_trend_insights(trends: List) -> List[Dict[str, str]]:
    """Generate insights from cost trends"""
    insights = []
    
    if not trends:
        return insights
    
    # Check for increasing costs
    if len(trends) >= 3:
        recent_costs = [t.total_cost for t in trends[-3:]]
        if all(recent_costs[i] > recent_costs[i-1] for i in range(1, 3)):
            insights.append({
                "type": "cost_increase",
                "message": "Costs have been increasing for the last 3 periods",
                "severity": "warning"
            })
    
    # Check for high-cost periods
    avg_cost = sum(t.total_cost for t in trends) / len(trends)
    high_cost_periods = [
        t for t in trends 
        if t.total_cost > avg_cost * Decimal("1.5")
    ]
    
    if high_cost_periods:
        insights.append({
            "type": "high_cost_periods",
            "message": f"{len(high_cost_periods)} periods had costs >50% above average",
            "severity": "info"
        })
    
    # Identify dominant filter types
    all_filters = {}
    for trend in trends:
        for part, cost in trend.filter_breakdown.items():
            if part not in all_filters:
                all_filters[part] = Decimal("0.00")
            all_filters[part] += cost
    
    if all_filters:
        top_filter = max(all_filters.items(), key=lambda x: x[1])
        total_filter_cost = sum(all_filters.values())
        percentage = (top_filter[1] / total_filter_cost * 100) if total_filter_cost > 0 else 0
        
        insights.append({
            "type": "dominant_filter",
            "message": f"{top_filter[0]} accounts for {percentage:.1f}% of total costs",
            "severity": "info"
        })
    
    return insights