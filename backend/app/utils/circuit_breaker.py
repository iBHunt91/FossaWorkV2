"""
Circuit breaker implementation for external service calls.
Prevents cascading failures when external services are down.
"""

import asyncio
import time
from typing import Optional, Callable, Any, TypeVar, Union
from functools import wraps
from enum import Enum
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"  # Normal operation
    OPEN = "open"      # Failing, reject calls
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreakerError(Exception):
    """Raised when circuit breaker is open."""
    pass


class CircuitBreaker:
    """
    Circuit breaker implementation to prevent cascading failures.
    
    Args:
        failure_threshold: Number of failures before opening circuit
        recovery_timeout: Seconds to wait before trying half-open
        expected_exception: Exception type to catch (default: Exception)
        name: Name for logging purposes
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception,
        name: str = "CircuitBreaker"
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.name = name
        
        self._failure_count = 0
        self._last_failure_time: Optional[float] = None
        self._state = CircuitState.CLOSED
        self._half_open_attempts = 0
        self._success_count = 0
        
    @property
    def state(self) -> CircuitState:
        """Get current circuit state."""
        if self._state == CircuitState.OPEN:
            if self._should_attempt_reset():
                self._state = CircuitState.HALF_OPEN
                self._half_open_attempts = 0
                logger.info(f"Circuit breaker '{self.name}' transitioning to HALF_OPEN")
        return self._state
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to try reset."""
        return (
            self._last_failure_time is not None and
            time.time() - self._last_failure_time >= self.recovery_timeout
        )
    
    def _record_success(self):
        """Record successful call."""
        self._failure_count = 0
        self._success_count += 1
        
        if self._state == CircuitState.HALF_OPEN:
            if self._success_count >= 3:  # Require 3 successes to fully close
                self._state = CircuitState.CLOSED
                self._success_count = 0
                logger.info(f"Circuit breaker '{self.name}' closed after successful recovery")
    
    def _record_failure(self):
        """Record failed call."""
        self._failure_count += 1
        self._last_failure_time = time.time()
        self._success_count = 0
        
        if self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.OPEN
            logger.warning(f"Circuit breaker '{self.name}' reopened after failure in HALF_OPEN state")
        elif self._failure_count >= self.failure_threshold:
            self._state = CircuitState.OPEN
            logger.warning(
                f"Circuit breaker '{self.name}' opened after {self._failure_count} failures"
            )
    
    def call(self, func: Callable[..., T], *args, **kwargs) -> T:
        """
        Call function with circuit breaker protection.
        
        Args:
            func: Function to call
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func
            
        Returns:
            Result of func
            
        Raises:
            CircuitBreakerError: If circuit is open
            Exception: If func raises exception
        """
        if self.state == CircuitState.OPEN:
            raise CircuitBreakerError(
                f"Circuit breaker '{self.name}' is OPEN - service unavailable"
            )
        
        try:
            result = func(*args, **kwargs)
            self._record_success()
            return result
        except self.expected_exception as e:
            self._record_failure()
            raise
    
    async def async_call(self, func: Callable[..., Any], *args, **kwargs) -> Any:
        """
        Call async function with circuit breaker protection.
        
        Args:
            func: Async function to call
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func
            
        Returns:
            Result of func
            
        Raises:
            CircuitBreakerError: If circuit is open
            Exception: If func raises exception
        """
        if self.state == CircuitState.OPEN:
            raise CircuitBreakerError(
                f"Circuit breaker '{self.name}' is OPEN - service unavailable"
            )
        
        try:
            result = await func(*args, **kwargs)
            self._record_success()
            return result
        except self.expected_exception as e:
            self._record_failure()
            raise
    
    def reset(self):
        """Manually reset the circuit breaker."""
        self._failure_count = 0
        self._last_failure_time = None
        self._state = CircuitState.CLOSED
        self._success_count = 0
        logger.info(f"Circuit breaker '{self.name}' manually reset")
    
    def get_status(self) -> dict:
        """Get current circuit breaker status."""
        return {
            "name": self.name,
            "state": self._state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout": self.recovery_timeout,
            "last_failure_time": (
                datetime.fromtimestamp(self._last_failure_time).isoformat()
                if self._last_failure_time else None
            )
        }


def circuit_breaker(
    failure_threshold: int = 5,
    recovery_timeout: int = 60,
    expected_exception: type = Exception,
    name: Optional[str] = None
):
    """
    Decorator to add circuit breaker to a function.
    
    Args:
        failure_threshold: Number of failures before opening circuit
        recovery_timeout: Seconds to wait before trying half-open
        expected_exception: Exception type to catch
        name: Circuit breaker name (defaults to function name)
    """
    def decorator(func):
        breaker_name = name or func.__name__
        breaker = CircuitBreaker(
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
            expected_exception=expected_exception,
            name=breaker_name
        )
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            return await breaker.async_call(func, *args, **kwargs)
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            return breaker.call(func, *args, **kwargs)
        
        # Add method to get breaker status
        wrapper = async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
        wrapper.get_circuit_status = breaker.get_status
        wrapper.reset_circuit = breaker.reset
        
        return wrapper
    
    return decorator


# Pre-configured circuit breakers for common services
class CircuitBreakers:
    """Container for application circuit breakers."""
    
    # WorkFossa API circuit breaker
    workfossa_api = CircuitBreaker(
        failure_threshold=3,
        recovery_timeout=30,
        name="WorkFossa API"
    )
    
    # Email service circuit breaker
    email_service = CircuitBreaker(
        failure_threshold=5,
        recovery_timeout=60,
        name="Email Service"
    )
    
    # Pushover service circuit breaker
    pushover_service = CircuitBreaker(
        failure_threshold=5,
        recovery_timeout=60,
        name="Pushover Service"
    )
    
    @classmethod
    def get_all_status(cls) -> dict:
        """Get status of all circuit breakers."""
        return {
            "workfossa_api": cls.workfossa_api.get_status(),
            "email_service": cls.email_service.get_status(),
            "pushover_service": cls.pushover_service.get_status()
        }


# Example usage with WorkFossa API
@circuit_breaker(
    failure_threshold=3,
    recovery_timeout=30,
    expected_exception=Exception,
    name="WorkFossa Login"
)
async def workfossa_login_with_circuit_breaker(username: str, password: str):
    """
    Example of using circuit breaker with WorkFossa login.
    This should be integrated into the actual WorkFossa service.
    """
    # Your actual login logic here
    pass