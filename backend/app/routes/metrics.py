"""
Metrics endpoint for Prometheus monitoring.
"""

from fastapi import APIRouter, Response
from ..services.metrics_service import metrics_service

router = APIRouter()


@router.get("/metrics", 
    response_class=Response,
    tags=["monitoring"],
    summary="Prometheus metrics endpoint",
    description="Returns application metrics in Prometheus format"
)
async def get_metrics():
    """
    Get application metrics in Prometheus format.
    
    Note: This endpoint is intentionally not authenticated to allow
    Prometheus to scrape metrics. In production, you should:
    1. Use a separate port for metrics
    2. Implement IP-based access control
    3. Use a reverse proxy to restrict access
    """
    metrics_data = metrics_service.get_metrics()
    return Response(
        content=metrics_data,
        media_type="text/plain; version=0.0.4; charset=utf-8"
    )


@router.get("/health",
    tags=["monitoring"],
    summary="Health check endpoint",
    description="Returns application health status"
)
async def health_check():
    """
    Basic health check endpoint.
    Returns 200 if the application is running.
    """
    # You can add more sophisticated health checks here
    # For example, checking database connectivity, external services, etc.
    return {
        "status": "healthy",
        "service": "fossawork-v2",
        "version": "2.0.0"
    }