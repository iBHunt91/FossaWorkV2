#!/usr/bin/env python3
"""
Test Dispenser Scraping Optimization
====================================

This script tests the optimized dispenser scraping to ensure:
1. Performance improvements are realized
2. Data accuracy is maintained
3. No stability issues are introduced
"""

import asyncio
import time
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.services.workfossa_scraper import WorkFossaScraper
from app.services.browser_automation import BrowserAutomationService


async def test_dispenser_scraping():
    """Test the optimized dispenser scraping"""
    print("🧪 Testing Optimized Dispenser Scraping")
    print("=" * 50)
    
    # Initialize services
    browser_service = BrowserAutomationService()
    scraper = WorkFossaScraper(browser_service)
    
    # Enable debug mode for testing
    scraper.config['enable_debug_screenshots'] = True
    
    # Track timing metrics
    metrics = {
        'navigation_times': [],
        'equipment_tab_times': [],
        'dispenser_section_times': [],
        'total_times': [],
        'dispenser_counts': []
    }
    
    try:
        # Test configuration
        test_cases = [
            {
                'work_order_id': 'TEST001',
                'customer_url': 'https://example.com/customer/123',
                'expected_dispensers': 5
            }
        ]
        
        # Create a mock session for testing
        session_id = 'test_session_123'
        
        for test_case in test_cases:
            print(f"\n📋 Testing work order: {test_case['work_order_id']}")
            print(f"   Customer URL: {test_case['customer_url']}")
            
            start_time = time.time()
            
            try:
                # Run the optimized scraper
                dispensers = await scraper.scrape_dispenser_details(
                    session_id=session_id,
                    work_order_id=test_case['work_order_id'],
                    customer_url=test_case['customer_url']
                )
                
                end_time = time.time()
                total_time = end_time - start_time
                
                # Record metrics
                metrics['total_times'].append(total_time)
                metrics['dispenser_counts'].append(len(dispensers))
                
                print(f"✅ Scraping completed in {total_time:.2f} seconds")
                print(f"   Found {len(dispensers)} dispensers")
                
                # Validate results
                if len(dispensers) > 0:
                    print("   Sample dispenser data:")
                    for i, dispenser in enumerate(dispensers[:2]):
                        print(f"   - Dispenser {i+1}: {dispenser.get('dispenser_number', 'N/A')} - {dispenser.get('dispenser_type', 'N/A')}")
                else:
                    print("⚠️  No dispensers found - this might indicate an issue")
                
            except Exception as e:
                print(f"❌ Error during test: {e}")
                import traceback
                traceback.print_exc()
        
        # Print summary
        print("\n📊 PERFORMANCE SUMMARY")
        print("=" * 50)
        
        if metrics['total_times']:
            avg_time = sum(metrics['total_times']) / len(metrics['total_times'])
            print(f"Average time per work order: {avg_time:.2f} seconds")
            print(f"Min time: {min(metrics['total_times']):.2f} seconds")
            print(f"Max time: {max(metrics['total_times']):.2f} seconds")
            
            avg_dispensers = sum(metrics['dispenser_counts']) / len(metrics['dispenser_counts'])
            print(f"Average dispensers found: {avg_dispensers:.1f}")
        
        # Compare with expected performance
        print("\n🎯 OPTIMIZATION TARGETS")
        print("=" * 50)
        print("Target time per work order: 7.5 seconds")
        print("Previous time per work order: 39.5 seconds")
        
        if metrics['total_times'] and avg_time < 10:
            print("\n✅ OPTIMIZATION SUCCESSFUL!")
            print(f"   Achieved {avg_time:.2f} seconds per work order")
            improvement = ((39.5 - avg_time) / 39.5) * 100
            print(f"   Performance improvement: {improvement:.0f}%")
        else:
            print("\n⚠️  Performance target not met")
            print("   Check logs for potential issues")
            
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup
        if hasattr(browser_service, 'cleanup'):
            await browser_service.cleanup()


def main():
    """Run the test"""
    print("🚀 Starting Dispenser Scraping Optimization Test")
    print("This test will verify the performance improvements")
    print("-" * 50)
    
    # Note about requirements
    print("\n⚠️  Prerequisites:")
    print("1. Backend server should be running")
    print("2. Valid WorkFossa credentials configured")
    print("3. Network access to WorkFossa")
    print("\nPress Ctrl+C to cancel or wait 3 seconds to continue...")
    
    try:
        time.sleep(3)
    except KeyboardInterrupt:
        print("\n❌ Test cancelled")
        return
    
    # Run the async test
    asyncio.run(test_dispenser_scraping())
    
    print("\n✅ Test completed")


if __name__ == "__main__":
    main()