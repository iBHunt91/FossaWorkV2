#!/usr/bin/env python3
"""
Filter Inventory Models

Database models for tracking fuel filter inventory, usage history,
and reorder management.
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base


class FilterInventory(Base):
    """Current inventory levels for each filter part number"""
    __tablename__ = "filter_inventory"
    
    id = Column(String, primary_key=True)
    part_number = Column(String, nullable=False, unique=True, index=True)
    description = Column(String)
    filter_type = Column(String)  # GAS, DIESEL, DEF
    series = Column(String)  # 450, 400, 405, PREMIER
    
    # Current inventory
    quantity_on_hand = Column(Integer, default=0)
    quantity_allocated = Column(Integer, default=0)  # Reserved for upcoming jobs
    quantity_available = Column(Integer, default=0)  # on_hand - allocated
    
    # Reorder information
    reorder_point = Column(Integer, default=24)  # Minimum before reorder
    reorder_quantity = Column(Integer, default=48)  # Standard order size
    max_stock = Column(Integer, default=96)  # Maximum inventory level
    
    # Box information
    filters_per_box = Column(Integer, default=12)
    boxes_on_hand = Column(Float, default=0.0)  # Can have partial boxes
    
    # Costs
    cost_per_filter = Column(Float, default=0.0)
    cost_per_box = Column(Float, default=0.0)
    last_cost_update = Column(DateTime)
    
    # Tracking
    last_updated = Column(DateTime, default=datetime.utcnow)
    last_reorder_date = Column(DateTime)
    last_inventory_check = Column(DateTime)
    
    # Relationships
    transactions = relationship("FilterInventoryTransaction", back_populates="inventory_item")
    allocations = relationship("FilterAllocation", back_populates="inventory_item")


class FilterInventoryTransaction(Base):
    """Transaction history for filter inventory changes"""
    __tablename__ = "filter_inventory_transactions"
    
    id = Column(String, primary_key=True)
    part_number = Column(String, ForeignKey("filter_inventory.part_number"), nullable=False)
    transaction_type = Column(String, nullable=False)  # RECEIPT, USAGE, ADJUSTMENT, ALLOCATION, RETURN
    quantity = Column(Integer, nullable=False)  # Positive for additions, negative for removals
    
    # Transaction details
    reference_type = Column(String)  # WORK_ORDER, PURCHASE_ORDER, MANUAL, SYSTEM
    reference_id = Column(String)  # ID of related entity
    notes = Column(Text)
    
    # Before/After tracking
    quantity_before = Column(Integer)
    quantity_after = Column(Integer)
    
    # User and timestamp
    user_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Work order details (if applicable)
    work_order_id = Column(String)
    station_name = Column(String)
    visit_date = Column(DateTime)
    
    # Cost tracking
    unit_cost = Column(Float)
    total_cost = Column(Float)
    
    # Relationships
    inventory_item = relationship("FilterInventory", back_populates="transactions")
    user = relationship("User")


class FilterAllocation(Base):
    """Track filters allocated to upcoming work orders"""
    __tablename__ = "filter_allocations"
    
    id = Column(String, primary_key=True)
    part_number = Column(String, ForeignKey("filter_inventory.part_number"), nullable=False)
    work_order_id = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    
    # Allocation details
    allocation_date = Column(DateTime, default=datetime.utcnow)
    expected_use_date = Column(DateTime)
    status = Column(String, default="ALLOCATED")  # ALLOCATED, USED, CANCELLED, EXPIRED
    
    # Work order details
    station_name = Column(String)
    fuel_grade = Column(String)
    
    # User tracking
    allocated_by = Column(String, ForeignKey("users.id"))
    used_by = Column(String, ForeignKey("users.id"))
    cancelled_by = Column(String, ForeignKey("users.id"))
    
    # Timestamps
    used_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    expires_at = Column(DateTime)  # Auto-release if not used
    
    # Relationships
    inventory_item = relationship("FilterInventory", back_populates="allocations")


class FilterReorderHistory(Base):
    """Track filter reorder history and supplier information"""
    __tablename__ = "filter_reorder_history"
    
    id = Column(String, primary_key=True)
    order_number = Column(String, unique=True)
    supplier_name = Column(String)
    order_date = Column(DateTime, default=datetime.utcnow)
    expected_delivery = Column(DateTime)
    actual_delivery = Column(DateTime)
    
    # Order details
    status = Column(String, default="PENDING")  # PENDING, SHIPPED, DELIVERED, CANCELLED
    items = Column(JSON)  # List of {part_number, quantity, unit_cost}
    
    # Costs
    subtotal = Column(Float, default=0.0)
    tax = Column(Float, default=0.0)
    shipping = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)
    
    # Tracking
    tracking_number = Column(String)
    notes = Column(Text)
    
    # User tracking
    ordered_by = Column(String, ForeignKey("users.id"))
    received_by = Column(String, ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FilterUsagePattern(Base):
    """Analyze filter usage patterns for forecasting"""
    __tablename__ = "filter_usage_patterns"
    
    id = Column(String, primary_key=True)
    part_number = Column(String, nullable=False, index=True)
    period_type = Column(String, nullable=False)  # DAILY, WEEKLY, MONTHLY
    period_date = Column(DateTime, nullable=False)
    
    # Usage statistics
    quantity_used = Column(Integer, default=0)
    work_orders_count = Column(Integer, default=0)
    unique_stations = Column(Integer, default=0)
    
    # Aggregated data
    station_breakdown = Column(JSON)  # {station_type: count}
    daily_breakdown = Column(JSON)  # {day_of_week: count} for weekly
    
    # Forecasting helpers
    average_daily_usage = Column(Float, default=0.0)
    usage_trend = Column(String)  # INCREASING, STABLE, DECREASING
    seasonality_factor = Column(Float, default=1.0)
    
    # Calculated metrics
    days_of_supply = Column(Float)  # Current inventory / average daily usage
    suggested_reorder_date = Column(DateTime)
    
    # Timestamps
    calculated_at = Column(DateTime, default=datetime.utcnow)


class FilterInventoryAlert(Base):
    """Alerts for inventory issues and reorder needs"""
    __tablename__ = "filter_inventory_alerts"
    
    id = Column(String, primary_key=True)
    alert_type = Column(String, nullable=False)  # LOW_STOCK, REORDER_NEEDED, OVERSTOCK, EXPIRED_ALLOCATION
    severity = Column(Integer, default=5)  # 1-10 scale
    part_number = Column(String, index=True)
    
    # Alert details
    message = Column(Text, nullable=False)
    details = Column(JSON)
    
    # Status
    status = Column(String, default="ACTIVE")  # ACTIVE, ACKNOWLEDGED, RESOLVED
    acknowledged_by = Column(String, ForeignKey("users.id"))
    resolved_by = Column(String, ForeignKey("users.id"))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    acknowledged_at = Column(DateTime)
    resolved_at = Column(DateTime)
    expires_at = Column(DateTime)  # Auto-resolve old alerts
    
    # Actions taken
    action_taken = Column(Text)
    related_order_id = Column(String)  # If reorder was placed