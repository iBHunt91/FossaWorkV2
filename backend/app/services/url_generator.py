#!/usr/bin/env python3
"""
WorkFossa URL Generator Service
Generates proper visit URLs for work orders to enable automation
"""

import re
import logging
from typing import Optional, Dict, Any
from dataclasses import dataclass
from urllib.parse import urlencode, quote

logger = logging.getLogger(__name__)

@dataclass
class WorkFossaURLConfig:
    """Configuration for WorkFossa URL generation"""
    base_url: str = "https://app.workfossa.com"
    visit_base: str = "/app/visits"
    work_order_base: str = "/app/work/list"
    dashboard_url: str = "/app/dashboard"
    
    # URL patterns based on V1 research
    visit_patterns = {
        'visit_by_id': '/app/visits/{visit_id}',
        'visit_by_work_order': '/app/visits/work-order/{work_order_id}',
        'scheduled_visits': '/app/work/list?visit_scheduled=scheduled',
        'pending_visits': '/app/work/list?status=pending',
        'visit_details': '/app/visits/{visit_id}/details'
    }

class WorkFossaURLGenerator:
    """
    Generates WorkFossa URLs for automation based on work order data
    """
    
    def __init__(self, config: Optional[WorkFossaURLConfig] = None):
        self.config = config or WorkFossaURLConfig()
        
    def generate_visit_url(self, work_order: Dict[str, Any]) -> Optional[str]:
        """
        Generate visit URL from work order data
        
        Args:
            work_order: Work order data dictionary
            
        Returns:
            Generated visit URL or None if cannot generate
        """
        try:
            basic_info = work_order.get('basic_info', {})
            work_order_id = basic_info.get('id')
            external_id = basic_info.get('external_id')
            
            if not work_order_id:
                logger.warning("Cannot generate visit URL: missing work order ID")
                return None
            
            # Strategy 1: Try work order ID directly
            visit_url = self._generate_url_by_work_order_id(work_order_id)
            if visit_url:
                logger.info(f"Generated visit URL for work order {work_order_id}: {visit_url}")
                return visit_url
            
            # Strategy 2: Try external ID if available
            if external_id:
                visit_url = self._generate_url_by_external_id(external_id)
                if visit_url:
                    logger.info(f"Generated visit URL using external ID {external_id}: {visit_url}")
                    return visit_url
            
            # Strategy 3: Generate search URL
            visit_url = self._generate_search_url(work_order)
            logger.info(f"Generated search URL for work order {work_order_id}: {visit_url}")
            return visit_url
            
        except Exception as e:
            logger.error(f"Failed to generate visit URL: {e}")
            return None
    
    def _generate_url_by_work_order_id(self, work_order_id: str) -> str:
        """Generate URL using work order ID"""
        # Remove 'wo_' prefix if present and extract meaningful parts
        clean_id = work_order_id.replace('wo_', '')
        
        # Try different URL patterns
        patterns = [
            f"{self.config.base_url}/app/visits/work-order/{work_order_id}",
            f"{self.config.base_url}/app/visits/{work_order_id}",
            f"{self.config.base_url}/app/work/details/{work_order_id}",
            f"{self.config.base_url}/app/visits/{clean_id}"
        ]
        
        # Return the most likely pattern (first one)
        return patterns[0]
    
    def _generate_url_by_external_id(self, external_id: str) -> str:
        """Generate URL using external ID (e.g., WO-1749327761978-59)"""
        # Extract numeric parts for URL generation
        numeric_part = re.sub(r'[^\d]', '', external_id)
        
        return f"{self.config.base_url}/app/visits/external/{external_id}"
    
    def _generate_search_url(self, work_order: Dict[str, Any]) -> str:
        """Generate search URL to find the work order"""
        basic_info = work_order.get('basic_info', {})
        location = work_order.get('location', {})
        
        search_params = {}
        
        # Add search parameters
        if external_id := basic_info.get('external_id'):
            search_params['search'] = external_id
        elif site_name := location.get('site_name'):
            search_params['search'] = site_name
        elif store_info := basic_info.get('store_info'):
            search_params['search'] = store_info
        
        # Add status filter
        scheduling = work_order.get('scheduling', {})
        if status := scheduling.get('status'):
            search_params['status'] = status
        
        # Encode parameters
        query_string = urlencode(search_params) if search_params else ''
        base_url = f"{self.config.base_url}/app/work/list"
        
        return f"{base_url}?{query_string}" if query_string else base_url
    
    def generate_batch_urls(self, work_orders: list) -> Dict[str, str]:
        """
        Generate visit URLs for a batch of work orders
        
        Args:
            work_orders: List of work order dictionaries
            
        Returns:
            Dictionary mapping work order IDs to visit URLs
        """
        results = {}
        
        for work_order in work_orders:
            basic_info = work_order.get('basic_info', {})
            work_order_id = basic_info.get('id')
            
            if work_order_id:
                visit_url = self.generate_visit_url(work_order)
                if visit_url:
                    results[work_order_id] = visit_url
                else:
                    logger.warning(f"Could not generate URL for work order {work_order_id}")
            else:
                logger.warning("Skipping work order without ID")
        
        logger.info(f"Generated {len(results)} URLs from {len(work_orders)} work orders")
        return results
    
    def validate_url(self, url: str) -> bool:
        """
        Validate that a generated URL follows expected patterns
        
        Args:
            url: URL to validate
            
        Returns:
            True if URL appears valid
        """
        try:
            # Check if URL starts with expected base
            if not url.startswith(self.config.base_url):
                return False
            
            # Check for required path components
            path = url.replace(self.config.base_url, '')
            
            # Must contain either /app/visits or /app/work
            if '/app/visits' not in path and '/app/work' not in path:
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"URL validation error: {e}")
            return False
    
    def get_workfossa_login_url(self) -> str:
        """Get WorkFossa login URL"""
        return f"{self.config.base_url}/login"
    
    def get_dashboard_url(self) -> str:
        """Get WorkFossa dashboard URL"""
        return f"{self.config.base_url}{self.config.dashboard_url}"

