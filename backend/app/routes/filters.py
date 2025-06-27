"""API routes for filter calculations."""

import logging
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime

from app.services.filter_calculator import FilterCalculator
from app.routes.auth import get_current_user
from app.models.user_models import User

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/v1/filters", tags=["Filters"])


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
    logger.info(f"[FILTER_CALC] Starting filter calculation for user {current_user.username}")
    logger.info(f"[FILTER_CALC] Received {len(request.workOrders)} work orders")
    logger.info(f"[FILTER_CALC] Received {len(request.dispensers)} dispensers")
    logger.info(f"[FILTER_CALC] Overrides provided: {bool(request.overrides)}")
    
    # Log work order details
    if request.workOrders:
        logger.debug(f"[FILTER_CALC] Work order sample: {request.workOrders[0]}")
        work_order_ids = [wo.get('jobId') if isinstance(wo, dict) else wo.jobId for wo in request.workOrders]
        logger.info(f"[FILTER_CALC] Work order IDs: {work_order_ids[:10]}{'...' if len(work_order_ids) > 10 else ''}")
    else:
        logger.warning("[FILTER_CALC] No work orders provided for calculation")
    
    # Log dispenser details
    if request.dispensers:
        logger.debug(f"[FILTER_CALC] Dispenser sample: {request.dispensers[0]}")
        dispenser_stores = list(set([d.get('storeNumber') if isinstance(d, dict) else d.storeNumber for d in request.dispensers]))
        logger.info(f"[FILTER_CALC] Dispensers available for stores: {dispenser_stores[:10]}{'...' if len(dispenser_stores) > 10 else ''}")
    else:
        logger.warning("[FILTER_CALC] No dispensers provided for calculation")
    
    try:
        calculator = FilterCalculator()
        
        # Convert Pydantic models to dicts if needed
        work_orders = [wo if isinstance(wo, dict) else wo.dict() for wo in request.workOrders]
        dispensers = [d if isinstance(d, dict) else d.dict() for d in request.dispensers]
        
        logger.info(f"[FILTER_CALC] Converted to {len(work_orders)} work order dicts and {len(dispensers)} dispenser dicts")
        
        # Calculate filters
        logger.info("[FILTER_CALC] Starting filter calculation...")
        result = calculator.calculate_filters(
            work_orders=work_orders,
            dispensers=dispensers,
            overrides=request.overrides
        )
        
        # Log calculation results
        logger.info(f"[FILTER_CALC] Calculation completed successfully")
        logger.info(f"[FILTER_CALC] Summary items: {len(result.get('summary', []))}")
        logger.info(f"[FILTER_CALC] Detail items: {len(result.get('details', []))}")
        logger.info(f"[FILTER_CALC] Warnings: {len(result.get('warnings', []))}")
        logger.info(f"[FILTER_CALC] Total filters: {result.get('totalFilters', 0)}")
        logger.info(f"[FILTER_CALC] Total boxes: {result.get('totalBoxes', 0)}")
        
        # Log filter summary for debugging
        if result.get('summary'):
            for item in result['summary']:
                logger.debug(f"[FILTER_CALC] Summary: {item['partNumber']} - {item['quantity']} units, {item['boxes']} boxes")
        
        # Log warnings if any
        if result.get('warnings'):
            for warning in result['warnings']:
                logger.warning(f"[FILTER_CALC] Warning: {warning.get('message')} (severity: {warning.get('severity')})")
        
        return FilterCalculationResponse(**result)
        
    except Exception as e:
        logger.error(f"[FILTER_CALC] Filter calculation failed: {str(e)}", exc_info=True)
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
    logger.info(f"[FILTER_VALIDATE] Validating {len(work_orders)} work orders for user {current_user.username}")
    
    issues = []
    valid_count = 0
    
    required_fields = ['jobId', 'storeNumber', 'serviceCode', 'scheduledDate', 'customerName']
    
    for idx, work_order in enumerate(work_orders):
        wo_issues = []
        logger.debug(f"[FILTER_VALIDATE] Validating work order {idx+1}/{len(work_orders)}: {work_order.get('jobId')}")
        
        # Check required fields
        for field in required_fields:
            if field not in work_order or not work_order[field]:
                wo_issues.append(f"Missing required field: {field}")
                logger.debug(f"[FILTER_VALIDATE] Work order {work_order.get('jobId')} missing field: {field}")
        
        # Validate service code
        if 'serviceCode' in work_order:
            service_code = work_order['serviceCode']
            if service_code not in FilterCalculator.SPECIAL_CODES:
                wo_issues.append(f"Unknown service code: {service_code}")
                logger.warning(f"[FILTER_VALIDATE] Unknown service code {service_code} in work order {work_order.get('jobId')}")
            else:
                logger.debug(f"[FILTER_VALIDATE] Valid service code {service_code} for work order {work_order.get('jobId')}")
        
        # Validate date format
        if 'scheduledDate' in work_order:
            try:
                scheduled_date = datetime.fromisoformat(work_order['scheduledDate'].replace('Z', '+00:00'))
                logger.debug(f"[FILTER_VALIDATE] Valid date {scheduled_date} for work order {work_order.get('jobId')}")
            except:
                wo_issues.append(f"Invalid date format: {work_order['scheduledDate']}")
                logger.warning(f"[FILTER_VALIDATE] Invalid date format {work_order['scheduledDate']} in work order {work_order.get('jobId')}")
        
        if wo_issues:
            issues.append({
                "index": idx,
                "jobId": work_order.get('jobId', 'Unknown'),
                "issues": wo_issues
            })
            logger.debug(f"[FILTER_VALIDATE] Work order {work_order.get('jobId')} has {len(wo_issues)} issues")
        else:
            valid_count += 1
    
    result = {
        "totalWorkOrders": len(work_orders),
        "validCount": valid_count,
        "invalidCount": len(issues),
        "issues": issues,
        "isValid": len(issues) == 0
    }
    
    logger.info(f"[FILTER_VALIDATE] Validation complete: {valid_count}/{len(work_orders)} valid work orders")
    if issues:
        logger.warning(f"[FILTER_VALIDATE] Found {len(issues)} work orders with validation issues")
    
    return result


