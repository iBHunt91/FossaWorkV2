#!/usr/bin/env python3
"""
Test dispenser title extraction to identify the issue
"""
import re
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) + '/backend')

from app.database import SessionLocal
from app.models import Dispenser
from app.models.user_models import User

def test_title_extraction():
    """Test title extraction patterns"""
    print("🔍 Testing Dispenser Title Extraction")
    print("=" * 70)
    
    # Test patterns
    test_texts = [
        # Pattern that WORKS (current regex)
        "1/2 - Regular, Plus, Diesel Gilbarco",
        "3/4 - Premium, Regular Wayne",
        
        # Patterns that might NOT work
        "Dispenser 1/2",
        "1/2",
        "Dispenser #1",
        "Dispenser 1",
        "1 - Regular, Plus",
        "Gilbarco Encore 500 - Dispenser 1/2",
        "S/N: 12345\nMAKE: Gilbarco\nMODEL: Encore\nGRADE 0126 0135",
    ]
    
    # Current regex from dispenser_scraper.py
    current_pattern = r'(\d+\/\d+\s*-\s*[^\n]+)'
    
    print("\n📋 Testing current regex pattern:")
    print(f"Pattern: {current_pattern}")
    print("-" * 50)
    
    for text in test_texts:
        match = re.search(current_pattern, text)
        if match:
            print(f"✅ MATCH: '{text}' → '{match.group(1)}'")
        else:
            print(f"❌ NO MATCH: '{text}'")
    
    # Test dispenser number extraction
    print("\n📋 Testing dispenser number extraction:")
    number_pattern = r'^(\d+)(?:\/(\d+))?'
    
    test_numbers = ["1/2", "3/4", "1", "5", "Dispenser 1/2", ""]
    
    for text in test_numbers:
        match = re.match(number_pattern, text)
        if match:
            nums = [match.group(1)]
            if match.group(2):
                nums.append(match.group(2))
            print(f"✅ '{text}' → Numbers: {nums}, Full: '{match.group(0)}'")
        else:
            print(f"❌ '{text}' → No match")
    
    # Check database dispensers
    print("\n📋 Checking actual database dispensers:")
    db = SessionLocal()
    try:
        dispensers = db.query(Dispenser).limit(5).all()
        
        for d in dispensers:
            print(f"\nDispenser {d.dispenser_number}:")
            
            # Check form_data title
            if d.form_data and 'title' in d.form_data:
                title = d.form_data['title']
                print(f"  form_data.title: '{title}'")
                match = re.search(current_pattern, title)
                print(f"  Matches current pattern: {'Yes ✅' if match else 'No ❌'}")
            else:
                print(f"  form_data.title: Not found")
            
            # Check what dispenser number info we have
            print(f"  dispenser_number: {d.dispenser_number}")
            if d.form_data:
                print(f"  form_data.dispenser_numbers: {d.form_data.get('dispenser_numbers', 'Not found')}")
    
    finally:
        db.close()
    
    print("\n💡 Recommendation:")
    print("The current regex is too strict. It requires 'number/number - text' format.")
    print("Many dispensers may not have this exact format, causing them to be skipped.")

if __name__ == "__main__":
    test_title_extraction()