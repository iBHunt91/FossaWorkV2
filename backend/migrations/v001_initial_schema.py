"""
Migration v001: Initial Schema

Creates the foundational database schema for FossaWork V2.
This includes all core tables from the existing models.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.engine import Engine
import logging

logger = logging.getLogger(__name__)

# Migration metadata
description = "Create initial database schema with core tables"
dependencies = []  # No dependencies for initial migration


def upgrade(session: Session, engine: Engine):
    """Create initial database schema"""
    logger.info("Creating initial database schema...")
    
    # Import models to ensure they're registered
    from app.database import Base
    from app.models import user_models, filter_inventory_models, scraping_models
    from app import core_models
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    logger.info("Initial schema created successfully")


def downgrade(session: Session, engine: Engine):
    """Drop all tables (CAUTION: This will delete all data)"""
    logger.warning("Dropping all tables - this will delete all data!")
    
    # Import models to ensure they're registered
    from app.database import Base
    from app.models import user_models, filter_inventory_models, scraping_models
    from app import core_models
    
    # Drop all tables in reverse order to handle foreign keys
    Base.metadata.drop_all(bind=engine)
    
    logger.info("All tables dropped")