#!/usr/bin/env python3
"""
Filter Inventory Service

Manages fuel filter inventory tracking, usage recording, allocation management,
and reorder alerts. Integrates with filter calculation service to automatically
track usage based on completed work orders.
"""

import uuid
from datetime import datetime, timedelta, date
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from ..models.filter_inventory_models import (
    FilterInventory,
    FilterInventoryTransaction,
    FilterAllocation,
    FilterReorderHistory,
    FilterUsagePattern,
    FilterInventoryAlert
)
from ..services.filter_calculation import FilterCalculationService, FilterPartNumber
from ..services.logging_service import LoggingService
from ..services.notification_manager import NotificationManager, NotificationTrigger


class FilterInventoryService:
    """Service for managing filter inventory"""
    
    def __init__(self, db: Session):
        self.db = db
        self.logging_service = LoggingService(db)
        self.filter_calc_service = FilterCalculationService(db)
        self.notification_manager = NotificationManager(db)
    
    async def initialize_inventory(self, user_id: str) -> Dict[str, Any]:
        """
        Initialize inventory for all known filter part numbers
        
        Creates inventory records with default reorder points based on
        filter series and typical usage patterns.
        """
        try:
            initialized = []
            
            # Get all part numbers from filter calculation service
            for part_num, part_info in self.filter_calc_service.PART_NUMBER_INFO.items():
                # Check if already exists
                existing = self.db.query(FilterInventory).filter_by(
                    part_number=part_num
                ).first()
                
                if not existing:
                    # Calculate default reorder points based on series
                    if part_info.series.value == "800":  # High flow / DEF
                        reorder_point = 12  # 2 boxes
                        reorder_quantity = 24  # 4 boxes
                        max_stock = 48  # 8 boxes
                    elif part_info.series.value in ["450", "400", "405"]:
                        reorder_point = 24  # 2 boxes
                        reorder_quantity = 48  # 4 boxes
                        max_stock = 96  # 8 boxes
                    else:  # Premier series
                        reorder_point = 12  # 1 box
                        reorder_quantity = 24  # 2 boxes
                        max_stock = 48  # 4 boxes
                    
                    inventory = FilterInventory(
                        id=str(uuid.uuid4()),
                        part_number=part_num,
                        description=part_info.description,
                        filter_type=part_info.filter_type.value,
                        series=part_info.series.value,
                        filters_per_box=part_info.filters_per_box,
                        reorder_point=reorder_point,
                        reorder_quantity=reorder_quantity,
                        max_stock=max_stock,
                        quantity_on_hand=0,
                        quantity_allocated=0,
                        quantity_available=0,
                        boxes_on_hand=0.0
                    )
                    
                    self.db.add(inventory)
                    initialized.append(part_num)
            
            self.db.commit()
            
            await self.logging_service.log_info(
                f"Initialized inventory for {len(initialized)} filter part numbers"
            )
            
            return {
                "initialized": len(initialized),
                "part_numbers": initialized
            }
            
        except Exception as e:
            self.db.rollback()
            await self.logging_service.log_error(
                f"Failed to initialize inventory: {str(e)}"
            )
            raise
    
    async def record_filter_usage(
        self,
        work_order_id: str,
        filter_calculation_result: Dict[str, Any],
        user_id: str
    ) -> List[FilterInventoryTransaction]:
        """
        Record filter usage from a completed work order
        
        Automatically deducts filters from inventory based on the
        filter calculation result.
        """
        try:
            transactions = []
            
            # Skip if multi-day continuation (filters already deducted)
            if filter_calculation_result.get("is_multi_day_continuation"):
                await self.logging_service.log_info(
                    f"Skipping filter usage for multi-day continuation: {work_order_id}"
                )
                return []
            
            # Process each filter type used
            for part_number, quantity in filter_calculation_result.get("total_quantities", {}).items():
                if quantity <= 0:
                    continue
                
                # Get current inventory
                inventory = self.db.query(FilterInventory).filter_by(
                    part_number=part_number
                ).first()
                
                if not inventory:
                    # Create inventory record if missing
                    await self.initialize_inventory(user_id)
                    inventory = self.db.query(FilterInventory).filter_by(
                        part_number=part_number
                    ).first()
                
                # Record the usage transaction
                transaction = FilterInventoryTransaction(
                    id=str(uuid.uuid4()),
                    part_number=part_number,
                    transaction_type="USAGE",
                    quantity=-quantity,  # Negative for removal
                    reference_type="WORK_ORDER",
                    reference_id=work_order_id,
                    quantity_before=inventory.quantity_on_hand,
                    quantity_after=inventory.quantity_on_hand - quantity,
                    user_id=user_id,
                    work_order_id=work_order_id,
                    station_name=filter_calculation_result.get("station_name"),
                    visit_date=filter_calculation_result.get("visit_date")
                )
                
                # Update inventory levels
                inventory.quantity_on_hand -= quantity
                inventory.quantity_available = inventory.quantity_on_hand - inventory.quantity_allocated
                inventory.boxes_on_hand = inventory.quantity_on_hand / inventory.filters_per_box
                inventory.last_updated = datetime.utcnow()
                
                self.db.add(transaction)
                transactions.append(transaction)
                
                # Check if reorder needed
                if inventory.quantity_available <= inventory.reorder_point:
                    await self._create_reorder_alert(inventory, user_id)
            
            # Check and release any allocations for this work order
            await self._use_allocations(work_order_id, user_id)
            
            self.db.commit()
            
            await self.logging_service.log_info(
                f"Recorded filter usage for work order {work_order_id}: "
                f"{len(transactions)} transactions"
            )
            
            return transactions
            
        except Exception as e:
            self.db.rollback()
            await self.logging_service.log_error(
                f"Failed to record filter usage: {str(e)}"
            )
            raise
    
    async def allocate_filters(
        self,
        work_order_id: str,
        filter_requirements: Dict[str, int],
        expected_use_date: datetime,
        user_id: str
    ) -> List[FilterAllocation]:
        """
        Allocate filters for an upcoming work order
        
        Reserves filters to ensure availability when the work is performed.
        """
        try:
            allocations = []
            insufficient_stock = []
            
            for part_number, quantity in filter_requirements.items():
                if quantity <= 0:
                    continue
                
                # Get current inventory
                inventory = self.db.query(FilterInventory).filter_by(
                    part_number=part_number
                ).first()
                
                if not inventory:
                    insufficient_stock.append({
                        "part_number": part_number,
                        "requested": quantity,
                        "available": 0
                    })
                    continue
                
                # Check availability
                if inventory.quantity_available < quantity:
                    insufficient_stock.append({
                        "part_number": part_number,
                        "requested": quantity,
                        "available": inventory.quantity_available
                    })
                    continue
                
                # Create allocation
                allocation = FilterAllocation(
                    id=str(uuid.uuid4()),
                    part_number=part_number,
                    work_order_id=work_order_id,
                    quantity=quantity,
                    expected_use_date=expected_use_date,
                    allocated_by=user_id,
                    expires_at=expected_use_date + timedelta(days=7)  # Auto-expire after a week
                )
                
                # Update inventory
                inventory.quantity_allocated += quantity
                inventory.quantity_available = inventory.quantity_on_hand - inventory.quantity_allocated
                inventory.last_updated = datetime.utcnow()
                
                self.db.add(allocation)
                allocations.append(allocation)
                
                # Create allocation transaction
                transaction = FilterInventoryTransaction(
                    id=str(uuid.uuid4()),
                    part_number=part_number,
                    transaction_type="ALLOCATION",
                    quantity=0,  # No physical change yet
                    reference_type="WORK_ORDER",
                    reference_id=work_order_id,
                    notes=f"Allocated {quantity} filters for future use",
                    user_id=user_id,
                    work_order_id=work_order_id
                )
                self.db.add(transaction)
            
            if insufficient_stock:
                # Send alert about insufficient stock
                await self._create_insufficient_stock_alert(
                    insufficient_stock, work_order_id, user_id
                )
            
            self.db.commit()
            
            await self.logging_service.log_info(
                f"Allocated filters for work order {work_order_id}: "
                f"{len(allocations)} successful, {len(insufficient_stock)} insufficient"
            )
            
            return allocations
            
        except Exception as e:
            self.db.rollback()
            await self.logging_service.log_error(
                f"Failed to allocate filters: {str(e)}"
            )
            raise
    
    async def add_stock(
        self,
        part_number: str,
        quantity: int,
        reference_type: str,
        reference_id: str,
        unit_cost: Optional[float],
        user_id: str,
        notes: Optional[str] = None
    ) -> FilterInventoryTransaction:
        """Add stock to inventory (receive filters)"""
        try:
            # Get inventory record
            inventory = self.db.query(FilterInventory).filter_by(
                part_number=part_number
            ).first()
            
            if not inventory:
                raise ValueError(f"Part number {part_number} not found in inventory")
            
            # Create receipt transaction
            transaction = FilterInventoryTransaction(
                id=str(uuid.uuid4()),
                part_number=part_number,
                transaction_type="RECEIPT",
                quantity=quantity,  # Positive for addition
                reference_type=reference_type,
                reference_id=reference_id,
                notes=notes,
                quantity_before=inventory.quantity_on_hand,
                quantity_after=inventory.quantity_on_hand + quantity,
                user_id=user_id,
                unit_cost=unit_cost,
                total_cost=unit_cost * quantity if unit_cost else None
            )
            
            # Update inventory
            inventory.quantity_on_hand += quantity
            inventory.quantity_available = inventory.quantity_on_hand - inventory.quantity_allocated
            inventory.boxes_on_hand = inventory.quantity_on_hand / inventory.filters_per_box
            inventory.last_updated = datetime.utcnow()
            
            # Update cost if provided
            if unit_cost:
                inventory.cost_per_filter = unit_cost
                inventory.cost_per_box = unit_cost * inventory.filters_per_box
                inventory.last_cost_update = datetime.utcnow()
            
            self.db.add(transaction)
            self.db.commit()
            
            await self.logging_service.log_info(
                f"Added {quantity} filters of {part_number} to inventory"
            )
            
            # Clear any low stock alerts
            await self._resolve_stock_alerts(part_number)
            
            return transaction
            
        except Exception as e:
            self.db.rollback()
            await self.logging_service.log_error(
                f"Failed to add stock: {str(e)}"
            )
            raise
    
    async def get_inventory_status(
        self,
        part_number: Optional[str] = None,
        filter_type: Optional[str] = None,
        include_allocations: bool = True
    ) -> List[Dict[str, Any]]:
        """Get current inventory status"""
        try:
            query = self.db.query(FilterInventory)
            
            if part_number:
                query = query.filter_by(part_number=part_number)
            if filter_type:
                query = query.filter_by(filter_type=filter_type)
            
            inventory_items = query.all()
            
            results = []
            for item in inventory_items:
                result = {
                    "part_number": item.part_number,
                    "description": item.description,
                    "filter_type": item.filter_type,
                    "series": item.series,
                    "quantity_on_hand": item.quantity_on_hand,
                    "quantity_allocated": item.quantity_allocated,
                    "quantity_available": item.quantity_available,
                    "boxes_on_hand": round(item.boxes_on_hand, 2),
                    "filters_per_box": item.filters_per_box,
                    "reorder_point": item.reorder_point,
                    "reorder_quantity": item.reorder_quantity,
                    "needs_reorder": item.quantity_available <= item.reorder_point,
                    "stock_level": self._calculate_stock_level(item),
                    "last_updated": item.last_updated.isoformat() if item.last_updated else None
                }
                
                # Include active allocations if requested
                if include_allocations:
                    active_allocations = self.db.query(FilterAllocation).filter(
                        and_(
                            FilterAllocation.part_number == item.part_number,
                            FilterAllocation.status == "ALLOCATED"
                        )
                    ).all()
                    
                    result["allocations"] = [
                        {
                            "work_order_id": alloc.work_order_id,
                            "quantity": alloc.quantity,
                            "expected_use_date": alloc.expected_use_date.isoformat()
                        }
                        for alloc in active_allocations
                    ]
                
                results.append(result)
            
            return results
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to get inventory status: {str(e)}"
            )
            raise
    
    async def get_usage_analytics(
        self,
        start_date: date,
        end_date: date,
        part_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get filter usage analytics for the specified period"""
        try:
            # Get usage transactions
            query = self.db.query(FilterInventoryTransaction).filter(
                and_(
                    FilterInventoryTransaction.transaction_type == "USAGE",
                    FilterInventoryTransaction.created_at >= start_date,
                    FilterInventoryTransaction.created_at <= end_date
                )
            )
            
            if part_number:
                query = query.filter_by(part_number=part_number)
            
            transactions = query.all()
            
            # Aggregate by part number
            usage_by_part = {}
            for trans in transactions:
                if trans.part_number not in usage_by_part:
                    usage_by_part[trans.part_number] = {
                        "quantity": 0,
                        "work_orders": set(),
                        "stations": set()
                    }
                
                usage_by_part[trans.part_number]["quantity"] += abs(trans.quantity)
                usage_by_part[trans.part_number]["work_orders"].add(trans.work_order_id)
                if trans.station_name:
                    usage_by_part[trans.part_number]["stations"].add(trans.station_name)
            
            # Calculate analytics
            total_filters_used = sum(data["quantity"] for data in usage_by_part.values())
            total_work_orders = len(set(
                trans.work_order_id for trans in transactions if trans.work_order_id
            ))
            
            # Format results
            analytics = {
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "days": (end_date - start_date).days + 1
                },
                "summary": {
                    "total_filters_used": total_filters_used,
                    "total_work_orders": total_work_orders,
                    "unique_part_numbers": len(usage_by_part),
                    "average_daily_usage": round(total_filters_used / ((end_date - start_date).days + 1), 2)
                },
                "by_part_number": {
                    part: {
                        "quantity_used": data["quantity"],
                        "work_orders": len(data["work_orders"]),
                        "unique_stations": len(data["stations"]),
                        "average_per_order": round(data["quantity"] / len(data["work_orders"]), 2)
                    }
                    for part, data in usage_by_part.items()
                }
            }
            
            # Add inventory levels
            for part in usage_by_part:
                inventory = self.db.query(FilterInventory).filter_by(
                    part_number=part
                ).first()
                
                if inventory:
                    analytics["by_part_number"][part]["current_stock"] = inventory.quantity_on_hand
                    analytics["by_part_number"][part]["days_of_supply"] = round(
                        inventory.quantity_on_hand / analytics["by_part_number"][part]["average_per_order"]
                    ) if analytics["by_part_number"][part]["average_per_order"] > 0 else 999
            
            return analytics
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to get usage analytics: {str(e)}"
            )
            raise
    
    def _calculate_stock_level(self, inventory: FilterInventory) -> str:
        """Calculate stock level status"""
        if inventory.quantity_on_hand == 0:
            return "OUT_OF_STOCK"
        elif inventory.quantity_available <= 0:
            return "FULLY_ALLOCATED"
        elif inventory.quantity_available <= inventory.reorder_point:
            return "LOW_STOCK"
        elif inventory.quantity_on_hand >= inventory.max_stock:
            return "OVERSTOCK"
        else:
            return "NORMAL"
    
    async def _use_allocations(self, work_order_id: str, user_id: str):
        """Mark allocations as used when work order is completed"""
        allocations = self.db.query(FilterAllocation).filter(
            and_(
                FilterAllocation.work_order_id == work_order_id,
                FilterAllocation.status == "ALLOCATED"
            )
        ).all()
        
        for allocation in allocations:
            allocation.status = "USED"
            allocation.used_by = user_id
            allocation.used_at = datetime.utcnow()
            
            # Update allocated quantity
            inventory = self.db.query(FilterInventory).filter_by(
                part_number=allocation.part_number
            ).first()
            
            if inventory:
                inventory.quantity_allocated -= allocation.quantity
                inventory.quantity_available = inventory.quantity_on_hand - inventory.quantity_allocated
    
    async def _create_reorder_alert(self, inventory: FilterInventory, user_id: str):
        """Create alert when inventory reaches reorder point"""
        # Check if alert already exists
        existing = self.db.query(FilterInventoryAlert).filter(
            and_(
                FilterInventoryAlert.part_number == inventory.part_number,
                FilterInventoryAlert.alert_type == "REORDER_NEEDED",
                FilterInventoryAlert.status == "ACTIVE"
            )
        ).first()
        
        if not existing:
            alert = FilterInventoryAlert(
                id=str(uuid.uuid4()),
                alert_type="REORDER_NEEDED",
                severity=8,
                part_number=inventory.part_number,
                message=f"Filter {inventory.part_number} needs reorder. Current: {inventory.quantity_available}, Reorder point: {inventory.reorder_point}",
                details={
                    "current_stock": inventory.quantity_on_hand,
                    "allocated": inventory.quantity_allocated,
                    "available": inventory.quantity_available,
                    "reorder_point": inventory.reorder_point,
                    "suggested_order": inventory.reorder_quantity
                }
            )
            self.db.add(alert)
            
            # Send notification
            await self.notification_manager.send_notification(
                user_id,
                NotificationTrigger.INVENTORY_LOW,
                {
                    "part_number": inventory.part_number,
                    "description": inventory.description,
                    "current_stock": inventory.quantity_available,
                    "reorder_point": inventory.reorder_point,
                    "suggested_order": inventory.reorder_quantity
                }
            )
    
    async def _create_insufficient_stock_alert(
        self,
        insufficient_items: List[Dict[str, Any]],
        work_order_id: str,
        user_id: str
    ):
        """Create alert for insufficient stock during allocation"""
        details = {
            "work_order_id": work_order_id,
            "insufficient_items": insufficient_items,
            "total_shortage": sum(
                item["requested"] - item["available"]
                for item in insufficient_items
            )
        }
        
        alert = FilterInventoryAlert(
            id=str(uuid.uuid4()),
            alert_type="LOW_STOCK",
            severity=9,
            message=f"Insufficient stock to allocate filters for work order {work_order_id}",
            details=details
        )
        self.db.add(alert)
    
    async def _resolve_stock_alerts(self, part_number: str):
        """Resolve stock alerts when inventory is replenished"""
        alerts = self.db.query(FilterInventoryAlert).filter(
            and_(
                FilterInventoryAlert.part_number == part_number,
                FilterInventoryAlert.alert_type.in_(["LOW_STOCK", "REORDER_NEEDED"]),
                FilterInventoryAlert.status == "ACTIVE"
            )
        ).all()
        
        for alert in alerts:
            alert.status = "RESOLVED"
            alert.resolved_at = datetime.utcnow()
            alert.action_taken = "Stock replenished"