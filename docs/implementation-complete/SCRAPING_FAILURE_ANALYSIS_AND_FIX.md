# Work Order Scraping Failure Analysis and Fix

## Summary of Issues Found

Based on the investigation of the scraping failures, I found two distinct issues affecting different users:

### Issue 1: Database Constraint Violation (User: 7bea3bdb7e8e303eacaba442bd824004)
- **Error**: `NOT NULL constraint failed: dispensers.work_order_id`
- **Cause**: When work orders are deleted (because they're completed and no longer show in WorkFossa), the system tries to set the associated dispensers' `work_order_id` to NULL, which violates the NOT NULL constraint
- **Timing**: Recent failures at 19:40, 19:33, 19:30, 19:06
- **Duration**: ~55-65 seconds before failure

### Issue 2: Login Failures (User: 80bb76f1de123a479e6391a8ee70a7bb)
- **Error**: `Failed to login to WorkFossa`
- **Cause**: Invalid or expired WorkFossa credentials
- **Timing**: Consistent failures every hour at :30 (16:30, 15:30, 14:30, etc.)
- **Duration**: ~27 seconds before failure

## Root Cause Analysis

### Issue 1 - Database Constraint
The work order cleanup logic in `scheduler_service.py` (lines 223-236) was attempting to delete work orders that are no longer present in WorkFossa (completed orders). However, it wasn't properly handling the foreign key relationship with the dispensers table. The comment claimed "cascade delete will handle removing associated dispensers," but the actual foreign key constraint was not set up for CASCADE DELETE, causing the constraint violation.

### Issue 2 - Authentication
The user `80bb76f1de123a479e6391a8ee70a7bb` has invalid WorkFossa credentials stored. The scraper attempts to login but fails immediately, preventing any scraping from occurring.

## Fixes Applied

### Fix 1: Proper Dispenser Deletion (COMPLETED)
Modified `scheduler_service.py` to explicitly delete dispensers before deleting work orders:

```python
# First, delete associated dispensers to avoid foreign key constraint violations
dispensers_to_delete = db.query(Dispenser).filter(
    Dispenser.work_order_id == wo_to_remove.id
).all()

for dispenser in dispensers_to_delete:
    logger.debug(f"  Deleting dispenser {dispenser.dispenser_number} for work order {wo_to_remove.external_id}")
    db.delete(dispenser)

# Then delete the work order
db.delete(wo_to_remove)
```

### Fix 2: Credential Validation
Created test scripts to validate user credentials:
- `test_user_credentials.py` - Tests both API and browser login
- `test_scraping_step_by_step.py` - Step-by-step scraping process debugging

## Testing Scripts Created

1. **check_recent_scraping_failures.py** - Analyzes scraping history and identifies failure patterns
2. **test_user_credentials.py** - Tests WorkFossa credentials for users
3. **fix_dispenser_constraint.py** - Database constraint analysis and fix options
4. **test_scraping_step_by_step.py** - Detailed scraping process testing

## Recommendations

1. **Immediate Actions**:
   - ✅ Deploy the fix to `scheduler_service.py` to properly delete dispensers
   - Have user `80bb76f1de123a479e6391a8ee70a7bb` update their WorkFossa credentials in settings

2. **Future Improvements**:
   - Add credential validation when users save credentials
   - Implement better error reporting in the UI to distinguish between login failures and other errors
   - Consider adding a "Test Connection" button in settings to validate credentials
   - Add database migration to properly set up CASCADE DELETE on the foreign key constraint

3. **Monitoring**:
   - Watch for successful scraping after the fix is deployed
   - Monitor for any new constraint violations
   - Check that work order cleanup is working properly (completed orders are being removed)

## How to Verify the Fix

1. **For Database Constraint Issue**:
   - Run `python3 scripts/check_recent_scraping_failures.py` to see current failures
   - Wait for next scheduled scrape or trigger manually
   - Check that no constraint violations occur
   - Verify completed work orders are properly removed

2. **For Login Issues**:
   - Run `python3 scripts/test_user_credentials.py` to test credentials
   - Have affected users update their credentials in settings
   - Verify successful login after credential update

The fix for the database constraint issue has been applied and should resolve the scraping failures for the main user. The login failures require user action to update their credentials.