# Service utilities
def enhance_work_orders_with_urls(work_orders: list) -> list:
    """
    Enhance work orders with generated visit URLs
    
    Args:
        work_orders: List of work order dictionaries
        
    Returns:
        Enhanced work orders with visit_url field added
    """
    url_generator = WorkFossaURLGenerator()
    enhanced_orders = []
    
    for work_order in work_orders:
        enhanced_order = work_order.copy()
        
        # Generate visit URL
        visit_url = url_generator.generate_visit_url(work_order)
        
        if visit_url:
            # Add URL to visit_info section
            if 'visit_info' not in enhanced_order:
                enhanced_order['visit_info'] = {}
            
            enhanced_order['visit_info']['visit_url'] = visit_url
            enhanced_order['visit_info']['url_generated'] = True
            enhanced_order['visit_info']['url_generation_timestamp'] = __import__('datetime').datetime.now().isoformat()
        else:
            logger.warning(f"Could not generate URL for work order {work_order.get('basic_info', {}).get('id')}")
            
            # Mark as URL generation failed
            if 'visit_info' not in enhanced_order:
                enhanced_order['visit_info'] = {}
            enhanced_order['visit_info']['url_generated'] = False
        
        enhanced_orders.append(enhanced_order)
    
    logger.info(f"Enhanced {len(enhanced_orders)} work orders with visit URLs")
    return enhanced_orders

# Testing function
def test_url_generator():
    """Test the URL generator with sample data"""
    print("[SYNC] Testing WorkFossa URL Generator...")
    
    # Sample work order data
    sample_work_order = {
        'basic_info': {
            'id': 'wo_1749327761978_59',
            'external_id': 'WO-1749327761978-59',
            'brand': '7-Eleven',
            'store_info': 'Store #38437'
        },
        'location': {
            'site_name': 'Eleven Store',
            'address': 'Store #38437 7-Eleven Stores East Martin Luther King Boulevard Tampa, FL 33603'
        },
        'scheduling': {
            'status': 'pending'
        }
    }
    
    generator = WorkFossaURLGenerator()
    
    # Test single URL generation
    visit_url = generator.generate_visit_url(sample_work_order)
    print(f"  [OK] Generated URL: {visit_url}")
    
    # Test URL validation
    is_valid = generator.validate_url(visit_url) if visit_url else False
    print(f"  [OK] URL validation: {is_valid}")
    
    # Test batch generation
    work_orders = [sample_work_order]
    batch_urls = generator.generate_batch_urls(work_orders)
    print(f"  [OK] Batch URLs: {len(batch_urls)} generated")
    
    # Test work order enhancement
    enhanced = enhance_work_orders_with_urls(work_orders)
    has_url = enhanced[0].get('visit_info', {}).get('visit_url') is not None
    print(f"  [OK] Work order enhancement: {has_url}")
    
    # Test utility URLs
    login_url = generator.get_workfossa_login_url()
    dashboard_url = generator.get_dashboard_url()
    print(f"  [OK] Login URL: {login_url}")
    print(f"  [OK] Dashboard URL: {dashboard_url}")
    
    print("[SUCCESS] URL Generator tests completed!")
    return True

if __name__ == "__main__":
    test_url_generator()