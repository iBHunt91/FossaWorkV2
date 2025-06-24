"""
Easy enablement of security migration monitoring
"""

from fastapi import FastAPI, APIRouter
from .security_migration import SecurityMigrationMiddleware

# Global instance for accessing reports
migration_middleware = None

def enable_security_migration(app: FastAPI, block_legacy: bool = False):
    """
    Enable security migration monitoring with a single function call.
    
    Add this to your main.py:
    ```python
    from app.middleware.enable_security_migration import enable_security_migration
    enable_security_migration(app)
    ```
    
    Args:
        app: FastAPI application instance
        block_legacy: If True, block requests to critical endpoints with user_id params
    """
    global migration_middleware
    
    # Create and add the middleware
    migration_middleware = SecurityMigrationMiddleware(app, block_legacy=block_legacy)
    app.add_middleware(SecurityMigrationMiddleware, block_legacy=block_legacy)
    
    # Add admin endpoint for migration report
    admin_router = APIRouter(prefix="/api/admin", tags=["admin"])
    
    @admin_router.get("/security-migration-report")
    async def get_security_migration_report():
        """Get the current security migration report"""
        if migration_middleware:
            return migration_middleware.get_migration_report()
        return {"error": "Migration middleware not initialized"}
    
    app.include_router(admin_router)
    
    print("✅ Security migration monitoring enabled!")
    print(f"   - Blocking mode: {'ON' if block_legacy else 'OFF'}")
    print("   - Report available at: /api/admin/security-migration-report")
    print("   - Check logs for: SECURITY_MIGRATION and CRITICAL_SECURITY tags")