from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from passlib.context import CryptContext
import uuid
from datetime import datetime
from .database import Base

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# User-related models (User, UserPreference, UserCredential) are defined in models/user_models.py

class WorkOrder(Base):
    __tablename__ = "work_orders"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    external_id = Column(String(100), nullable=True)  # Original WorkFossa ID
    site_name = Column(String(200), nullable=False)
    address = Column(Text, nullable=True)
    scheduled_date = Column(DateTime, nullable=True)
    status = Column(String(50), default="pending")  # pending, in_progress, completed, cancelled
    work_type = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    scraped_data = Column(JSON, nullable=True)  # Original scraped data for reference
    
    # Additional fields to match V1
    store_number = Column(String(50), nullable=True)
    service_code = Column(String(20), nullable=True)
    service_description = Column(Text, nullable=True)
    visit_id = Column(String(100), nullable=True)
    visit_url = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    
    # New fields from updated extraction
    service_name = Column(String(200), nullable=True)  # Service description (e.g., "AccuMeasure")
    service_items = Column(JSON, nullable=True)  # List of services (e.g., ["6 x All Dispensers"])
    street = Column(String(500), nullable=True)  # Street address component
    city_state = Column(String(200), nullable=True)  # City, State ZIP component
    county = Column(String(100), nullable=True)  # County component
    created_date = Column(DateTime, nullable=True)  # When work order was created
    created_by = Column(String(200), nullable=True)  # User who created the work order
    customer_url = Column(Text, nullable=True)  # URL to customer location page
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="work_orders")
    dispensers = relationship("Dispenser", back_populates="work_order")

class Dispenser(Base):
    __tablename__ = "dispensers"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    work_order_id = Column(String, ForeignKey("work_orders.id"), nullable=False)
    dispenser_number = Column(String(20), nullable=False)
    dispenser_type = Column(String(100), nullable=True)  # Wayne 300, Wayne 700, etc.
    fuel_grades = Column(JSON, nullable=True)  # Store fuel configuration
    status = Column(String(50), default="pending")
    progress_percentage = Column(Float, default=0.0)
    form_data = Column(JSON, nullable=True)  # Store form field values
    automation_completed = Column(Boolean, default=False)
    testing_requirements = Column(JSON, nullable=True)  # Filter and testing requirements
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    work_order = relationship("WorkOrder", back_populates="dispensers")

class AutomationJob(Base):
    __tablename__ = "automation_jobs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    work_order_id = Column(String, ForeignKey("work_orders.id"), nullable=True)
    job_type = Column(String(50), nullable=False)  # single_visit, batch_visit
    status = Column(String(20), default="pending")  # pending, running, paused, completed, failed
    progress = Column(Integer, default=0)
    total_items = Column(Integer, default=0)
    current_item = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    job_config = Column(JSON, nullable=True)  # Store job-specific configuration
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="automation_jobs")