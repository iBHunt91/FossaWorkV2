#!/usr/bin/env python3
"""
Enhanced Error Recovery System with Intelligent Retry Mechanisms
Based on V1's robust error handling patterns with modern improvements
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, Union
from dataclasses import dataclass, asdict
from enum import Enum
import traceback
import uuid

logger = logging.getLogger(__name__)

class ErrorType(Enum):
    """Classification of error types for targeted recovery strategies"""
    NETWORK_ERROR = "network_error"
    TIMEOUT_ERROR = "timeout_error"
    AUTHENTICATION_ERROR = "authentication_error"
    PAGE_LOAD_ERROR = "page_load_error"
    ELEMENT_NOT_FOUND = "element_not_found"
    FORM_SUBMISSION_ERROR = "form_submission_error"
    SCRAPING_ERROR = "scraping_error"
    BROWSER_CRASH = "browser_crash"
    CREDENTIAL_ERROR = "credential_error"
    VALIDATION_ERROR = "validation_error"
    UNKNOWN_ERROR = "unknown_error"

class RecoveryAction(Enum):
    """Available recovery actions"""
    RETRY_IMMEDIATE = "retry_immediate"
    RETRY_WITH_DELAY = "retry_with_delay"
    RETRY_WITH_REFRESH = "retry_with_refresh"
    RETRY_WITH_NEW_SESSION = "retry_with_new_session"
    RETRY_WITH_ALTERNATIVE = "retry_with_alternative"
    SKIP_AND_CONTINUE = "skip_and_continue"
    ABORT_OPERATION = "abort_operation"
    ESCALATE_TO_MANUAL = "escalate_to_manual"

@dataclass
class ErrorContext:
    """Context information for error analysis"""
    error_id: str
    error_type: ErrorType
    error_message: str
    stack_trace: str
    operation_type: str  # "automation", "scraping", "login", etc.
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    work_order_id: Optional[str] = None
    dispenser_id: Optional[str] = None
    attempt_number: int = 1
    timestamp: datetime = None
    page_url: Optional[str] = None
    page_content: Optional[str] = None
    screenshot_path: Optional[str] = None
    browser_state: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()
        if self.error_id is None:
            self.error_id = str(uuid.uuid4())

@dataclass
class RecoveryStrategy:
    """Recovery strategy configuration"""
    action: RecoveryAction
    max_attempts: int
    delay_seconds: int
    exponential_backoff: bool = True
    success_criteria: Optional[str] = None
    fallback_strategy: Optional['RecoveryStrategy'] = None
    context_requirements: List[str] = None
    
    def __post_init__(self):
        if self.context_requirements is None:
            self.context_requirements = []

@dataclass
class RecoveryResult:
    """Result of a recovery attempt"""
    success: bool
    error_context: ErrorContext
    recovery_action: RecoveryAction
    attempts_made: int
    total_time_spent: float
    final_error: Optional[str] = None
    recovered_data: Optional[Any] = None
    next_action: Optional[str] = None

class ErrorClassifier:
    """Intelligent error classification system based on V1 patterns"""
    
    ERROR_PATTERNS = {
        ErrorType.TIMEOUT_ERROR: [
            "timeout", "timed out", "timeout exceeded", "operation timeout",
            "page timeout", "navigation timeout", "element timeout", "connection timeout"
        ],
        ErrorType.NETWORK_ERROR: [
            "network error", "connection refused", "dns resolution failed", 
            "net::err_", "fetch failed", "socket timeout", "connection reset", 
            "connection aborted"
        ],
        ErrorType.AUTHENTICATION_ERROR: [
            "unauthorized", "authentication failed", "login failed",
            "invalid credentials", "access denied", "forbidden",
            "session expired", "token expired"
        ],
        ErrorType.PAGE_LOAD_ERROR: [
            "page failed to load", "navigation failed", "page not found",
            "404", "500", "503", "page crash", "renderer crash"
        ],
        ErrorType.ELEMENT_NOT_FOUND: [
            "element not found", "no such element", "selector not found",
            "locator not found", "element not visible", "element not clickable"
        ],
        ErrorType.FORM_SUBMISSION_ERROR: [
            "form submission failed", "submit failed", "validation error",
            "required field", "invalid input", "form error"
        ],
        ErrorType.SCRAPING_ERROR: [
            "scraping failed", "extraction failed", "data not found",
            "parsing error", "structure changed", "content not available"
        ],
        ErrorType.BROWSER_CRASH: [
            "browser crashed", "browser not responding", "browser closed",
            "context closed", "page closed", "target closed"
        ],
        ErrorType.CREDENTIAL_ERROR: [
            "credential not found", "encryption failed", "decryption failed",
            "key not found", "credential expired"
        ]
    }
    
    @classmethod
    def classify_error(cls, error_message: str, exception: Exception = None) -> ErrorType:
        """Classify error based on message and exception type"""
        try:
            error_lower = error_message.lower()
            
            # Check exception type first
            if exception:
                exception_name = type(exception).__name__.lower()
                if "timeout" in exception_name:
                    return ErrorType.TIMEOUT_ERROR
                elif "connection" in exception_name or "network" in exception_name:
                    return ErrorType.NETWORK_ERROR
                elif "authentication" in exception_name or "unauthorized" in exception_name:
                    return ErrorType.AUTHENTICATION_ERROR
            
            # Check error message patterns
            for error_type, patterns in cls.ERROR_PATTERNS.items():
                for pattern in patterns:
                    if pattern in error_lower:
                        return error_type
            
            return ErrorType.UNKNOWN_ERROR
            
        except Exception as e:
            logger.warning(f"Error classification failed: {e}")
            return ErrorType.UNKNOWN_ERROR

class RetryStrategyManager:
    """Manages retry strategies for different error types based on V1 experience"""
    
    def __init__(self):
        self.strategies = self._initialize_strategies()
        self.max_global_attempts = 5
        self.circuit_breaker_threshold = 10  # Consecutive failures before circuit breaker
        self.circuit_breaker_reset_time = 300  # 5 minutes
        self.failure_counts: Dict[str, int] = {}
        self.circuit_breaker_state: Dict[str, Dict] = {}
    
    def _initialize_strategies(self) -> Dict[ErrorType, RecoveryStrategy]:
        """Initialize recovery strategies for each error type"""
        return {
            ErrorType.NETWORK_ERROR: RecoveryStrategy(
                action=RecoveryAction.RETRY_WITH_DELAY,
                max_attempts=3,
                delay_seconds=5,
                exponential_backoff=True,
                fallback_strategy=RecoveryStrategy(
                    action=RecoveryAction.RETRY_WITH_NEW_SESSION,
                    max_attempts=2,
                    delay_seconds=10
                )
            ),
            ErrorType.TIMEOUT_ERROR: RecoveryStrategy(
                action=RecoveryAction.RETRY_WITH_REFRESH,
                max_attempts=2,
                delay_seconds=3,
                fallback_strategy=RecoveryStrategy(
                    action=RecoveryAction.RETRY_WITH_NEW_SESSION,
                    max_attempts=1,
                    delay_seconds=5
                )
            ),
            ErrorType.AUTHENTICATION_ERROR: RecoveryStrategy(
                action=RecoveryAction.RETRY_WITH_NEW_SESSION,
                max_attempts=2,
                delay_seconds=2,
                context_requirements=["fresh_credentials"],
                fallback_strategy=RecoveryStrategy(
                    action=RecoveryAction.ESCALATE_TO_MANUAL,
                    max_attempts=1,
                    delay_seconds=0
                )
            ),
            ErrorType.PAGE_LOAD_ERROR: RecoveryStrategy(
                action=RecoveryAction.RETRY_WITH_REFRESH,
                max_attempts=3,
                delay_seconds=2,
                exponential_backoff=True,
                fallback_strategy=RecoveryStrategy(
                    action=RecoveryAction.RETRY_WITH_ALTERNATIVE,
                    max_attempts=2,
                    delay_seconds=5
                )
            ),
            ErrorType.ELEMENT_NOT_FOUND: RecoveryStrategy(
                action=RecoveryAction.RETRY_WITH_DELAY,
                max_attempts=4,
                delay_seconds=1,
                fallback_strategy=RecoveryStrategy(
                    action=RecoveryAction.RETRY_WITH_ALTERNATIVE,
                    max_attempts=2,
                    delay_seconds=2
                )
            ),
            ErrorType.FORM_SUBMISSION_ERROR: RecoveryStrategy(
                action=RecoveryAction.RETRY_WITH_REFRESH,
                max_attempts=2,
                delay_seconds=3,
                fallback_strategy=RecoveryStrategy(
                    action=RecoveryAction.SKIP_AND_CONTINUE,
                    max_attempts=1,
                    delay_seconds=0
                )
            ),
            ErrorType.SCRAPING_ERROR: RecoveryStrategy(
                action=RecoveryAction.RETRY_WITH_ALTERNATIVE,
                max_attempts=3,
                delay_seconds=2,
                fallback_strategy=RecoveryStrategy(
                    action=RecoveryAction.SKIP_AND_CONTINUE,
                    max_attempts=1,
                    delay_seconds=0
                )
            ),
            ErrorType.BROWSER_CRASH: RecoveryStrategy(
                action=RecoveryAction.RETRY_WITH_NEW_SESSION,
                max_attempts=2,
                delay_seconds=5,
                fallback_strategy=RecoveryStrategy(
                    action=RecoveryAction.ABORT_OPERATION,
                    max_attempts=1,
                    delay_seconds=0
                )
            ),
            ErrorType.CREDENTIAL_ERROR: RecoveryStrategy(
                action=RecoveryAction.ESCALATE_TO_MANUAL,
                max_attempts=1,
                delay_seconds=0
            ),
            ErrorType.UNKNOWN_ERROR: RecoveryStrategy(
                action=RecoveryAction.RETRY_WITH_DELAY,
                max_attempts=2,
                delay_seconds=3,
                fallback_strategy=RecoveryStrategy(
                    action=RecoveryAction.SKIP_AND_CONTINUE,
                    max_attempts=1,
                    delay_seconds=0
                )
            )
        }
    
    def get_strategy(self, error_type: ErrorType, context: ErrorContext) -> RecoveryStrategy:
        """Get appropriate recovery strategy based on error type and context"""
        base_strategy = self.strategies.get(error_type, self.strategies[ErrorType.UNKNOWN_ERROR])
        
        # Check circuit breaker
        circuit_key = f"{error_type.value}_{context.operation_type}"
        if self._is_circuit_breaker_open(circuit_key):
            logger.warning(f"Circuit breaker open for {circuit_key}, escalating to manual")
            return RecoveryStrategy(
                action=RecoveryAction.ESCALATE_TO_MANUAL,
                max_attempts=1,
                delay_seconds=0
            )
        
        # Adjust strategy based on attempt number
        if context.attempt_number >= base_strategy.max_attempts:
            if base_strategy.fallback_strategy:
                return base_strategy.fallback_strategy
            else:
                return RecoveryStrategy(
                    action=RecoveryAction.ABORT_OPERATION,
                    max_attempts=1,
                    delay_seconds=0
                )
        
        return base_strategy
    
    def _is_circuit_breaker_open(self, circuit_key: str) -> bool:
        """Check if circuit breaker is open for given operation"""
        if circuit_key not in self.circuit_breaker_state:
            return False
        
        state = self.circuit_breaker_state[circuit_key]
        if state["open"]:
            # Check if reset time has passed
            if datetime.now() > state["reset_time"]:
                self._reset_circuit_breaker(circuit_key)
                return False
            return True
        
        return False
    
    def _update_circuit_breaker(self, circuit_key: str, success: bool):
        """Update circuit breaker state based on operation result"""
        if circuit_key not in self.failure_counts:
            self.failure_counts[circuit_key] = 0
        
        if success:
            self.failure_counts[circuit_key] = 0
            self._reset_circuit_breaker(circuit_key)
        else:
            self.failure_counts[circuit_key] += 1
            if self.failure_counts[circuit_key] >= self.circuit_breaker_threshold:
                self._open_circuit_breaker(circuit_key)
    
    def _open_circuit_breaker(self, circuit_key: str):
        """Open circuit breaker for given operation"""
        self.circuit_breaker_state[circuit_key] = {
            "open": True,
            "reset_time": datetime.now() + timedelta(seconds=self.circuit_breaker_reset_time)
        }
        logger.warning(f"Circuit breaker opened for {circuit_key}")
    
    def _reset_circuit_breaker(self, circuit_key: str):
        """Reset circuit breaker for given operation"""
        if circuit_key in self.circuit_breaker_state:
            self.circuit_breaker_state[circuit_key]["open"] = False
        if circuit_key in self.failure_counts:
            self.failure_counts[circuit_key] = 0

class ErrorRecoveryService:
    """Main error recovery service with intelligent retry mechanisms"""
    
    def __init__(self, browser_automation=None, form_automation=None, scraper=None):
        self.strategy_manager = RetryStrategyManager()
        self.error_classifier = ErrorClassifier()
        self.recovery_callbacks: List[Callable] = []
        self.error_history: List[ErrorContext] = []
        self.recovery_statistics: Dict[str, Dict] = {}
        
        # Service integrations - set via dependency injection
        self.browser_automation = browser_automation
        self.form_automation = form_automation
        self.scraper = scraper
        
        # Recovery function registry
        self.recovery_functions = self._initialize_recovery_functions()
    
    def set_browser_automation(self, browser_automation):
        """Set browser automation service via dependency injection"""
        self.browser_automation = browser_automation
    
    def set_form_automation(self, form_automation):
        """Set form automation service via dependency injection"""
        self.form_automation = form_automation
    
    def set_scraper(self, scraper):
        """Set scraper service via dependency injection"""
        self.scraper = scraper
    
    def add_recovery_callback(self, callback: Callable):
        """Add callback for recovery events"""
        self.recovery_callbacks.append(callback)
    
    async def _emit_recovery_event(self, event_type: str, data: Dict[str, Any]):
        """Emit recovery event to all callbacks"""
        for callback in self.recovery_callbacks:
            try:
                await callback(event_type, data)
            except Exception as e:
                logger.warning(f"Recovery callback error: {e}")
    
    def _initialize_recovery_functions(self) -> Dict[RecoveryAction, Callable]:
        """Initialize recovery action functions"""
        return {
            RecoveryAction.RETRY_IMMEDIATE: self._retry_immediate,
            RecoveryAction.RETRY_WITH_DELAY: self._retry_with_delay,
            RecoveryAction.RETRY_WITH_REFRESH: self._retry_with_refresh,
            RecoveryAction.RETRY_WITH_NEW_SESSION: self._retry_with_new_session,
            RecoveryAction.RETRY_WITH_ALTERNATIVE: self._retry_with_alternative,
            RecoveryAction.SKIP_AND_CONTINUE: self._skip_and_continue,
            RecoveryAction.ABORT_OPERATION: self._abort_operation,
            RecoveryAction.ESCALATE_TO_MANUAL: self._escalate_to_manual
        }
    
    async def handle_error(self, error: Exception, operation_context: Dict[str, Any], 
                          original_function: Callable, *args, **kwargs) -> RecoveryResult:
        """
        Main error handling entry point with intelligent recovery
        Based on V1's comprehensive error handling patterns
        """
        start_time = time.time()
        
        # Create error context
        error_context = self._create_error_context(error, operation_context)
        self.error_history.append(error_context)
        
        await self._emit_recovery_event("error_detected", {
            "error_context": asdict(error_context),
            "operation": operation_context.get("operation_type", "unknown")
        })
        
        # Classify error
        error_type = self.error_classifier.classify_error(str(error), error)
        error_context.error_type = error_type
        
        logger.error(f"Error classified as {error_type.value}: {error}")
        
        # Get recovery strategy
        strategy = self.strategy_manager.get_strategy(error_type, error_context)
        
        await self._emit_recovery_event("recovery_strategy_selected", {
            "error_type": error_type.value,
            "strategy": asdict(strategy),
            "attempt_number": error_context.attempt_number
        })
        
        # Execute recovery
        recovery_result = await self._execute_recovery(
            strategy, error_context, original_function, *args, **kwargs
        )
        
        recovery_result.total_time_spent = time.time() - start_time
        
        # Update statistics
        self._update_recovery_statistics(error_type, strategy.action, recovery_result.success)
        
        # Update circuit breaker
        circuit_key = f"{error_type.value}_{error_context.operation_type}"
        self.strategy_manager._update_circuit_breaker(circuit_key, recovery_result.success)
        
        await self._emit_recovery_event("recovery_completed", {
            "result": asdict(recovery_result),
            "success": recovery_result.success
        })
        
        return recovery_result
    
    def _create_error_context(self, error: Exception, operation_context: Dict[str, Any]) -> ErrorContext:
        """Create comprehensive error context"""
        return ErrorContext(
            error_id=str(uuid.uuid4()),
            error_type=ErrorType.UNKNOWN_ERROR,  # Will be set by classifier
            error_message=str(error),
            stack_trace=traceback.format_exc(),
            operation_type=operation_context.get("operation_type", "unknown"),
            session_id=operation_context.get("session_id"),
            user_id=operation_context.get("user_id"),
            work_order_id=operation_context.get("work_order_id"),
            dispenser_id=operation_context.get("dispenser_id"),
            attempt_number=operation_context.get("attempt_number", 1),
            page_url=operation_context.get("page_url"),
            browser_state=operation_context.get("browser_state")
        )
    
    async def _execute_recovery(self, strategy: RecoveryStrategy, error_context: ErrorContext,
                               original_function: Callable, *args, **kwargs) -> RecoveryResult:
        """Execute recovery strategy"""
        recovery_function = self.recovery_functions.get(strategy.action)
        if not recovery_function:
            logger.error(f"No recovery function for action {strategy.action}")
            return RecoveryResult(
                success=False,
                error_context=error_context,
                recovery_action=strategy.action,
                attempts_made=0,
                total_time_spent=0,
                final_error="No recovery function available"
            )
        
        try:
            result = await recovery_function(strategy, error_context, original_function, *args, **kwargs)
            return result
        except Exception as e:
            logger.error(f"Recovery function failed: {e}")
            return RecoveryResult(
                success=False,
                error_context=error_context,
                recovery_action=strategy.action,
                attempts_made=1,
                total_time_spent=0,
                final_error=str(e)
            )
    
    async def _retry_immediate(self, strategy: RecoveryStrategy, error_context: ErrorContext,
                              original_function: Callable, *args, **kwargs) -> RecoveryResult:
        """Retry operation immediately"""
        for attempt in range(strategy.max_attempts):
            try:
                await self._emit_recovery_event("retry_attempt", {
                    "attempt": attempt + 1,
                    "max_attempts": strategy.max_attempts,
                    "strategy": "immediate"
                })
                
                result = await original_function(*args, **kwargs)
                return RecoveryResult(
                    success=True,
                    error_context=error_context,
                    recovery_action=strategy.action,
                    attempts_made=attempt + 1,
                    total_time_spent=0,
                    recovered_data=result
                )
            except Exception as e:
                if attempt == strategy.max_attempts - 1:
                    return RecoveryResult(
                        success=False,
                        error_context=error_context,
                        recovery_action=strategy.action,
                        attempts_made=attempt + 1,
                        total_time_spent=0,
                        final_error=str(e)
                    )
                continue
    
    async def _retry_with_delay(self, strategy: RecoveryStrategy, error_context: ErrorContext,
                               original_function: Callable, *args, **kwargs) -> RecoveryResult:
        """Retry operation with delay (exponential backoff if enabled)"""
        for attempt in range(strategy.max_attempts):
            try:
                if attempt > 0:
                    delay = strategy.delay_seconds
                    if strategy.exponential_backoff:
                        delay = strategy.delay_seconds * (2 ** (attempt - 1))
                    
                    await self._emit_recovery_event("retry_delay", {
                        "attempt": attempt + 1,
                        "delay_seconds": delay,
                        "strategy": "delay"
                    })
                    
                    await asyncio.sleep(delay)
                
                await self._emit_recovery_event("retry_attempt", {
                    "attempt": attempt + 1,
                    "max_attempts": strategy.max_attempts,
                    "strategy": "delay"
                })
                
                result = await original_function(*args, **kwargs)
                return RecoveryResult(
                    success=True,
                    error_context=error_context,
                    recovery_action=strategy.action,
                    attempts_made=attempt + 1,
                    total_time_spent=0,
                    recovered_data=result
                )
            except Exception as e:
                if attempt == strategy.max_attempts - 1:
                    return RecoveryResult(
                        success=False,
                        error_context=error_context,
                        recovery_action=strategy.action,
                        attempts_made=attempt + 1,
                        total_time_spent=0,
                        final_error=str(e)
                    )
                continue
    
    async def _retry_with_refresh(self, strategy: RecoveryStrategy, error_context: ErrorContext,
                                 original_function: Callable, *args, **kwargs) -> RecoveryResult:
        """Retry operation with page refresh"""
        if not self.browser_automation or not error_context.session_id:
            return await self._retry_with_delay(strategy, error_context, original_function, *args, **kwargs)
        
        for attempt in range(strategy.max_attempts):
            try:
                if attempt > 0:
                    await self._emit_recovery_event("page_refresh", {
                        "attempt": attempt + 1,
                        "session_id": error_context.session_id
                    })
                    
                    # Refresh page
                    page = self.browser_automation.pages.get(error_context.session_id)
                    if page:
                        await page.reload(wait_until="networkidle")
                        await asyncio.sleep(strategy.delay_seconds)
                
                result = await original_function(*args, **kwargs)
                return RecoveryResult(
                    success=True,
                    error_context=error_context,
                    recovery_action=strategy.action,
                    attempts_made=attempt + 1,
                    total_time_spent=0,
                    recovered_data=result
                )
            except Exception as e:
                if attempt == strategy.max_attempts - 1:
                    return RecoveryResult(
                        success=False,
                        error_context=error_context,
                        recovery_action=strategy.action,
                        attempts_made=attempt + 1,
                        total_time_spent=0,
                        final_error=str(e)
                    )
                continue
    
    async def _retry_with_new_session(self, strategy: RecoveryStrategy, error_context: ErrorContext,
                                     original_function: Callable, *args, **kwargs) -> RecoveryResult:
        """Retry operation with new browser session"""
        if not self.browser_automation:
            return await self._retry_with_delay(strategy, error_context, original_function, *args, **kwargs)
        
        original_session_id = error_context.session_id
        
        for attempt in range(strategy.max_attempts):
            try:
                await self._emit_recovery_event("new_session_creation", {
                    "attempt": attempt + 1,
                    "original_session": original_session_id
                })
                
                # Close old session
                if original_session_id:
                    await self.browser_automation.close_session(original_session_id)
                
                # Create new session
                new_session_id = f"recovery_{error_context.user_id}_{int(datetime.now().timestamp())}"
                session_created = await self.browser_automation.create_session(new_session_id)
                
                if session_created:
                    # Update context and kwargs with new session
                    if 'session_id' in kwargs:
                        kwargs['session_id'] = new_session_id
                    
                    await asyncio.sleep(strategy.delay_seconds)
                    
                    result = await original_function(*args, **kwargs)
                    return RecoveryResult(
                        success=True,
                        error_context=error_context,
                        recovery_action=strategy.action,
                        attempts_made=attempt + 1,
                        total_time_spent=0,
                        recovered_data=result,
                        next_action=f"New session created: {new_session_id}"
                    )
                
            except Exception as e:
                if attempt == strategy.max_attempts - 1:
                    return RecoveryResult(
                        success=False,
                        error_context=error_context,
                        recovery_action=strategy.action,
                        attempts_made=attempt + 1,
                        total_time_spent=0,
                        final_error=str(e)
                    )
                continue
    
    async def _retry_with_alternative(self, strategy: RecoveryStrategy, error_context: ErrorContext,
                                     original_function: Callable, *args, **kwargs) -> RecoveryResult:
        """Retry operation with alternative approach (fallback selectors, etc.)"""
        # This would implement alternative strategies like different CSS selectors
        # For now, fall back to delay retry
        await self._emit_recovery_event("alternative_strategy", {
            "error_type": error_context.error_type.value,
            "operation": error_context.operation_type
        })
        
        return await self._retry_with_delay(strategy, error_context, original_function, *args, **kwargs)
    
    async def _skip_and_continue(self, strategy: RecoveryStrategy, error_context: ErrorContext,
                                original_function: Callable, *args, **kwargs) -> RecoveryResult:
        """Skip current operation and continue"""
        await self._emit_recovery_event("operation_skipped", {
            "error_context": asdict(error_context),
            "reason": "Skip and continue strategy"
        })
        
        return RecoveryResult(
            success=True,  # Consider this successful for flow continuation
            error_context=error_context,
            recovery_action=strategy.action,
            attempts_made=1,
            total_time_spent=0,
            next_action="Operation skipped, continuing with next item"
        )
    
    async def _abort_operation(self, strategy: RecoveryStrategy, error_context: ErrorContext,
                              original_function: Callable, *args, **kwargs) -> RecoveryResult:
        """Abort the entire operation"""
        await self._emit_recovery_event("operation_aborted", {
            "error_context": asdict(error_context),
            "reason": "Abort operation strategy"
        })
        
        return RecoveryResult(
            success=False,
            error_context=error_context,
            recovery_action=strategy.action,
            attempts_made=1,
            total_time_spent=0,
            final_error="Operation aborted by recovery strategy",
            next_action="Operation aborted, manual intervention required"
        )
    
    async def _escalate_to_manual(self, strategy: RecoveryStrategy, error_context: ErrorContext,
                                 original_function: Callable, *args, **kwargs) -> RecoveryResult:
        """Escalate to manual intervention"""
        await self._emit_recovery_event("manual_escalation", {
            "error_context": asdict(error_context),
            "reason": "Automatic recovery failed, manual intervention required"
        })
        
        return RecoveryResult(
            success=False,
            error_context=error_context,
            recovery_action=strategy.action,
            attempts_made=1,
            total_time_spent=0,
            final_error="Escalated to manual intervention",
            next_action="Manual intervention required"
        )
    
    def _update_recovery_statistics(self, error_type: ErrorType, recovery_action: RecoveryAction, success: bool):
        """Update recovery statistics for analysis"""
        key = f"{error_type.value}_{recovery_action.value}"
        if key not in self.recovery_statistics:
            self.recovery_statistics[key] = {
                "total_attempts": 0,
                "successful_recoveries": 0,
                "failed_recoveries": 0,
                "success_rate": 0.0
            }
        
        stats = self.recovery_statistics[key]
        stats["total_attempts"] += 1
        
        if success:
            stats["successful_recoveries"] += 1
        else:
            stats["failed_recoveries"] += 1
        
        stats["success_rate"] = stats["successful_recoveries"] / stats["total_attempts"]
    
    def get_recovery_statistics(self) -> Dict[str, Any]:
        """Get recovery statistics for monitoring"""
        return {
            "statistics": self.recovery_statistics,
            "error_history_count": len(self.error_history),
            "circuit_breaker_states": self.strategy_manager.circuit_breaker_state,
            "recent_errors": [asdict(err) for err in self.error_history[-10:]]
        }

# Global error recovery service
error_recovery_service = ErrorRecoveryService()

# Decorator for automatic error recovery
def with_error_recovery(operation_type: str = "unknown"):
    """Decorator to add automatic error recovery to functions"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                # Extract context from kwargs or create minimal context
                operation_context = {
                    "operation_type": operation_type,
                    "session_id": kwargs.get("session_id"),
                    "user_id": kwargs.get("user_id"),
                    "work_order_id": kwargs.get("work_order_id"),
                    "attempt_number": kwargs.get("attempt_number", 1)
                }
                
                recovery_result = await error_recovery_service.handle_error(
                    e, operation_context, func, *args, **kwargs
                )
                
                if recovery_result.success:
                    return recovery_result.recovered_data
                else:
                    # Re-raise original error if recovery failed
                    raise e
        
        return wrapper
    return decorator

