#!/usr/bin/env python3
"""
WorkFossa scraping service - Modern Python implementation
Replaces legacy unified_scrape.js with better error handling and data structures
"""

import asyncio
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import uuid
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class DispenserInfo:
    """Clean data structure for dispenser information"""
    dispenser_number: str
    dispenser_type: str
    fuel_grades: Dict[str, Any]
    status: str = "pending"
    progress_percentage: float = 0.0
    automation_completed: bool = False
    last_updated: str = ""
    
    def __post_init__(self):
        if not self.last_updated:
            self.last_updated = datetime.now().isoformat()

@dataclass
class WorkOrderInfo:
    """Clean data structure for work order information"""
    id: str
    external_id: str
    site_name: str
    address: str
    scheduled_date: str
    status: str = "pending"
    dispensers: List[DispenserInfo] = None
    created_at: str = ""
    
    def __post_init__(self):
        if self.dispensers is None:
            self.dispensers = []
        if not self.created_at:
            self.created_at = datetime.now().isoformat()
        if not self.id:
            self.id = str(uuid.uuid4())

class WorkFossaScraper:
    """
    Modern scraping service for WorkFossa data
    Replaces the legacy Node.js scraper with better architecture
    """
    
    def __init__(self, user_id: str, credentials: Dict[str, str]):
        self.user_id = user_id
        self.credentials = credentials
        self.session_active = False
        self.last_scrape_time = None
        
    async def login(self) -> bool:
        """
        Login to WorkFossa system
        Returns True if successful, False otherwise
        """
        try:
            # TODO: Implement with playwright when available
            # For now, simulate successful login
            logger.info(f"Logging in user {self.user_id} to WorkFossa...")
            
            # Simulate login process
            await asyncio.sleep(0.1)  # Simulate network delay
            
            self.session_active = True
            logger.info("Login successful")
            return True
            
        except Exception as e:
            logger.error(f"Login failed: {e}")
            return False
    
    async def scrape_work_orders(self) -> List[WorkOrderInfo]:
        """
        Scrape work orders from WorkFossa
        Returns list of WorkOrderInfo objects
        """
        if not self.session_active:
            if not await self.login():
                return []
        
        try:
            logger.info("Scraping work orders...")
            
            # TODO: Implement actual scraping with playwright
            # For now, return sample data structure
            sample_work_orders = [
                WorkOrderInfo(
                    id=str(uuid.uuid4()),
                    external_id="WO-110154",
                    site_name="Test Gas Station #1", 
                    address="123 Main St, City, ST 12345",
                    scheduled_date=(datetime.now() + timedelta(days=1)).isoformat(),
                    dispensers=[
                        DispenserInfo(
                            dispenser_number="1",
                            dispenser_type="Wayne 300",
                            fuel_grades={
                                "position_1": {"type": "Regular", "octane": 87, "ethanol": 10},
                                "position_2": {"type": "Mid-Grade", "octane": 89, "ethanol": 10},
                                "position_3": {"type": "Premium", "octane": 91, "ethanol": 10}
                            }
                        ),
                        DispenserInfo(
                            dispenser_number="2", 
                            dispenser_type="Wayne 300",
                            fuel_grades={
                                "position_1": {"type": "Regular", "octane": 87, "ethanol": 10},
                                "position_2": {"type": "Mid-Grade", "octane": 89, "ethanol": 10},
                                "position_3": {"type": "Premium", "octane": 91, "ethanol": 10},
                                "position_4": {"type": "Diesel", "cetane": 40, "sulfur": "low"}
                            }
                        )
                    ]
                )
            ]
            
            self.last_scrape_time = datetime.now()
            logger.info(f"Successfully scraped {len(sample_work_orders)} work orders")
            
            return sample_work_orders
            
        except Exception as e:
            logger.error(f"Work order scraping failed: {e}")
            return []
    
    async def scrape_dispensers(self, work_order_id: str) -> List[DispenserInfo]:
        """
        Scrape detailed dispenser information for a specific work order
        """
        try:
            logger.info(f"Scraping dispensers for work order {work_order_id}")
            
            # TODO: Implement actual dispenser scraping
            # For now, return enhanced sample data
            sample_dispensers = [
                DispenserInfo(
                    dispenser_number="1",
                    dispenser_type="Wayne 300",
                    fuel_grades={
                        "regular": {"octane": 87, "ethanol": 10, "position": 1},
                        "mid": {"octane": 89, "ethanol": 10, "position": 2}, 
                        "premium": {"octane": 91, "ethanol": 10, "position": 3}
                    },
                    status="ready_for_automation"
                ),
                DispenserInfo(
                    dispenser_number="2",
                    dispenser_type="Encore 500",
                    fuel_grades={
                        "regular": {"octane": 87, "ethanol": 10, "position": 1},
                        "mid": {"octane": 89, "ethanol": 10, "position": 2},
                        "premium": {"octane": 91, "ethanol": 10, "position": 3},
                        "diesel": {"cetane": 40, "sulfur": "low", "position": 4}
                    },
                    status="ready_for_automation"
                )
            ]
            
            logger.info(f"Successfully scraped {len(sample_dispensers)} dispensers")
            return sample_dispensers
            
        except Exception as e:
            logger.error(f"Dispenser scraping failed: {e}")
            return []
    
    def get_scrape_status(self) -> Dict[str, Any]:
        """Get current scraping status and statistics"""
        return {
            "user_id": self.user_id,
            "session_active": self.session_active,
            "last_scrape_time": self.last_scrape_time.isoformat() if self.last_scrape_time else None,
            "scraper_version": "2.0.0",
            "status": "ready" if self.session_active else "not_logged_in"
        }

