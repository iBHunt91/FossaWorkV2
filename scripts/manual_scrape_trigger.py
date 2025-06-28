#!/usr/bin/env python3
"""
Manual trigger for work order scraping - useful for testing when scheduler isn't running
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.services.workfossa_scraper import WorkFossaScraper
from app.services.logging_service import get_logger

logger = get_logger("manual_scrape")

async def manual_scrape_work_orders(user_id: str):
    """Manually trigger work order scraping for a user"""
    
    print(f"\n{'='*60}")
    print(f"MANUAL WORK ORDER SCRAPING")
    print(f"User ID: {user_id}")
    print(f"{'='*60}\n")
    
    db = SessionLocal()
    try:
        # Initialize scraper
        logger.info(f"Initializing scraper for user {user_id}")
        scraper = WorkFossaScraper(db, user_id)
        
        # Perform scraping
        logger.info("Starting work order scraping...")
        result = await scraper.scrape_work_orders()
        
        if result.get("success"):
            work_orders = result.get("work_orders", [])
            new_orders = result.get("new_work_orders", [])
            
            print(f"\n✓ Scraping successful!")
            print(f"  - Total work orders found: {len(work_orders)}")
            print(f"  - New work orders: {len(new_orders)}")
            
            if new_orders:
                print("\nNew Work Orders:")
                for order in new_orders[:5]:  # Show first 5
                    print(f"  - {order.get('work_order_id')} | {order.get('customer_name')} | {order.get('scheduled_date')}")
                if len(new_orders) > 5:
                    print(f"  ... and {len(new_orders) - 5} more")
            
            # Show summary of all work orders
            if work_orders:
                print("\nWork Orders Summary:")
                service_counts = {}
                for order in work_orders:
                    service = order.get('service_name', 'Unknown')
                    service_counts[service] = service_counts.get(service, 0) + 1
                
                for service, count in service_counts.items():
                    print(f"  - {service}: {count} orders")
        else:
            error = result.get("error", "Unknown error")
            print(f"\n✗ Scraping failed: {error}")
            logger.error(f"Scraping failed: {error}")
            
    except Exception as e:
        print(f"\n✗ Error during scraping: {e}")
        logger.exception("Error during manual scraping")
    finally:
        db.close()
    
    print(f"\n{'='*60}\n")

def main():
    """Main function to handle command line arguments"""
    if len(sys.argv) < 2:
        print("Usage: python manual_scrape_trigger.py <user_id>")
        print("Example: python manual_scrape_trigger.py 123")
        sys.exit(1)
    
    user_id = sys.argv[1]
    
    # Run the scraping
    asyncio.run(manual_scrape_work_orders(user_id))

if __name__ == "__main__":
    main()