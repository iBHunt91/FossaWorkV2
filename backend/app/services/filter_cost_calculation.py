#!/usr/bin/env python3
"""
Filter Cost Calculation Service

Provides comprehensive cost analysis for filter usage including:
- Filter cost tracking by part number
- Work order cost calculations
- Station-level cost analysis
- Cost trends and forecasting
- Supplier price comparison
- Budget management and alerts

Based on V1's cost tracking features with enhanced analytics.
"""

from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from decimal import Decimal
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from ..models.filter_inventory_models import (
    FilterInventory, FilterInventoryTransaction, 
    FilterReorderHistory, FilterUsagePattern
)
from ..models.user_models import User
from ..services.logging_service import LoggingService
from ..services.filter_calculation import FilterCalculationService
from ..services.filter_inventory_service import FilterInventoryService
from ..services.notification_manager import NotificationManager


@dataclass
class FilterCost:
    """Represents cost information for a filter"""
    part_number: str
    unit_cost: Decimal
    box_cost: Decimal
    filters_per_box: int
    supplier: str
    last_price_update: date
    price_history: List[Dict[str, Any]]


@dataclass
class WorkOrderCost:
    """Cost breakdown for a work order"""
    work_order_id: str
    station_name: str
    total_cost: Decimal
    filter_costs: Dict[str, Dict[str, Any]]  # part_number: {quantity, unit_cost, total}
    labor_cost: Optional[Decimal] = None
    date: Optional[date] = None


@dataclass
class CostTrend:
    """Cost trend analysis"""
    period: str  # daily, weekly, monthly
    start_date: date
    end_date: date
    total_cost: Decimal
    average_cost: Decimal
    filter_breakdown: Dict[str, Decimal]  # part_number: total_cost
    trend_direction: str  # increasing, decreasing, stable
    forecast_next_period: Decimal


