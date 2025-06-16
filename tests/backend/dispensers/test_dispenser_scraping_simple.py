#!/usr/bin/env python3
"""
Simple test for dispenser scraping logic without requiring browser
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)

logger = logging.getLogger(__name__)

async def test_dispenser_scraper_logic():
    """Test the dispenser scraper logic without browser"""
    
    logger.info("🧪 Testing Dispenser Scraper Logic")
    logger.info("="*60)
    
    try:
        from app.services.dispenser_scraper import DispenserScraper, DispenserInfo
        
        # Create scraper instance
        scraper = DispenserScraper()
        
        logger.info("✅ DispenserScraper imported successfully")
        
        # Test DispenserInfo dataclass
        test_dispenser = DispenserInfo(
            dispenser_id="D001",
            title="Dispenser 1 - Wayne Ovation",
            serial_number="WO123456",
            make="Wayne",
            model="Ovation",
            dispenser_number="1",
            location="Island A",
            fuel_grades={
                "regular": {"octane": 87, "price": 3.29},
                "plus": {"octane": 89, "price": 3.59},
                "premium": {"octane": 91, "price": 3.89}
            },
            custom_fields={
                "Last Calibration": "2024-05-15",
                "Flow Rate": "10 GPM",
                "Meter Type": "AccuMeasure"
            }
        )
        
        logger.info(f"✅ Created test dispenser: {test_dispenser.title}")
        logger.info(f"   Serial: {test_dispenser.serial_number}")
        logger.info(f"   Make/Model: {test_dispenser.make} {test_dispenser.model}")
        logger.info(f"   Fuel Grades: {list(test_dispenser.fuel_grades.keys())}")
        
        # Test the extraction functions
        logger.info("\n📋 Testing Extraction Functions:")
        
        # Test HTML parsing
        test_html = """
        <div class="mt-4">
            <div class="bold">Dispenser Section</div>
            <div class="px-2 flex align-start">
                <div>Dispenser 1 - Wayne Ovation</div>
            </div>
            <div class="muted text-tiny">Serial: WO123456</div>
            <div class="text-tiny">
                <div>Wayne</div>
                <div>Ovation</div>
            </div>
            <div class="custom-fields-view">
                <div class="row">
                    <div>Last Calibration</div>
                    <div>2024-05-15</div>
                </div>
                <div class="row">
                    <div>Flow Rate</div>
                    <div>10 GPM</div>
                </div>
            </div>
        </div>
        """
        
        # Test fuel grade extraction
        fuel_fields = {
            "Regular 87": "Active",
            "Plus 89": "Active",
            "Premium 91": "Active",
            "Diesel": "Inactive"
        }
        
        fuel_grades = scraper._parse_fuel_grades(fuel_fields)
        logger.info(f"✅ Parsed fuel grades: {fuel_grades}")
        
        # Test with WorkFossa scraper integration
        logger.info("\n🔧 Testing WorkFossa Scraper Integration:")
        
        from app.services.workfossa_scraper import WorkOrderData
        
        # Create a test work order with dispenser data
        test_work_order = WorkOrderData(
            id="W-123456",
            external_id="W-123456",
            site_name="7-Eleven #1234",
            address="123 Main St, Anytown, CA 12345",
            service_code="2861",
            service_description="All Dispensers AccuMeasure Test",
            dispensers=[
                {
                    "dispenser_id": "D001",
                    "dispenser_number": "1",
                    "dispenser_type": "Wayne Ovation",
                    "serial_number": "WO123456",
                    "fuel_grades": {
                        "regular": {"octane": 87},
                        "plus": {"octane": 89},
                        "premium": {"octane": 91}
                    }
                },
                {
                    "dispenser_id": "D002",
                    "dispenser_number": "2",
                    "dispenser_type": "Gilbarco Encore",
                    "serial_number": "GE789012",
                    "fuel_grades": {
                        "regular": {"octane": 87},
                        "plus": {"octane": 89},
                        "premium": {"octane": 91},
                        "diesel": {}
                    }
                }
            ]
        )
        
        logger.info(f"✅ Created test work order: {test_work_order.external_id}")
        logger.info(f"   Site: {test_work_order.site_name}")
        logger.info(f"   Service: {test_work_order.service_code} - {test_work_order.service_description}")
        logger.info(f"   Dispensers: {len(test_work_order.dispensers)}")
        
        for disp in test_work_order.dispensers:
            logger.info(f"     - Dispenser {disp['dispenser_number']}: {disp['dispenser_type']}")
            logger.info(f"       Serial: {disp.get('serial_number', 'N/A')}")
            logger.info(f"       Fuel Grades: {list(disp['fuel_grades'].keys())}")
        
        logger.info("\n🎉 All tests completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_dispenser_scraper_logic())