class DataManager:
    """
    Manages scraped data storage and retrieval
    Replaces file-based storage with structured data management
    """
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.work_orders: Dict[str, WorkOrderInfo] = {}
        self.dispensers: Dict[str, List[DispenserInfo]] = {}
    
    def store_work_orders(self, work_orders: List[WorkOrderInfo]) -> None:
        """Store work orders in memory (will be database later)"""
        for wo in work_orders:
            self.work_orders[wo.id] = wo
            if wo.dispensers:
                self.dispensers[wo.id] = wo.dispensers
        
        logger.info(f"Stored {len(work_orders)} work orders for user {self.user_id}")
    
    def get_work_orders(self) -> List[WorkOrderInfo]:
        """Retrieve all work orders for the user"""
        return list(self.work_orders.values())
    
    def get_work_order(self, work_order_id: str) -> Optional[WorkOrderInfo]:
        """Get specific work order by ID"""
        return self.work_orders.get(work_order_id)
    
    def get_dispensers(self, work_order_id: str) -> List[DispenserInfo]:
        """Get dispensers for a specific work order"""
        return self.dispensers.get(work_order_id, [])
    
    def export_data(self) -> Dict[str, Any]:
        """Export all data as JSON-serializable dict"""
        return {
            "user_id": self.user_id,
            "work_orders": {wo_id: asdict(wo) for wo_id, wo in self.work_orders.items()},
            "dispensers": {wo_id: [asdict(d) for d in dispensers] 
                          for wo_id, dispensers in self.dispensers.items()},
            "export_timestamp": datetime.now().isoformat()
        }

# Service factory functions
def create_scraper(user_id: str, credentials: Dict[str, str]) -> WorkFossaScraper:
    """Factory function to create scraper instance"""
    return WorkFossaScraper(user_id, credentials)

def create_data_manager(user_id: str) -> DataManager:
    """Factory function to create data manager instance"""
    return DataManager(user_id)

# Async helper for testing
async def test_scraping_service():
    """Test the scraping service without external dependencies"""
    print("[SYNC] Testing scraping service...")
    
    # Test data
    test_user_id = "test_user_123"
    test_credentials = {"username": "test", "password": "test"}
    
    # Create scraper
    scraper = create_scraper(test_user_id, test_credentials)
    data_manager = create_data_manager(test_user_id)
    
    # Test login
    login_success = await scraper.login()
    assert login_success, "Login should succeed"
    print("  [OK] Login simulation successful")
    
    # Test work order scraping
    work_orders = await scraper.scrape_work_orders()
    assert len(work_orders) > 0, "Should return work orders"
    print(f"  [OK] Scraped {len(work_orders)} work orders")
    
    # Test data storage
    data_manager.store_work_orders(work_orders)
    stored_orders = data_manager.get_work_orders()
    assert len(stored_orders) == len(work_orders), "Should store all work orders"
    print("  [OK] Data storage working")
    
    # Test dispenser scraping
    if work_orders:
        dispensers = await scraper.scrape_dispensers(work_orders[0].id)
        assert len(dispensers) > 0, "Should return dispensers"
        print(f"  [OK] Scraped {len(dispensers)} dispensers")
    
    # Test status
    status = scraper.get_scrape_status()
    assert status["session_active"], "Session should be active"
    print("  [OK] Status reporting working")
    
    # Test export
    export_data = data_manager.export_data()
    assert "work_orders" in export_data, "Should contain work orders"
    print("  [OK] Data export working")
    
    print("[SUCCESS] All scraping service tests passed!")
    return True

if __name__ == "__main__":
    # Run test if called directly
    asyncio.run(test_scraping_service())