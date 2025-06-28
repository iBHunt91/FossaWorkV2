"""
Custom Exception Classes for FossaWork V2
Specific exceptions to replace generic Exception handling throughout the codebase.
"""

from fastapi import HTTPException


class FossaWorkException(Exception):
    """Base exception for all FossaWork-specific errors"""
    def __init__(self, message: str, error_code: str = None):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


# Authentication and Authorization Exceptions
class AuthenticationError(FossaWorkException):
    """Raised when authentication fails"""
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, "AUTH_FAILED")


class WorkFossaAuthenticationError(AuthenticationError):
    """Raised when WorkFossa authentication specifically fails"""
    def __init__(self, message: str = "WorkFossa authentication failed"):
        super().__init__(message, "WORKFOSSA_AUTH_FAILED")


class TokenExpiredError(AuthenticationError):
    """Raised when JWT token has expired"""
    def __init__(self, message: str = "Token has expired"):
        super().__init__(message, "TOKEN_EXPIRED")


class InvalidCredentialsError(AuthenticationError):
    """Raised when provided credentials are invalid"""
    def __init__(self, message: str = "Invalid credentials"):
        super().__init__(message, "INVALID_CREDENTIALS")


class UnauthorizedError(FossaWorkException):
    """Raised when user lacks permission for operation"""
    def __init__(self, message: str = "Unauthorized access"):
        super().__init__(message, "UNAUTHORIZED")


# Database Exceptions
class DatabaseError(FossaWorkException):
    """Base class for database-related errors"""
    def __init__(self, message: str, operation: str = None):
        self.operation = operation
        super().__init__(message, "DATABASE_ERROR")


class RecordNotFoundError(DatabaseError):
    """Raised when a database record is not found"""
    def __init__(self, entity: str, identifier: str):
        message = f"{entity} with ID '{identifier}' not found"
        super().__init__(message, "RECORD_NOT_FOUND")
        self.entity = entity
        self.identifier = identifier


class DatabaseConnectionError(DatabaseError):
    """Raised when database connection fails"""
    def __init__(self, message: str = "Database connection failed"):
        super().__init__(message, "DATABASE_CONNECTION_FAILED")


class ConstraintViolationError(DatabaseError):
    """Raised when database constraint is violated"""
    def __init__(self, constraint: str, message: str = None):
        if not message:
            message = f"Database constraint violation: {constraint}"
        super().__init__(message, "CONSTRAINT_VIOLATION")
        self.constraint = constraint


# Automation and Browser Exceptions
class BrowserError(FossaWorkException):
    """Base class for browser automation errors"""
    def __init__(self, message: str, session_id: str = None):
        self.session_id = session_id
        super().__init__(message, "BROWSER_ERROR")


class BrowserInitializationError(BrowserError):
    """Raised when browser initialization fails"""
    def __init__(self, message: str = "Failed to initialize browser"):
        super().__init__(message, "BROWSER_INIT_FAILED")


class PageLoadError(BrowserError):
    """Raised when page fails to load"""
    def __init__(self, url: str, message: str = None):
        if not message:
            message = f"Failed to load page: {url}"
        super().__init__(message, "PAGE_LOAD_FAILED")
        self.url = url


class ElementNotFoundError(BrowserError):
    """Raised when an element cannot be found on the page"""
    def __init__(self, selector: str, page_url: str = None):
        message = f"Element not found with selector: {selector}"
        if page_url:
            message += f" on page: {page_url}"
        super().__init__(message, "ELEMENT_NOT_FOUND")
        self.selector = selector
        self.page_url = page_url


class FormSubmissionError(BrowserError):
    """Raised when form submission fails"""
    def __init__(self, form_type: str, message: str = None):
        if not message:
            message = f"Form submission failed for: {form_type}"
        super().__init__(message, "FORM_SUBMISSION_FAILED")
        self.form_type = form_type


# Scraping Exceptions
class ScrapingError(FossaWorkException):
    """Base class for web scraping errors"""
    def __init__(self, message: str, url: str = None):
        self.url = url
        super().__init__(message, "SCRAPING_ERROR")


class DataExtractionError(ScrapingError):
    """Raised when data extraction from page fails"""
    def __init__(self, data_type: str, url: str = None, message: str = None):
        if not message:
            message = f"Failed to extract {data_type} data"
        super().__init__(message, url)
        self.error_code = "DATA_EXTRACTION_FAILED"
        self.data_type = data_type


class WorkOrderExtractionError(DataExtractionError):
    """Raised when work order extraction fails"""
    def __init__(self, message: str = "Failed to extract work order data"):
        super().__init__("work_order", None, message)


