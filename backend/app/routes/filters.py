"""API routes for filter calculations."""

from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime

from app.services.filter_calculator import FilterCalculator
from app.routes.auth import get_current_user
from app.models.user_models import User


router = APIRouter(prefix="/filters", tags=["Filters"])


class FilterCalculationRequest(BaseModel):
    """Request model for filter calculation."""
    workOrders: List[Dict]
    dispensers: List[Dict]
    overrides: Optional[Dict[str, int]] = None


class FilterCalculationResponse(BaseModel):
    """Response model for filter calculation."""
    summary: List[Dict]
    details: List[Dict]
    warnings: List[Dict]
    totalFilters: int
    totalBoxes: int
    metadata: Dict


@router.post("/calculate", response_model=FilterCalculationResponse)
async def calculate_filters(
    request: FilterCalculationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Calculate filter requirements based on work orders and dispensers.
    
    This endpoint processes work orders and dispenser data to determine:
    - Number and types of filters needed
    - Box calculations based on filter types
    - Warnings for data issues or special cases
    - Detailed breakdown by job
    """
    try:
        calculator = FilterCalculator()
        
        # Convert Pydantic models to dicts if needed
        work_orders = [wo if isinstance(wo, dict) else wo.dict() for wo in request.workOrders]
        dispensers = [d if isinstance(d, dict) else d.dict() for d in request.dispensers]
        
        # Calculate filters
        result = calculator.calculate_filters(
            work_orders=work_orders,
            dispensers=dispensers,
            overrides=request.overrides
        )
        
        return FilterCalculationResponse(**result)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Filter calculation failed: {str(e)}"
        )


@router.get("/config")
async def get_filter_config(current_user: User = Depends(get_current_user)):
    """
    Get filter configuration including part numbers and rules.
    
    Returns:
    - Store chain configurations
    - Fuel grade rules
    - Service code definitions
    """
    return {
        "storeChains": FilterCalculator.FILTER_CONFIGS,
        "fuelGradeRules": {
            "alwaysFilter": FilterCalculator.ALWAYS_FILTER,
            "neverFilter": FilterCalculator.NEVER_FILTER
        },
        "specialCodes": FilterCalculator.SPECIAL_CODES,
        "boxSizes": {
            "standard": FilterCalculator.STANDARD_BOX_SIZE,
            "def": FilterCalculator.DEF_BOX_SIZE
        }
    }


@router.get("/part-numbers")
async def get_part_numbers(
    chain: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get filter part numbers, optionally filtered by chain.
    
    Parameters:
    - chain: Optional store chain name to filter results
    
    Returns list of part numbers with descriptions.
    """
    part_numbers = []
    
    chains_to_process = [chain] if chain else FilterCalculator.FILTER_CONFIGS.keys()
    
    for store_chain in chains_to_process:
        if store_chain not in FilterCalculator.FILTER_CONFIGS:
            continue
            
        config = FilterCalculator.FILTER_CONFIGS[store_chain]
        
        # Add gas filters
        for meter_type, part_number in config.get('gas', {}).items():
            if part_number:
                part_numbers.append({
                    "partNumber": part_number,
                    "chain": store_chain,
                    "type": "gas",
                    "meterType": meter_type,
                    "description": f"{store_chain} Gas Filter ({meter_type})"
                })
        
        # Add diesel filter
        if 'diesel' in config and config['diesel']:
            part_numbers.append({
                "partNumber": config['diesel'],
                "chain": store_chain,
                "type": "diesel",
                "description": f"{store_chain} Diesel Filter"
            })
        
        # Add high flow diesel filter
        if 'diesel_high_flow' in config and config['diesel_high_flow']:
            part_numbers.append({
                "partNumber": config['diesel_high_flow'],
                "chain": store_chain,
                "type": "diesel_high_flow",
                "description": f"{store_chain} High Flow Diesel Filter"
            })
        
        # Add DEF filter
        if 'def' in config and config['def']:
            part_numbers.append({
                "partNumber": config['def'],
                "chain": store_chain,
                "type": "def",
                "description": f"{store_chain} DEF Filter"
            })
    
    # Remove duplicates based on part number
    seen = set()
    unique_part_numbers = []
    for pn in part_numbers:
        if pn['partNumber'] not in seen:
            seen.add(pn['partNumber'])
            unique_part_numbers.append(pn)
    
    return unique_part_numbers


@router.post("/validate")
async def validate_filter_data(
    work_orders: List[Dict],
    current_user: User = Depends(get_current_user)
):
    """
    Validate work order data for filter calculation.
    
    Checks for:
    - Required fields
    - Valid service codes
    - Data format issues
    
    Returns validation results with any issues found.
    """
    issues = []
    valid_count = 0
    
    required_fields = ['jobId', 'storeNumber', 'serviceCode', 'scheduledDate', 'customerName']
    
    for idx, work_order in enumerate(work_orders):
        wo_issues = []
        
        # Check required fields
        for field in required_fields:
            if field not in work_order or not work_order[field]:
                wo_issues.append(f"Missing required field: {field}")
        
        # Validate service code
        if 'serviceCode' in work_order:
            service_code = work_order['serviceCode']
            if service_code not in FilterCalculator.SPECIAL_CODES:
                wo_issues.append(f"Unknown service code: {service_code}")
        
        # Validate date format
        if 'scheduledDate' in work_order:
            try:
                datetime.fromisoformat(work_order['scheduledDate'].replace('Z', '+00:00'))
            except:
                wo_issues.append(f"Invalid date format: {work_order['scheduledDate']}")
        
        if wo_issues:
            issues.append({
                "index": idx,
                "jobId": work_order.get('jobId', 'Unknown'),
                "issues": wo_issues
            })
        else:
            valid_count += 1
    
    return {
        "totalWorkOrders": len(work_orders),
        "validCount": valid_count,
        "invalidCount": len(issues),
        "issues": issues,
        "isValid": len(issues) == 0
    }