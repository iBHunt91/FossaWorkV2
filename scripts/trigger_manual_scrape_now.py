#!/usr/bin/env python3
"""Trigger manual work order scrape to run cleanup"""

import requests
import json
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def trigger_manual_scrape():
    """Trigger manual scrape via API"""
    
    base_url = "http://localhost:8000"
    
    # First, we need to login
    logger.info("Logging in to get auth token...")
    login_response = requests.post(
        f"{base_url}/api/v1/auth/login",
        json={
            "email": "bruce.hunt@owlservices.com",
            "password": "your_workfossa_password"  # Replace with actual password
        }
    )
    
    if login_response.status_code != 200:
        logger.error(f"Login failed: {login_response.text}")
        logger.info("\nPlease update the password in this script or use the UI to trigger a manual scrape")
        return
    
    token = login_response.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Trigger manual scrape
    logger.info("\nTriggering manual work order scrape...")
    scrape_response = requests.post(
        f"{base_url}/api/v1/work-orders/scrape",
        headers=headers
    )
    
    if scrape_response.status_code != 200:
        logger.error(f"Failed to trigger scrape: {scrape_response.text}")
        return
    
    session_id = scrape_response.json()["data"]["session_id"]
    logger.info(f"Scrape started with session ID: {session_id}")
    
    # Monitor progress
    logger.info("\nMonitoring scrape progress...")
    while True:
        progress_response = requests.get(
            f"{base_url}/api/v1/work-orders/scrape/progress/{session_id}",
            headers=headers
        )
        
        if progress_response.status_code == 200:
            progress = progress_response.json()["data"]
            logger.info(f"Progress: {progress['percentage']}% - {progress['message']}")
            
            if progress.get("completed", False):
                logger.info("\nScrape completed!")
                logger.info(f"Total work orders: {progress.get('total_work_orders', 0)}")
                if "removed_count" in progress:
                    logger.info(f"Work orders removed: {progress['removed_count']}")
                break
        
        time.sleep(2)

if __name__ == "__main__":
    logger.info("Manual Work Order Scrape Trigger")
    logger.info("=" * 60)
    logger.info("\nNOTE: The scraper now fetches ALL work orders (not just incomplete)")
    logger.info("This allows the cleanup logic to remove completed work orders\n")
    
    trigger_manual_scrape()