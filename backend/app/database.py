from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
import os

# Create Base class for models
Base = declarative_base()

# For development, we'll use SQLite instead of PostgreSQL due to Docker limitations
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fossawork_v2.db")

# For PostgreSQL when Docker is available:
# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://fossawork:dev_password_123@localhost:5432/fossawork_dev")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Create all database tables"""
    # Import models to register them with Base
    from . import core_models
    from .models import user_models, filter_inventory_models
    # Create all tables
    Base.metadata.create_all(bind=engine)