class DispenserExtractionError(DataExtractionError):
    """Raised when dispenser extraction fails"""
    def __init__(self, message: str = "Failed to extract dispenser data"):
        super().__init__("dispenser", None, message)


# Validation Exceptions
class ValidationError(FossaWorkException):
    """Raised when input validation fails"""
    def __init__(self, field: str, value: str, message: str = None):
        if not message:
            message = f"Validation failed for field '{field}' with value '{value}'"
        super().__init__(message, "VALIDATION_ERROR")
        self.field = field
        self.value = value


class ConfigurationError(FossaWorkException):
    """Raised when configuration is invalid or missing"""
    def __init__(self, setting: str, message: str = None):
        if not message:
            message = f"Configuration error for setting: {setting}"
        super().__init__(message, "CONFIGURATION_ERROR")
        self.setting = setting


# Business Logic Exceptions
class WorkOrderError(FossaWorkException):
    """Base class for work order related errors"""
    def __init__(self, message: str, work_order_id: str = None):
        self.work_order_id = work_order_id
        super().__init__(message, "WORK_ORDER_ERROR")


class WorkOrderNotFoundError(WorkOrderError):
    """Raised when work order is not found"""
    def __init__(self, work_order_id: str):
        message = f"Work order not found: {work_order_id}"
        super().__init__(message, work_order_id)
        self.error_code = "WORK_ORDER_NOT_FOUND"


class WorkOrderProcessingError(WorkOrderError):
    """Raised when work order processing fails"""
    def __init__(self, work_order_id: str, operation: str, message: str = None):
        if not message:
            message = f"Work order processing failed: {operation}"
        super().__init__(message, work_order_id)
        self.error_code = "WORK_ORDER_PROCESSING_FAILED"
        self.operation = operation


# Notification Exceptions
class NotificationError(FossaWorkException):
    """Base class for notification errors"""
    def __init__(self, message: str, notification_type: str = None):
        self.notification_type = notification_type
        super().__init__(message, "NOTIFICATION_ERROR")


class EmailNotificationError(NotificationError):
    """Raised when email notification fails"""
    def __init__(self, message: str = "Email notification failed"):
        super().__init__(message, "email")


# Removed PushoverNotificationError - Pushover service no longer supported


class DesktopNotificationError(NotificationError):
    """Raised when desktop notification fails"""
    def __init__(self, message: str = "Desktop notification failed"):
        super().__init__(message, "desktop")


# External Service Exceptions
class ExternalServiceError(FossaWorkException):
    """Base class for external service errors"""
    def __init__(self, service: str, message: str, status_code: int = None):
        self.service = service
        self.status_code = status_code
        super().__init__(message, "EXTERNAL_SERVICE_ERROR")


class WorkFossaServiceError(ExternalServiceError):
    """Raised when WorkFossa service calls fail"""
    def __init__(self, message: str, status_code: int = None):
        super().__init__("workfossa", message, status_code)


# Utility functions for converting to HTTP exceptions
def to_http_exception(exception: FossaWorkException) -> HTTPException:
    """Convert custom exception to FastAPI HTTPException"""
    status_mapping = {
        "AUTH_FAILED": 401,
        "WORKFOSSA_AUTH_FAILED": 401,
        "TOKEN_EXPIRED": 401,
        "INVALID_CREDENTIALS": 401,
        "UNAUTHORIZED": 403,
        "RECORD_NOT_FOUND": 404,
        "WORK_ORDER_NOT_FOUND": 404,
        "VALIDATION_ERROR": 400,
        "CONFIGURATION_ERROR": 400,
        "DATABASE_CONNECTION_FAILED": 503,
        "BROWSER_INIT_FAILED": 503,
        "PAGE_LOAD_FAILED": 502,
        "EXTERNAL_SERVICE_ERROR": 502,
    }
    
    status_code = status_mapping.get(exception.error_code, 500)
    
    return HTTPException(
        status_code=status_code,
        detail={
            "error": exception.error_code or "INTERNAL_ERROR",
            "message": exception.message,
            "type": type(exception).__name__
        }
    )


# Decorator for automatic exception conversion
def handle_exceptions(func):
    """Decorator to automatically convert custom exceptions to HTTP exceptions"""
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except FossaWorkException as e:
            raise to_http_exception(e)
        except Exception as e:
            # Log unexpected exceptions but don't expose details to client
            import logging
            logger = logging.getLogger(__name__)
            logger.exception(f"Unexpected error in {func.__name__}: {e}")
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "INTERNAL_ERROR",
                    "message": "An unexpected error occurred",
                    "type": "InternalError"
                }
            )
    return wrapper