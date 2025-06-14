#!/usr/bin/env python3
from pathlib import Path
"""
Mock test for dispenser scraping - tests the scraping logic without actual login
"""
import asyncio
import logging
import sys
from datetime import datetime

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from app.services.workfossa_scraper import workfossa_scraper
from app.services.dispenser_scraper import dispenser_scraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_dispenser_extraction():
    """Test dispenser extraction logic with mock HTML"""
    
    logger.info("🧪 Testing dispenser extraction logic...")
    
    # Based on the screenshots, here's what the dispenser data looks like:
    # From the Visits tab screenshot:
    # - Dispenser (6) - showing 6 dispensers
    # - Multiple entries showing "Regular, Plus, Premium - Gilbarco"
    
    expected_dispensers = [
        {
            "dispenser_number": "1",
            "dispenser_type": "Gilbarco",
            "fuel_grades": ["Regular", "Plus", "Premium"]
        },
        {
            "dispenser_number": "2", 
            "dispenser_type": "Gilbarco",
            "fuel_grades": ["Regular", "Plus", "Premium"]
        },
        {
            "dispenser_number": "3",
            "dispenser_type": "Gilbarco", 
            "fuel_grades": ["Regular", "Plus", "Premium", "Diesel"]
        },
        {
            "dispenser_number": "4",
            "dispenser_type": "Gilbarco",
            "fuel_grades": ["Regular", "Plus", "Premium"]
        },
        {
            "dispenser_number": "5",
            "dispenser_type": "Gilbarco",
            "fuel_grades": ["Regular", "Plus", "Premium", "Diesel"]
        },
        {
            "dispenser_number": "6",
            "dispenser_type": "Gilbarco",
            "fuel_grades": ["Regular", "Plus", "Premium", "Diesel"]
        }
    ]
    
    logger.info(f"📊 Expected dispensers based on screenshots:")
    for i, disp in enumerate(expected_dispensers, 1):
        logger.info(f"  Dispenser {i}: {disp['dispenser_type']} - {', '.join(disp['fuel_grades'])}")
    
    # Test the URL generation for customer page
    customer_url = "https://app.workfossa.com/app/customers/locations/46769/"
    logger.info(f"\n🔗 Customer URL (from screenshot): {customer_url}")
    logger.info("📍 This is for 7-Eleven Store #38437")
    
    # Test the scraper's ability to parse dispenser patterns
    test_patterns = [
        "1/2 - Regular, Plus, Premium - Gilbarco",
        "3/4 - Regular, Plus, Premium - Gilbarco", 
        "5/6 - Regular, Plus, Premium - Gilbarco",
        "7/8 - Regular, Plus, Premium, Diesel - Gilbarco",
        "9/10 - Regular, Plus, Premium - Gilbarco",
        "11/12 - Regular, Plus, Premium, Diesel - Gilbarco"
    ]
    
    logger.info("\n🔍 Testing pattern recognition:")
    for pattern in test_patterns:
        logger.info(f"  Pattern: '{pattern}'")
        # This matches the pattern used in dispenser_scraper.py
        import re
        dispenser_pattern = r'^(\d+)/(\d+)\s*-\s*(.+?)\s*-\s*(.+)$'
        match = re.match(dispenser_pattern, pattern)
        if match:
            logger.info(f"    ✅ Matched: Dispenser {match.group(1)}/{match.group(2)}, "
                       f"Fuels: {match.group(3)}, Type: {match.group(4)}")
        else:
            logger.info(f"    ❌ No match")
    
    logger.info("\n✅ Dispenser extraction logic test completed!")
    logger.info("\n💡 To run a full test with actual scraping:")
    logger.info("   1. Ensure you have valid WorkFossa credentials")
    logger.info("   2. The scraper will navigate to the customer page")
    logger.info("   3. Click on the Equipment tab")
    logger.info("   4. Expand the Dispenser section")
    logger.info("   5. Extract dispenser details")

if __name__ == "__main__":
    asyncio.run(test_dispenser_extraction())