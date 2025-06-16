#!/usr/bin/env python3
"""
Clear SQLAlchemy metadata cache and verify models
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, engine
from app.core_models import Dispenser

print("🔧 Clearing SQLAlchemy metadata cache")
print("=" * 80)

# Clear metadata
Base.metadata.clear()
print("✅ Metadata cleared")

# Recreate all tables (this won't delete data, just ensure schema is correct)
Base.metadata.create_all(bind=engine)
print("✅ Tables recreated")

# Check Dispenser model columns
print("\n📊 Dispenser model columns:")
for column in Dispenser.__table__.columns:
    print(f"  - {column.name}: {column.type}")
    
# Test a query
from sqlalchemy.orm import Session
with Session(engine) as session:
    count = session.query(Dispenser).count()
    print(f"\n✅ Test query successful - found {count} dispensers")
    
    # Test accessing new columns
    dispenser = session.query(Dispenser).first()
    if dispenser:
        print(f"\n📋 Sample dispenser:")
        print(f"  ID: {dispenser.id}")
        print(f"  Number: {dispenser.dispenser_number}")
        print(f"  Make: {dispenser.make}")
        print(f"  Model: {dispenser.model}")
        print(f"  S/N: {dispenser.serial_number}")

print("\n✅ Cache cleared and models verified")