# Testing function
async def test_error_recovery():
    """Test error recovery system"""
    print("🔄 Testing error recovery system...")
    
    try:
        # Test error classification
        classifier = ErrorClassifier()
        
        test_errors = [
            ("Connection timeout", ErrorType.TIMEOUT_ERROR),
            ("Element not found", ErrorType.ELEMENT_NOT_FOUND),
            ("Network error occurred", ErrorType.NETWORK_ERROR),
            ("Authentication failed", ErrorType.AUTHENTICATION_ERROR)
        ]
        
        for error_msg, expected_type in test_errors:
            classified = classifier.classify_error(error_msg)
            assert classified == expected_type, f"Expected {expected_type}, got {classified}"
        
        print("✅ Error classification working correctly")
        
        # Test strategy manager
        strategy_manager = RetryStrategyManager()
        network_strategy = strategy_manager.get_strategy(ErrorType.NETWORK_ERROR, ErrorContext(
            error_id="test",
            error_type=ErrorType.NETWORK_ERROR,
            error_message="test",
            stack_trace="test",
            operation_type="test"
        ))
        
        assert network_strategy.action == RecoveryAction.RETRY_WITH_DELAY
        print("✅ Strategy manager working correctly")
        
        # Test recovery service
        recovery_service = ErrorRecoveryService()
        assert len(recovery_service.recovery_functions) == 8
        print("✅ Recovery service initialized correctly")
        
        print("🎉 Error recovery system tests completed successfully!")
        print("📋 Features implemented:")
        print("   ✅ Intelligent error classification")
        print("   ✅ Adaptive retry strategies")
        print("   ✅ Circuit breaker pattern")
        print("   ✅ Exponential backoff")
        print("   ✅ Recovery action registry")
        print("   ✅ Statistics and monitoring")
        
        return True
        
    except Exception as e:
        print(f"❌ Error recovery test failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_error_recovery())