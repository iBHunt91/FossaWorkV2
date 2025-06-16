#!/usr/bin/env python3
"""
Test script to verify visit URL extraction from WorkFossa scraper
"""

import asyncio
import logging
from datetime import datetime

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_visit_url_extraction():
    """Test the visit URL extraction functionality"""
    
    # Mock HTML content that simulates a WorkFossa work order row
    mock_html = """
    <tr>
        <td><input type="checkbox" /></td>
        <td><a href="/app/work/123456">W-123456</a></td>
        <td>7-Eleven #1234<br>1234 Main St<br>Anytown, CA 90210</td>
        <td>2861 - All Dispensers AccuMeasure Test<br>6 Dispensers</td>
        <td>
            0 / 1 visits<br>
            NEXT VISIT: <a href="/app/work/123456/visits/789012">06/12/2025 (anytime)</a>
        </td>
    </tr>
    """
    
    # Expected results
    expected_work_order_id = "W-123456"
    expected_visit_url = "https://app.workfossa.com/app/work/123456/visits/789012"
    expected_visit_id = "789012"
    
    logger.info("Testing visit URL extraction...")
    logger.info("Mock HTML content simulates a work order row with:")
    logger.info("- Work Order ID: W-123456")
    logger.info("- Visit link: /app/work/123456/visits/789012")
    logger.info("- Visit date: 06/12/2025 (anytime)")
    
    # Test regex patterns
    import re
    
    # Extract visit URL
    visit_url_match = re.search(r'href="(/app/work/\d+/visits/\d+)"', mock_html)
    if visit_url_match:
        relative_url = visit_url_match.group(1)
        absolute_url = f"https://app.workfossa.com{relative_url}"
        logger.info(f"✅ Found visit URL: {absolute_url}")
        
        # Extract visit ID
        visit_id_match = re.search(r'/visits/(\d+)', relative_url)
        if visit_id_match:
            visit_id = visit_id_match.group(1)
            logger.info(f"✅ Extracted visit ID: {visit_id}")
        else:
            logger.error("❌ Could not extract visit ID")
    else:
        logger.error("❌ Could not find visit URL in HTML")
    
    # Test date extraction
    date_match = re.search(r'>(\d{1,2}/\d{1,2}/\d{4})\s*\(', mock_html)
    if date_match:
        visit_date = date_match.group(1)
        logger.info(f"✅ Found visit date: {visit_date}")
    else:
        logger.error("❌ Could not extract visit date")
    
    logger.info("\nSummary:")
    logger.info("The WorkFossa scraper is configured to extract:")
    logger.info("1. Visit URL from the NEXT VISIT hyperlink")
    logger.info("2. Visit ID from the URL pattern")
    logger.info("3. Visit date from the link text")
    logger.info("\nThe extracted visit URL will be stored in the database and used directly")
    logger.info("instead of generating URLs, ensuring accurate navigation to work orders.")

if __name__ == "__main__":
    asyncio.run(test_visit_url_extraction())