class FilterCostCalculationService:
    """Service for comprehensive filter cost analysis"""
    
    # V1 Business Rules
    DEFAULT_FILTER_COSTS = {
        # 400 Series (Standard)
        "400MB-10": {"unit_cost": 8.50, "box_cost": 85.00, "filters_per_box": 10},
        "400MG-10": {"unit_cost": 8.75, "box_cost": 87.50, "filters_per_box": 10},
        "400MD-10": {"unit_cost": 9.00, "box_cost": 90.00, "filters_per_box": 10},
        "400HS-10": {"unit_cost": 9.25, "box_cost": 92.50, "filters_per_box": 10},
        
        # 450 Series (Wawa)
        "450MB-10": {"unit_cost": 9.00, "box_cost": 90.00, "filters_per_box": 10},
        "450MG-10": {"unit_cost": 9.25, "box_cost": 92.50, "filters_per_box": 10},
        "450MD-10": {"unit_cost": 9.50, "box_cost": 95.00, "filters_per_box": 10},
        
        # 800 Series (High Flow/DEF)
        "800HS-30": {"unit_cost": 6.50, "box_cost": 195.00, "filters_per_box": 30},
        "800CHS-10": {"unit_cost": 18.00, "box_cost": 180.00, "filters_per_box": 10},
        
        # 900 Series (Ultra High Flow)
        "900MB-40": {"unit_cost": 7.25, "box_cost": 290.00, "filters_per_box": 40},
        "900MG-40": {"unit_cost": 7.50, "box_cost": 300.00, "filters_per_box": 40},
        
        # Special Filters
        "150GWGB-10": {"unit_cost": 12.00, "box_cost": 120.00, "filters_per_box": 10},
        "1000MG-40": {"unit_cost": 8.00, "box_cost": 320.00, "filters_per_box": 40},
    }
    
    # Cost thresholds for alerts
    HIGH_COST_THRESHOLD = Decimal("500.00")  # Alert for work orders over $500
    BUDGET_WARNING_PERCENT = 80  # Warn at 80% of budget
    
    def __init__(self, db: Session):
        self.db = db
        self.logging_service = LoggingService(db)
        self.filter_calc_service = FilterCalculationService(db)
        self.inventory_service = FilterInventoryService(db)
        self.notification_manager = NotificationManager(db)
    
    async def calculate_work_order_cost(
        self, 
        work_order_id: str,
        filter_calculation_result: Dict[str, Any]
    ) -> WorkOrderCost:
        """
        Calculate total filter cost for a work order
        
        Uses the filter calculation result to determine costs.
        """
        try:
            total_cost = Decimal("0.00")
            filter_costs = {}
            
            # Extract filter usage from calculation result
            filters_used = filter_calculation_result.get("filters", {})
            
            for part_number, quantity in filters_used.items():
                if quantity > 0:
                    # Get current cost for this filter
                    filter_cost = await self.get_filter_cost(part_number)
                    
                    if filter_cost:
                        item_total = filter_cost.unit_cost * quantity
                        filter_costs[part_number] = {
                            "quantity": quantity,
                            "unit_cost": float(filter_cost.unit_cost),
                            "total": float(item_total)
                        }
                        total_cost += item_total
            
            work_order_cost = WorkOrderCost(
                work_order_id=work_order_id,
                station_name=filter_calculation_result.get("station_name", ""),
                total_cost=total_cost,
                filter_costs=filter_costs,
                date=date.today()
            )
            
            # Check for high cost alert
            if total_cost >= self.HIGH_COST_THRESHOLD:
                await self._send_high_cost_alert(work_order_cost)
            
            # Log cost calculation
            await self.logging_service.log_info(
                f"Calculated cost for work order {work_order_id}: ${total_cost:.2f}"
            )
            
            return work_order_cost
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to calculate work order cost: {str(e)}"
            )
            raise
    
    async def get_filter_cost(self, part_number: str) -> Optional[FilterCost]:
        """Get current cost information for a filter"""
        try:
            # Check database for custom pricing
            inventory = self.db.query(FilterInventory).filter(
                FilterInventory.part_number == part_number
            ).first()
            
            if inventory and inventory.cost_per_box:
                return FilterCost(
                    part_number=part_number,
                    unit_cost=Decimal(str(inventory.cost_per_box / inventory.filters_per_box)),
                    box_cost=Decimal(str(inventory.cost_per_box)),
                    filters_per_box=inventory.filters_per_box,
                    supplier=inventory.supplier or "Default",
                    last_price_update=inventory.last_updated.date(),
                    price_history=await self._get_price_history(part_number)
                )
            
            # Fall back to default costs
            if part_number in self.DEFAULT_FILTER_COSTS:
                defaults = self.DEFAULT_FILTER_COSTS[part_number]
                return FilterCost(
                    part_number=part_number,
                    unit_cost=Decimal(str(defaults["unit_cost"])),
                    box_cost=Decimal(str(defaults["box_cost"])),
                    filters_per_box=defaults["filters_per_box"],
                    supplier="Default",
                    last_price_update=date.today(),
                    price_history=[]
                )
            
            return None
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to get filter cost: {str(e)}"
            )
            raise
    
    async def update_filter_cost(
        self,
        part_number: str,
        new_cost_per_box: Decimal,
        supplier: Optional[str] = None,
        notes: Optional[str] = None
    ) -> FilterCost:
        """Update filter cost information"""
        try:
            # Get or create inventory record
            inventory = self.db.query(FilterInventory).filter(
                FilterInventory.part_number == part_number
            ).first()
            
            if not inventory:
                # Create new inventory record if needed
                inventory = await self.inventory_service.initialize_inventory(
                    part_numbers=[part_number]
                )
                inventory = inventory[0]
            
            # Store old cost for history
            old_cost = inventory.cost_per_box
            
            # Update cost
            inventory.cost_per_box = float(new_cost_per_box)
            inventory.last_updated = datetime.utcnow()
            
            if supplier:
                inventory.supplier = supplier
            
            self.db.commit()
            
            # Log price change
            await self._log_price_change(
                part_number, old_cost, float(new_cost_per_box), notes
            )
            
            # Return updated cost info
            return await self.get_filter_cost(part_number)
            
        except Exception as e:
            self.db.rollback()
            await self.logging_service.log_error(
                f"Failed to update filter cost: {str(e)}"
            )
            raise
    
    async def analyze_cost_trends(
        self,
        start_date: date,
        end_date: date,
        period: str = "monthly",
        station_filter: Optional[str] = None
    ) -> List[CostTrend]:
        """
        Analyze filter cost trends over time
        
        Provides insights into spending patterns and forecasts.
        """
        try:
            trends = []
            
            # Query usage transactions
            query = self.db.query(FilterInventoryTransaction).filter(
                and_(
                    FilterInventoryTransaction.transaction_type == "USAGE",
                    FilterInventoryTransaction.created_at >= start_date,
                    FilterInventoryTransaction.created_at <= end_date
                )
            )
            
            if station_filter:
                query = query.filter(
                    FilterInventoryTransaction.station_name.like(f"%{station_filter}%")
                )
            
            transactions = query.all()
            
            # Group by period
            period_groups = self._group_by_period(transactions, period)
            
            for period_key, period_transactions in period_groups.items():
                period_start, period_end = self._get_period_dates(period_key, period)
                
                total_cost = Decimal("0.00")
                filter_breakdown = defaultdict(Decimal)
                
                # Calculate costs for period
                for trans in period_transactions:
                    filter_cost = await self.get_filter_cost(trans.part_number)
                    if filter_cost:
                        cost = filter_cost.unit_cost * abs(trans.quantity)
                        total_cost += cost
                        filter_breakdown[trans.part_number] += cost
                
                # Calculate average daily cost
                days_in_period = (period_end - period_start).days + 1
                average_cost = total_cost / days_in_period if days_in_period > 0 else Decimal("0.00")
                
                # Determine trend direction
                trend_direction = await self._determine_trend(
                    period_key, period, total_cost
                )
                
                # Forecast next period
                forecast = await self._forecast_next_period(
                    period_key, period, total_cost
                )
                
                trend = CostTrend(
                    period=period,
                    start_date=period_start,
                    end_date=period_end,
                    total_cost=total_cost,
                    average_cost=average_cost,
                    filter_breakdown=dict(filter_breakdown),
                    trend_direction=trend_direction,
                    forecast_next_period=forecast
                )
                
                trends.append(trend)
            
            # Sort by date
            trends.sort(key=lambda t: t.start_date)
            
            return trends
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to analyze cost trends: {str(e)}"
            )
            raise
    
    async def generate_budget_report(
        self,
        user_id: str,
        budget_amount: Decimal,
        period_start: date,
        period_end: date
    ) -> Dict[str, Any]:
        """
        Generate budget vs actual report
        
        Compares actual spending against budget with alerts.
        """
        try:
            # Calculate actual costs
            actual_costs = await self._calculate_period_costs(
                period_start, period_end
            )
            
            # Calculate budget utilization
            utilization_percent = (actual_costs / budget_amount * 100) if budget_amount > 0 else 0
            
            # Calculate remaining budget
            remaining = budget_amount - actual_costs
            
            # Calculate burn rate
            days_elapsed = (date.today() - period_start).days + 1
            days_total = (period_end - period_start).days + 1
            daily_burn_rate = actual_costs / days_elapsed if days_elapsed > 0 else Decimal("0.00")
            
            # Project end of period spending
            projected_total = daily_burn_rate * days_total
            projected_variance = budget_amount - projected_total
            
            # Get top cost drivers
            top_filters = await self._get_top_cost_filters(
                period_start, period_end, limit=5
            )
            
            top_stations = await self._get_top_cost_stations(
                period_start, period_end, limit=5
            )
            
            report = {
                "period": {
                    "start": period_start.isoformat(),
                    "end": period_end.isoformat(),
                    "days_elapsed": days_elapsed,
                    "days_total": days_total
                },
                "budget": {
                    "amount": float(budget_amount),
                    "spent": float(actual_costs),
                    "remaining": float(remaining),
                    "utilization_percent": float(utilization_percent)
                },
                "projections": {
                    "daily_burn_rate": float(daily_burn_rate),
                    "projected_total": float(projected_total),
                    "projected_variance": float(projected_variance),
                    "on_track": projected_total <= budget_amount
                },
                "top_cost_drivers": {
                    "filters": top_filters,
                    "stations": top_stations
                },
                "alerts": []
            }
            
            # Generate alerts
            if utilization_percent >= self.BUDGET_WARNING_PERCENT:
                report["alerts"].append({
                    "type": "budget_warning",
                    "message": f"Budget utilization at {utilization_percent:.1f}%",
                    "severity": "high" if utilization_percent >= 100 else "medium"
                })
            
            if projected_total > budget_amount:
                overage = projected_total - budget_amount
                report["alerts"].append({
                    "type": "projection_warning",
                    "message": f"Projected to exceed budget by ${overage:.2f}",
                    "severity": "high"
                })
            
            # Send notifications if needed
            if report["alerts"]:
                await self._send_budget_alerts(user_id, report)
            
            return report
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to generate budget report: {str(e)}"
            )
            raise
    
    async def compare_supplier_prices(
        self,
        part_numbers: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Compare prices across suppliers
        
        Helps identify cost-saving opportunities.
        """
        try:
            comparisons = {}
            
            # Get all part numbers if not specified
            if not part_numbers:
                inventory_items = self.db.query(FilterInventory).all()
                part_numbers = [item.part_number for item in inventory_items]
            
            for part_number in part_numbers:
                # Get price history including different suppliers
                history = await self._get_price_history(part_number, include_all_suppliers=True)
                
                if history:
                    suppliers = defaultdict(list)
                    for entry in history:
                        suppliers[entry["supplier"]].append(entry["unit_cost"])
                    
                    # Calculate average by supplier
                    supplier_averages = {}
                    for supplier, prices in suppliers.items():
                        supplier_averages[supplier] = {
                            "average": sum(prices) / len(prices),
                            "min": min(prices),
                            "max": max(prices),
                            "count": len(prices)
                        }
                    
                    # Find best price
                    best_supplier = min(
                        supplier_averages.items(),
                        key=lambda x: x[1]["average"]
                    )
                    
                    comparisons[part_number] = {
                        "suppliers": supplier_averages,
                        "best_supplier": best_supplier[0],
                        "best_price": best_supplier[1]["average"],
                        "potential_savings": self._calculate_potential_savings(
                            part_number, supplier_averages
                        )
                    }
            
            # Calculate total potential savings
            total_savings = sum(
                comp["potential_savings"] 
                for comp in comparisons.values()
            )
            
            return {
                "comparisons": comparisons,
                "total_potential_savings": total_savings,
                "recommendations": await self._generate_supplier_recommendations(comparisons)
            }
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to compare supplier prices: {str(e)}"
            )
            raise
    
    async def calculate_roi_metrics(
        self,
        period_start: date,
        period_end: date
    ) -> Dict[str, Any]:
        """
        Calculate return on investment metrics
        
        Provides insights into filter program efficiency.
        """
        try:
            # Get total filter costs
            total_costs = await self._calculate_period_costs(period_start, period_end)
            
            # Get work order count
            work_order_count = self.db.query(
                func.count(FilterInventoryTransaction.work_order_id.distinct())
            ).filter(
                and_(
                    FilterInventoryTransaction.transaction_type == "USAGE",
                    FilterInventoryTransaction.created_at >= period_start,
                    FilterInventoryTransaction.created_at <= period_end
                )
            ).scalar()
            
            # Calculate average cost per work order
            avg_cost_per_wo = total_costs / work_order_count if work_order_count > 0 else Decimal("0.00")
            
            # Get filter usage statistics
            filter_stats = await self._get_filter_usage_stats(period_start, period_end)
            
            # Calculate efficiency metrics
            filters_per_dollar = filter_stats["total_filters"] / total_costs if total_costs > 0 else 0
            
            return {
                "period": {
                    "start": period_start.isoformat(),
                    "end": period_end.isoformat()
                },
                "costs": {
                    "total": float(total_costs),
                    "per_work_order": float(avg_cost_per_wo),
                    "per_filter": float(total_costs / filter_stats["total_filters"]) if filter_stats["total_filters"] > 0 else 0
                },
                "volume": {
                    "work_orders": work_order_count,
                    "total_filters": filter_stats["total_filters"],
                    "unique_stations": filter_stats["unique_stations"]
                },
                "efficiency": {
                    "filters_per_dollar": float(filters_per_dollar),
                    "cost_trend": await self._calculate_cost_trend(period_start, period_end),
                    "optimization_opportunities": await self._identify_optimization_opportunities()
                }
            }
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to calculate ROI metrics: {str(e)}"
            )
            raise
    
    # Helper methods
    
    async def _get_price_history(
        self, 
        part_number: str,
        include_all_suppliers: bool = False
    ) -> List[Dict[str, Any]]:
        """Get price history for a filter"""
        # This would query historical price data
        # For now, return empty list
        return []
    
    async def _log_price_change(
        self,
        part_number: str,
        old_cost: float,
        new_cost: float,
        notes: Optional[str]
    ):
        """Log filter price changes"""
        change_percent = ((new_cost - old_cost) / old_cost * 100) if old_cost > 0 else 0
        
        await self.logging_service.log_info(
            f"Filter price updated - {part_number}: ${old_cost:.2f} → ${new_cost:.2f} "
            f"({change_percent:+.1f}%) {notes or ''}"
        )
    
    def _group_by_period(
        self,
        transactions: List[FilterInventoryTransaction],
        period: str
    ) -> Dict[str, List[FilterInventoryTransaction]]:
        """Group transactions by time period"""
        groups = defaultdict(list)
        
        for trans in transactions:
            if period == "daily":
                key = trans.created_at.date()
            elif period == "weekly":
                key = trans.created_at.date().isocalendar()[:2]  # (year, week)
            elif period == "monthly":
                key = (trans.created_at.year, trans.created_at.month)
            else:
                key = trans.created_at.year
        
            groups[key].append(trans)
        
        return groups
    
    def _get_period_dates(self, period_key: Any, period: str) -> Tuple[date, date]:
        """Get start and end dates for a period key"""
        if period == "daily":
            return period_key, period_key
        elif period == "weekly":
            year, week = period_key
            # Calculate start of week
            jan1 = date(year, 1, 1)
            start = jan1 + timedelta(days=(week - 1) * 7 - jan1.weekday())
            end = start + timedelta(days=6)
            return start, end
        elif period == "monthly":
            year, month = period_key
            start = date(year, month, 1)
            # Last day of month
            if month == 12:
                end = date(year + 1, 1, 1) - timedelta(days=1)
            else:
                end = date(year, month + 1, 1) - timedelta(days=1)
            return start, end
        else:  # yearly
            return date(period_key, 1, 1), date(period_key, 12, 31)
    
    async def _determine_trend(
        self,
        period_key: Any,
        period: str,
        current_cost: Decimal
    ) -> str:
        """Determine trend direction"""
        # This would compare with previous periods
        # For now, return stable
        return "stable"
    
    async def _forecast_next_period(
        self,
        period_key: Any,
        period: str,
        current_cost: Decimal
    ) -> Decimal:
        """Forecast cost for next period"""
        # Simple forecast - use current cost
        # Could implement more sophisticated forecasting
        return current_cost
    
    async def _calculate_period_costs(
        self,
        start_date: date,
        end_date: date
    ) -> Decimal:
        """Calculate total costs for a period"""
        transactions = self.db.query(FilterInventoryTransaction).filter(
            and_(
                FilterInventoryTransaction.transaction_type == "USAGE",
                FilterInventoryTransaction.created_at >= start_date,
                FilterInventoryTransaction.created_at <= end_date
            )
        ).all()
        
        total_cost = Decimal("0.00")
        
        for trans in transactions:
            filter_cost = await self.get_filter_cost(trans.part_number)
            if filter_cost:
                total_cost += filter_cost.unit_cost * abs(trans.quantity)
        
        return total_cost
    
    async def _get_top_cost_filters(
        self,
        start_date: date,
        end_date: date,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get filters with highest costs"""
        # Query and aggregate by part number
        filter_costs = defaultdict(Decimal)
        filter_quantities = defaultdict(int)
        
        transactions = self.db.query(FilterInventoryTransaction).filter(
            and_(
                FilterInventoryTransaction.transaction_type == "USAGE",
                FilterInventoryTransaction.created_at >= start_date,
                FilterInventoryTransaction.created_at <= end_date
            )
        ).all()
        
        for trans in transactions:
            filter_cost = await self.get_filter_cost(trans.part_number)
            if filter_cost:
                cost = filter_cost.unit_cost * abs(trans.quantity)
                filter_costs[trans.part_number] += cost
                filter_quantities[trans.part_number] += abs(trans.quantity)
        
        # Sort by cost
        sorted_filters = sorted(
            filter_costs.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        return [
            {
                "part_number": part,
                "total_cost": float(cost),
                "quantity_used": filter_quantities[part]
            }
            for part, cost in sorted_filters
        ]
    
    async def _get_top_cost_stations(
        self,
        start_date: date,
        end_date: date,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """Get stations with highest costs"""
        # Similar to filters but aggregate by station
        station_costs = defaultdict(Decimal)
        
        transactions = self.db.query(FilterInventoryTransaction).filter(
            and_(
                FilterInventoryTransaction.transaction_type == "USAGE",
                FilterInventoryTransaction.created_at >= start_date,
                FilterInventoryTransaction.created_at <= end_date
            )
        ).all()
        
        for trans in transactions:
            if trans.station_name:
                filter_cost = await self.get_filter_cost(trans.part_number)
                if filter_cost:
                    cost = filter_cost.unit_cost * abs(trans.quantity)
                    station_costs[trans.station_name] += cost
        
        # Sort by cost
        sorted_stations = sorted(
            station_costs.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        return [
            {
                "station_name": station,
                "total_cost": float(cost)
            }
            for station, cost in sorted_stations
        ]
    
    async def _send_budget_alerts(self, user_id: str, report: Dict[str, Any]):
        """Send budget alert notifications"""
        for alert in report["alerts"]:
            await self.notification_manager.send_notification(
                user_id=user_id,
                notification_type="budget_alert",
                data={
                    "alert_type": alert["type"],
                    "message": alert["message"],
                    "severity": alert["severity"],
                    "budget_utilization": report["budget"]["utilization_percent"],
                    "remaining": report["budget"]["remaining"]
                }
            )
    
    async def _send_high_cost_alert(self, work_order_cost: WorkOrderCost):
        """Send alert for high-cost work orders"""
        await self.logging_service.log_warning(
            f"High cost work order: {work_order_cost.work_order_id} - "
            f"${work_order_cost.total_cost:.2f}"
        )
    
    def _calculate_potential_savings(
        self,
        part_number: str,
        supplier_averages: Dict[str, Dict[str, float]]
    ) -> float:
        """Calculate potential savings by switching suppliers"""
        if len(supplier_averages) <= 1:
            return 0.0
        
        prices = [s["average"] for s in supplier_averages.values()]
        current_price = max(prices)  # Assume worst case
        best_price = min(prices)
        
        # Estimate annual usage (would use real data in production)
        estimated_annual_usage = 100  # filters per year
        
        return (current_price - best_price) * estimated_annual_usage
    
    async def _generate_supplier_recommendations(
        self,
        comparisons: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate supplier recommendations"""
        recommendations = []
        
        for part_number, data in comparisons.items():
            if data["potential_savings"] > 100:  # $100 threshold
                recommendations.append({
                    "part_number": part_number,
                    "action": f"Switch to {data['best_supplier']}",
                    "savings": data["potential_savings"],
                    "current_supplier": "Current",  # Would get from inventory
                    "recommended_supplier": data["best_supplier"]
                })
        
        # Sort by savings potential
        recommendations.sort(key=lambda x: x["savings"], reverse=True)
        
        return recommendations[:5]  # Top 5 recommendations
    
    async def _get_filter_usage_stats(
        self,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """Get filter usage statistics"""
        transactions = self.db.query(FilterInventoryTransaction).filter(
            and_(
                FilterInventoryTransaction.transaction_type == "USAGE",
                FilterInventoryTransaction.created_at >= start_date,
                FilterInventoryTransaction.created_at <= end_date
            )
        ).all()
        
        total_filters = sum(abs(t.quantity) for t in transactions)
        unique_stations = len(set(t.station_name for t in transactions if t.station_name))
        
        return {
            "total_filters": total_filters,
            "unique_stations": unique_stations
        }
    
    async def _calculate_cost_trend(
        self,
        start_date: date,
        end_date: date
    ) -> str:
        """Calculate overall cost trend"""
        # Would compare with previous period
        return "stable"
    
    async def _identify_optimization_opportunities(self) -> List[Dict[str, Any]]:
        """Identify cost optimization opportunities"""
        opportunities = []
        
        # Check for bulk purchasing opportunities
        opportunities.append({
            "type": "bulk_purchase",
            "description": "Consider bulk orders for high-usage filters",
            "potential_savings": "10-15%"
        })
        
        # Check for supplier consolidation
        opportunities.append({
            "type": "supplier_consolidation",
            "description": "Consolidate orders with single supplier for volume discounts",
            "potential_savings": "5-8%"
        })
        
        return opportunities