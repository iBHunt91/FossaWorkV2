#!/usr/bin/env python3
"""
Scheduler Service Wrapper
Tries to use APScheduler if available, falls back to mock implementation
"""

import logging

logger = logging.getLogger("fossawork.scheduler.wrapper")

# Try to import the real scheduler service
try:
    from .scheduler_service import scheduler_service
    logger.info("Using real scheduler service with APScheduler")
except ImportError as e:
    logger.warning(f"APScheduler not available: {e}")
    logger.info("Using mock scheduler service")
    from .scheduler_service_mock import mock_scheduler_service as scheduler_service

# Export the scheduler service (either real or mock)
__all__ = ['scheduler_service']