#!/usr/bin/env python3
"""
Debug customer URL access - check actual values
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / 'backend'))

from app.database import SessionLocal
from app.models import WorkOrder

def debug_customer_url_access():
    """Debug actual customer URL values"""
    
    print("🔍 DEBUGGING CUSTOMER URL ACCESS")
    print("=" * 50)
    
    db = SessionLocal()
    try:
        # Get one work order
        wo = db.query(WorkOrder).filter(
            WorkOrder.external_id == "#38437"
        ).first()
        
        if not wo:
            print("❌ Work order #38437 not found")
            return
        
        print(f"🔍 Work Order: {wo.external_id}")
        print(f"📋 Site: {wo.site_name}")
        print()
        
        # Check all possible customer URL sources
        print("🔍 CHECKING ALL CUSTOMER URL SOURCES:")
        print("-" * 40)
        
        # 1. Direct customer_url attribute
        print("1. Direct customer_url attribute:")
        if hasattr(wo, 'customer_url'):
            print(f"   ✅ Has attribute: {wo.customer_url}")
            print(f"   📊 Type: {type(wo.customer_url)}")
            print(f"   📊 Value: '{wo.customer_url}'")
        else:
            print("   ❌ No customer_url attribute")
        
        print()
        
        # 2. Scraped data
        print("2. Scraped data:")
        if wo.scraped_data:
            print(f"   ✅ Has scraped_data: {type(wo.scraped_data)}")
            print(f"   📊 Keys: {list(wo.scraped_data.keys())}")
            
            if 'customer_url' in wo.scraped_data:
                customer_url_value = wo.scraped_data.get('customer_url')
                print(f"   ✅ Has customer_url key")
                print(f"   📊 Type: {type(customer_url_value)}")
                print(f"   📊 Value: '{customer_url_value}'")
                
                # Check if it's empty, None, or whitespace
                if customer_url_value:
                    print(f"   ✅ Value is truthy")
                else:
                    print(f"   ❌ Value is falsy")
                    
                if customer_url_value and customer_url_value.strip():
                    print(f"   ✅ Value has content after strip")
                else:
                    print(f"   ❌ Value is empty after strip")
            else:
                print("   ❌ No customer_url key in scraped_data")
        else:
            print("   ❌ No scraped_data")
        
        print()
        
        # 3. Test the exact logic from the failing code
        print("3. TESTING EXACT FAILING LOGIC:")
        print("-" * 40)
        
        customer_url = None
        
        if hasattr(wo, 'customer_url') and wo.customer_url:
            customer_url = wo.customer_url
            print(f"   ✅ Found via customer_url attribute: {customer_url}")
        elif wo.scraped_data and wo.scraped_data.get('customer_url'):
            customer_url = wo.scraped_data.get('customer_url')
            print(f"   ✅ Found via scraped_data.customer_url: {customer_url}")
        else:
            print("   ❌ No customer URL found using failing logic")
            
            # Debug why the condition failed
            print("\n   🔍 DEBUGGING WHY IT FAILED:")
            print(f"   - hasattr(wo, 'customer_url'): {hasattr(wo, 'customer_url')}")
            if hasattr(wo, 'customer_url'):
                print(f"   - wo.customer_url: '{wo.customer_url}' (truthy: {bool(wo.customer_url)})")
            
            print(f"   - wo.scraped_data: {bool(wo.scraped_data)}")
            if wo.scraped_data:
                print(f"   - wo.scraped_data.get('customer_url'): '{wo.scraped_data.get('customer_url')}' (truthy: {bool(wo.scraped_data.get('customer_url'))})")
        
        print()
        print("4. FINAL RESULT:")
        print(f"   Customer URL: '{customer_url}'")
        print(f"   Is valid: {bool(customer_url)}")
        
    finally:
        db.close()

if __name__ == "__main__":
    debug_customer_url_access()