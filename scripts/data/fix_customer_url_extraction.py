#!/usr/bin/env python3
"""
Fix the customer URL extraction based on the actual WorkFossa structure
"""

# Based on the screenshots provided:
# - Customer URL format: https://app.workfossa.com/app/customers/locations/46769/
# - The store number (#38437) should link to the customer location page
# - We need to find where these links are in the work order table

# The fix will be to update the _extract_customer_url method to:
# 1. Look for links in the customer/site name cell
# 2. Handle different link patterns (customer name link vs store number link)
# 3. Extract the customer location ID from the URL

print("🔧 Customer URL Extraction Fix")
print("="*50)

print("\n📝 Current Issue:")
print("   - Customer URLs are not being extracted from work order rows")
print("   - Store numbers like #38437 should link to customer pages")
print("   - Without these URLs, dispenser scraping can't work")

print("\n🎯 Fix Strategy:")
print("   1. Update _extract_customer_url to look for ANY link in the customer cell")
print("   2. Check if the link contains '/customers/locations/'")
print("   3. Also try to construct URLs from store numbers if no direct link")

print("\n💡 Implementation:")
print("   We'll update the workfossa_scraper.py file with improved extraction logic")

# Show the updated code
updated_code = '''
async def _extract_customer_url(self, element) -> Optional[str]:
    """Extract customer location URL from the work order row"""
    logger.info(f"🔍 [CUSTOMER_URL] Looking for customer URL in element...")
    
    try:
        # Look for ALL links in the element (not just those with store numbers)
        links = await element.query_selector_all("a")
        
        logger.info(f"🔍 [CUSTOMER_URL] Found {len(links)} links in element")
        
        for i, link in enumerate(links):
            href = await link.get_attribute("href")
            link_text = await link.text_content()
            
            logger.info(f"🔍 [CUSTOMER_URL] Link {i+1}: href='{href}', text='{link_text}'")
            
            # Check if this is a customer location link
            if href and '/customers/locations/' in href:
                # Convert relative URLs to absolute
                if href.startswith('/'):
                    customer_url = f"https://app.workfossa.com{href}"
                else:
                    customer_url = href
                
                logger.info(f"✅ [CUSTOMER_URL] Found customer URL: {customer_url}")
                return customer_url
        
        # Fallback: Try to find store number and construct URL
        # This would require knowing the customer location ID mapping
        text_content = await element.text_content()
        if text_content:
            store_match = re.search(r'#(\d+)', text_content)
            if store_match:
                store_number = store_match.group(1)
                logger.info(f"🔍 [CUSTOMER_URL] Found store number #{store_number} but no direct link")
                # We would need a mapping of store numbers to location IDs here
        
        logger.warning(f"⚠️ [CUSTOMER_URL] No customer location links found")
        return None
        
    except Exception as e:
        logger.error(f"❌ [CUSTOMER_URL] Error extracting customer URL: {e}")
        return None
'''

print("\n✅ Ready to apply fix!")
print("\nThe fix will:")
print("   1. Look for any link containing '/customers/locations/'")
print("   2. Not require the link text to have a store number")
print("   3. Log all links found for debugging")

print("\n📍 Next steps:")
print("   1. Apply this fix to workfossa_scraper.py")
print("   2. Run a fresh work order scrape to get customer URLs")
print("   3. Then run dispenser scraping which should now work")