@router.post("/debug-data-format")
async def debug_data_format(
    request: FilterCalculationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Debug endpoint to analyze the data format mismatch between database and filter calculator.
    Shows actual vs expected data formats for dispensers.
    """
    logger.info(f"[FILTER_DEBUG] Debugging data format for user {current_user.username}")
    logger.info(f"[FILTER_DEBUG] Received {len(request.dispensers)} dispensers")
    
    debug_results = {
        "dispensers_analyzed": len(request.dispensers),
        "format_analysis": [],
        "transformation_test": [],
        "recommendations": []
    }
    
    for i, dispenser in enumerate(request.dispensers):
        dispenser_debug = {
            "index": i,
            "dispenser_number": dispenser.get('dispenserNumber', 'Unknown'),
            "store_number": dispenser.get('storeNumber', 'Unknown'),
            "fuel_grades_raw": dispenser.get('fuelGrades'),
            "fuel_grades_type": str(type(dispenser.get('fuelGrades'))),
            "meter_type": dispenser.get('meterType', 'Unknown')
        }
        
        # Analyze the fuel grades format
        fuel_grades = dispenser.get('fuelGrades')
        if fuel_grades is None:
            dispenser_debug["format_issue"] = "fuel_grades is None"
        elif isinstance(fuel_grades, str):
            dispenser_debug["format_issue"] = "fuel_grades is a string (needs JSON parsing)"
        elif isinstance(fuel_grades, dict):
            dispenser_debug["format_issue"] = "fuel_grades is dict, needs transformation to list"
            dispenser_debug["dict_keys"] = list(fuel_grades.keys())
            
            # Test transformation
            transformed = transform_fuel_grades(fuel_grades)
            dispenser_debug["transformed_format"] = transformed
            dispenser_debug["transformation_successful"] = bool(transformed)
            
        elif isinstance(fuel_grades, list):
            dispenser_debug["format_issue"] = "fuel_grades is already a list"
            if fuel_grades and isinstance(fuel_grades[0], dict):
                if 'grade' in fuel_grades[0]:
                    dispenser_debug["format_issue"] = "fuel_grades is correctly formatted"
                else:
                    dispenser_debug["format_issue"] = "fuel_grades list items missing 'grade' key"
                    dispenser_debug["list_item_keys"] = list(fuel_grades[0].keys()) if fuel_grades else []
        else:
            dispenser_debug["format_issue"] = f"Unknown fuel_grades type: {type(fuel_grades)}"
        
        debug_results["format_analysis"].append(dispenser_debug)
    
    # Generate recommendations
    dict_count = sum(1 for analysis in debug_results["format_analysis"] 
                    if analysis.get("fuel_grades_type") == "<class 'dict'>")
    none_count = sum(1 for analysis in debug_results["format_analysis"] 
                    if "fuel_grades is None" in analysis.get("format_issue", ""))
    
    if dict_count > 0:
        debug_results["recommendations"].append(
            f"{dict_count} dispensers have dict format - need transformation to list[dict] with 'grade' key"
        )
    
    if none_count > 0:
        debug_results["recommendations"].append(
            f"{none_count} dispensers have None fuel_grades - missing data issue"
        )
    
    debug_results["recommendations"].append(
        "Use transform_fuel_grades() function to convert dict format to expected list format"
    )
    
    return debug_results


def transform_fuel_grades(fuel_grades_dict: dict) -> list:
    """
    Transform fuel grades from database dict format to filter calculator list format.
    
    Input (database format):
    {
        "regular": {"name": "Regular"}, 
        "plus": {"name": "Plus"}, 
        "premium": {"name": "Premium"}
    }
    
    Output (filter calculator format):
    [
        {"grade": "Regular"}, 
        {"grade": "Plus"}, 
        {"grade": "Premium"}
    ]
    """
    if not isinstance(fuel_grades_dict, dict):
        return []
    
    transformed = []
    for fuel_type, fuel_data in fuel_grades_dict.items():
        if isinstance(fuel_data, dict) and 'name' in fuel_data:
            transformed.append({"grade": fuel_data['name']})
        else:
            # Fallback: use the key as grade name
            transformed.append({"grade": fuel_type.title()})
    
    return transformed