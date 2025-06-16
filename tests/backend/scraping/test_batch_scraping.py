#!/usr/bin/env python3
"""Test batch dispenser scraping"""

import sys
from pathlib import Path
# Add backend directory to path
backend_path = Path(__file__).parent.parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

import asyncio
from app.database import SessionLocal
from app.routes.work_orders import trigger_batch_dispenser_scraping

async def test():
    db = SessionLocal()
    try:
        # Trigger batch scraping for the first 5 work orders that don't have dispensers
        result = await trigger_batch_dispenser_scraping(
            db=db,
            user_id='7bea3bdb7e8e303eacaba442bd824004',
            limit=5
        )
        print(f'✅ Triggered batch scraping: {result}')
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test())