# Secure Coding Guide for FossaWork V2
*Development Team Security Training*

## Overview
This guide provides specific secure coding practices for FossaWork V2 development, focusing on our Python/FastAPI backend and React/TypeScript frontend architecture.

## Table of Contents
1. [Input Validation](#input-validation)
2. [Authentication & Authorization](#authentication--authorization)
3. [Database Security](#database-security)
4. [API Security](#api-security)
5. [Frontend Security](#frontend-security)
6. [Error Handling](#error-handling)
7. [Logging Security](#logging-security)
8. [File Handling](#file-handling)
9. [Dependency Management](#dependency-management)
10. [Code Review Checklist](#code-review-checklist)

## Input Validation

### Backend Validation (Python/FastAPI)

#### Pydantic Models for Validation
```python
from pydantic import BaseModel, validator, Field
from typing import Optional
import re

class WorkOrderCreate(BaseModel):
    store_number: str = Field(..., regex=r'^\d{4}$', description="4-digit store number")
    customer_name: str = Field(..., min_length=1, max_length=100)
    service_code: int = Field(..., ge=2000, le=9999)
    instructions: Optional[str] = Field(None, max_length=1000)
    
    @validator('customer_name')
    def validate_customer_name(cls, v):
        # Remove potentially dangerous characters
        cleaned = re.sub(r'[<>"\';\\]', '', v.strip())
        if not cleaned:
            raise ValueError('Customer name cannot be empty after sanitization')
        return cleaned
    
    @validator('service_code')
    def validate_service_code(cls, v):
        valid_codes = [2861, 2862, 3002, 3146]
        if v not in valid_codes:
            raise ValueError(f'Service code must be one of: {valid_codes}')
        return v

# Usage in endpoint
@app.post("/api/work-orders/")
async def create_work_order(
    work_order: WorkOrderCreate,
    current_user: User = Depends(get_current_user)
):
    # Pydantic automatically validates the input
    return await create_work_order_service(work_order, current_user.id)
```

#### Custom Validation Functions
```python
import re
from typing import Any, Optional

def validate_email(email: str) -> str:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        raise ValueError("Invalid email format")
    return email.lower().strip()

def validate_phone(phone: str) -> str:
    """Validate phone number format"""
    # Remove all non-digits
    digits_only = re.sub(r'[^\d]', '', phone)
    if len(digits_only) != 10:
        raise ValueError("Phone number must be exactly 10 digits")
    return digits_only

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent path traversal"""
    # Remove path separators and dangerous characters
    sanitized = re.sub(r'[<>:"/\\|?*]', '', filename)
    sanitized = sanitized.replace('..', '')
    if not sanitized or sanitized.startswith('.'):
        raise ValueError("Invalid filename")
    return sanitized[:255]  # Limit length

def validate_user_id(user_id: Any) -> int:
    """Validate user ID format"""
    try:
        uid = int(user_id)
        if uid <= 0:
            raise ValueError("User ID must be positive")
        return uid
    except (ValueError, TypeError):
        raise ValueError("Invalid user ID format")
```

### Frontend Validation (React/TypeScript)

#### Form Validation
```typescript
// types/validation.ts
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export const validateWorkOrder = (data: any): ValidationResult => {
  const errors: string[] = [];
  
  // Store number validation
  if (!data.storeNumber || !/^\d{4}$/.test(data.storeNumber)) {
    errors.push('Store number must be exactly 4 digits');
  }
  
  // Customer name validation
  if (!data.customerName || data.customerName.trim().length === 0) {
    errors.push('Customer name is required');
  } else if (data.customerName.length > 100) {
    errors.push('Customer name must be less than 100 characters');
  }
  
  // Service code validation
  const validCodes = [2861, 2862, 3002, 3146];
  if (!validCodes.includes(data.serviceCode)) {
    errors.push('Invalid service code');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Component usage
const WorkOrderForm: React.FC = () => {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState<string[]>([]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validation
    const validation = validateWorkOrder(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }
    
    try {
      // API call with validated data
      await apiClient.post('/api/work-orders/', formData);
    } catch (error) {
      // Handle server validation errors
      if (error.response?.data?.detail) {
        setErrors([error.response.data.detail]);
      }
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {errors.length > 0 && (
        <div className="error-messages">
          {errors.map(error => (
            <div key={error} className="error">{error}</div>
          ))}
        </div>
      )}
      {/* Form fields */}
    </form>
  );
};
```

## Authentication & Authorization

### JWT Token Management

#### Backend Token Creation
```python
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

SECRET_KEY = os.getenv("SECRET_KEY")  # Must be in environment
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        
        if username is None or user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        return TokenData(username=username, user_id=user_id)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(token: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token_data = verify_token(token.credentials)
    user = await get_user_by_id(token_data.user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user
```

#### Frontend Token Management
```typescript
// services/auth.ts
class AuthService {
  private static TOKEN_KEY = 'fossa_access_token';
  
  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }
  
  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }
  
  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }
  
  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= exp;
    } catch {
      return true; // If we can't parse, assume expired
    }
  }
  
  static async refreshTokenIfNeeded(): Promise<string | null> {
    const token = this.getToken();
    if (!token) return null;
    
    // Refresh if token expires in less than 5 minutes
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    const fiveMinutes = 5 * 60 * 1000;
    
    if (Date.now() > (exp - fiveMinutes)) {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          this.setToken(data.access_token);
          return data.access_token;
        } else {
          this.removeToken();
          return null;
        }
      } catch {
        this.removeToken();
        return null;
      }
    }
    
    return token;
  }
}

// API client with automatic token refresh
const apiClient = axios.create({
  baseURL: '/api'
});

apiClient.interceptors.request.use(async (config) => {
  const token = await AuthService.refreshTokenIfNeeded();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      AuthService.removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Authorization Patterns

#### Role-Based Access Control
```python
from enum import Enum
from functools import wraps

class UserRole(Enum):
    ADMIN = "admin"
    TECHNICIAN = "technician"
    VIEWER = "viewer"

def require_role(required_role: UserRole):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(status_code=401, detail="Authentication required")
            
            if current_user.role != required_role.value and current_user.role != UserRole.ADMIN.value:
                raise HTTPException(status_code=403, detail="Insufficient permissions")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Usage
@app.delete("/api/work-orders/{order_id}")
@require_role(UserRole.ADMIN)
async def delete_work_order(
    order_id: int,
    current_user: User = Depends(get_current_user)
):
    return await delete_work_order_service(order_id)
```

#### Resource-Based Authorization
```python
async def check_work_order_access(order_id: int, user: User) -> bool:
    """Check if user can access specific work order"""
    work_order = await get_work_order(order_id)
    
    if not work_order:
        return False
    
    # Admin can access all
    if user.role == UserRole.ADMIN.value:
        return True
    
    # User can only access their own work orders
    return work_order.user_id == user.id

@app.get("/api/work-orders/{order_id}")
async def get_work_order(
    order_id: int,
    current_user: User = Depends(get_current_user)
):
    if not await check_work_order_access(order_id, current_user):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return await get_work_order_service(order_id)
```

## Database Security

### Parameterized Queries with SQLAlchemy
```python
from sqlalchemy import text
from sqlalchemy.orm import Session

# ❌ NEVER do this - SQL injection vulnerable
def get_user_bad(db: Session, username: str):
    query = f"SELECT * FROM users WHERE username = '{username}'"
    return db.execute(query).fetchone()

# ✅ Use SQLAlchemy ORM (preferred)
def get_user_orm(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

# ✅ Use parameterized queries with text()
def get_user_param(db: Session, username: str):
    query = text("SELECT * FROM users WHERE username = :username")
    return db.execute(query, {"username": username}).fetchone()

# ✅ Complex query example
def search_work_orders(db: Session, user_id: int, filters: dict):
    query = db.query(WorkOrder).filter(WorkOrder.user_id == user_id)
    
    if filters.get('store_number'):
        query = query.filter(WorkOrder.store_number == filters['store_number'])
    
    if filters.get('service_code'):
        query = query.filter(WorkOrder.service_code == filters['service_code'])
    
    if filters.get('date_from'):
        query = query.filter(WorkOrder.created_date >= filters['date_from'])
    
    return query.all()
```

### Database Connection Security
```python
import os
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

def create_secure_engine():
    # Use environment variables for connection
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not set")
    
    # Connection pooling with limits
    engine = create_engine(
        database_url,
        poolclass=QueuePool,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,  # Validate connections
        pool_recycle=3600,   # Recycle connections every hour
        echo=False           # Never log SQL in production
    )
    
    return engine

# Database session management
from contextlib import contextmanager

@contextmanager
def get_db_session():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
```

## API Security

### Rate Limiting
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply rate limiting to endpoints
@app.post("/api/auth/login")
@limiter.limit("5/minute")  # 5 attempts per minute
async def login(request: Request, credentials: LoginCredentials):
    return await authenticate_user(credentials)

@app.post("/api/work-orders/")
@limiter.limit("100/hour")  # 100 work orders per hour
async def create_work_order(
    request: Request,
    work_order: WorkOrderCreate,
    current_user: User = Depends(get_current_user)
):
    return await create_work_order_service(work_order, current_user.id)
```

### CORS Configuration
```python
from fastapi.middleware.cors import CORSMiddleware

# ❌ NEVER do this in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Too permissive!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Secure CORS configuration
allowed_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
if not allowed_origins or allowed_origins == [""]:
    allowed_origins = ["http://localhost:3000"]  # Default for development

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Total-Count"]
)
```

### Request/Response Security Headers
```python
from fastapi import Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Remove server information
        response.headers.pop("Server", None)
        
        return response

app.add_middleware(SecurityHeadersMiddleware)
```

## Frontend Security

### XSS Prevention
```typescript
// utils/sanitization.ts
import DOMPurify from 'dompurify';

export const sanitizeHtml = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href', 'title']
  });
};

export const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Component example
const WorkOrderDetails: React.FC<{ workOrder: WorkOrder }> = ({ workOrder }) => {
  // ❌ NEVER do this - XSS vulnerable
  const dangerousHTML = { __html: workOrder.instructions };
  
  // ✅ Safe HTML rendering
  const safeHTML = { __html: sanitizeHtml(workOrder.instructions) };
  
  return (
    <div>
      <h3>{escapeHtml(workOrder.customerName)}</h3>
      <div dangerouslySetInnerHTML={safeHTML} />
    </div>
  );
};
```

### Content Security Policy
```typescript
// public/index.html - Add CSP meta tag
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: https:; 
               connect-src 'self' https://api.workfossa.com;">
```

### Secure Local Storage
```typescript
// utils/secureStorage.ts
class SecureStorage {
  private static encrypt(data: string): string {
    // Simple encryption for sensitive data
    // In production, use proper encryption library
    return btoa(data);
  }
  
  private static decrypt(encrypted: string): string {
    try {
      return atob(encrypted);
    } catch {
      throw new Error('Failed to decrypt data');
    }
  }
  
  static setSecureItem(key: string, value: string): void {
    const encrypted = this.encrypt(value);
    localStorage.setItem(key, encrypted);
  }
  
  static getSecureItem(key: string): string | null {
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;
    
    try {
      return this.decrypt(encrypted);
    } catch {
      localStorage.removeItem(key); // Remove corrupted data
      return null;
    }
  }
  
  static removeSecureItem(key: string): void {
    localStorage.removeItem(key);
  }
}

// Usage
SecureStorage.setSecureItem('user_preferences', JSON.stringify(preferences));
const prefs = SecureStorage.getSecureItem('user_preferences');
```

## Error Handling

### Secure Error Messages
```python
from enum import Enum
import logging

class ErrorCode(Enum):
    AUTHENTICATION_FAILED = "AUTH_001"
    AUTHORIZATION_FAILED = "AUTH_002"
    VALIDATION_ERROR = "VAL_001"
    RESOURCE_NOT_FOUND = "RES_001"
    INTERNAL_ERROR = "INT_001"

class APIError(Exception):
    def __init__(self, code: ErrorCode, message: str, details: dict = None):
        self.code = code
        self.message = message
        self.details = details or {}

def create_error_response(error: APIError, request_id: str = None):
    """Create standardized error response"""
    response = {
        "success": False,
        "error": {
            "code": error.code.value,
            "message": error.message,
            "timestamp": datetime.utcnow().isoformat()
        }
    }
    
    if request_id:
        response["error"]["request_id"] = request_id
    
    # Only include details in development
    if os.getenv("ENVIRONMENT") == "development" and error.details:
        response["error"]["details"] = error.details
    
    return response

# Exception handler
@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    request_id = str(uuid.uuid4())
    
    # Log error details (but not sensitive data)
    logging.error(
        f"API Error {request_id}: {exc.code.value} - {exc.message}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "error_code": exc.code.value
        }
    )
    
    status_code = 500
    if exc.code in [ErrorCode.AUTHENTICATION_FAILED]:
        status_code = 401
    elif exc.code in [ErrorCode.AUTHORIZATION_FAILED]:
        status_code = 403
    elif exc.code in [ErrorCode.VALIDATION_ERROR, ErrorCode.RESOURCE_NOT_FOUND]:
        status_code = 400
    
    return JSONResponse(
        status_code=status_code,
        content=create_error_response(exc, request_id)
    )

# Usage in endpoints
@app.post("/api/work-orders/")
async def create_work_order(work_order: WorkOrderCreate):
    try:
        return await create_work_order_service(work_order)
    except ValidationError as e:
        raise APIError(ErrorCode.VALIDATION_ERROR, "Invalid work order data", {"field_errors": e.errors()})
    except PermissionError:
        raise APIError(ErrorCode.AUTHORIZATION_FAILED, "Access denied")
    except Exception as e:
        # Log the actual error for debugging
        logging.exception("Unexpected error creating work order")
        raise APIError(ErrorCode.INTERNAL_ERROR, "Failed to create work order")
```

### Frontend Error Handling
```typescript
// types/api.ts
interface APIError {
  code: string;
  message: string;
  timestamp: string;
  request_id?: string;
  details?: any;
}

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
}

// services/errorHandler.ts
class ErrorHandler {
  static handle(error: any): string {
    if (error.response?.data?.error) {
      const apiError = error.response.data.error as APIError;
      
      // Map error codes to user-friendly messages
      switch (apiError.code) {
        case 'AUTH_001':
          return 'Invalid username or password';
        case 'AUTH_002':
          return 'You do not have permission to perform this action';
        case 'VAL_001':
          return 'Please check your input and try again';
        case 'RES_001':
          return 'The requested resource was not found';
        default:
          return 'An unexpected error occurred. Please try again.';
      }
    }
    
    // Network errors
    if (error.code === 'NETWORK_ERROR') {
      return 'Network connection failed. Please check your internet connection.';
    }
    
    return 'An unexpected error occurred. Please try again.';
  }
  
  static logError(error: any, context: string): void {
    console.error(`Error in ${context}:`, {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      timestamp: new Date().toISOString()
    });
    
    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Sentry, LogRocket, etc.
    }
  }
}
```

## Logging Security

### Secure Logging Practices
```python
import logging
import json
from datetime import datetime
from typing import Any, Dict

class SecurityLoggingFormatter(logging.Formatter):
    """Custom formatter that sanitizes sensitive data"""
    
    SENSITIVE_FIELDS = {
        'password', 'token', 'secret', 'key', 'auth', 'credential',
        'ssn', 'social', 'credit_card', 'cc_number'
    }
    
    def format(self, record: logging.LogRecord) -> str:
        # Sanitize the message
        if hasattr(record, 'msg') and isinstance(record.msg, dict):
            record.msg = self.sanitize_dict(record.msg)
        elif hasattr(record, 'msg') and isinstance(record.msg, str):
            record.msg = self.sanitize_string(record.msg)
        
        return super().format(record)
    
    def sanitize_dict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Remove or mask sensitive data from dictionary"""
        sanitized = {}
        for key, value in data.items():
            if any(sensitive in key.lower() for sensitive in self.SENSITIVE_FIELDS):
                sanitized[key] = "***REDACTED***"
            elif isinstance(value, dict):
                sanitized[key] = self.sanitize_dict(value)
            elif isinstance(value, list):
                sanitized[key] = [self.sanitize_dict(item) if isinstance(item, dict) else item for item in value]
            else:
                sanitized[key] = value
        return sanitized
    
    def sanitize_string(self, message: str) -> str:
        """Remove sensitive patterns from string"""
        import re
        # Mask potential passwords, tokens, etc.
        patterns = [
            (r'password["\s]*[:=]["\s]*[^"\s,}]+', 'password="***REDACTED***"'),
            (r'token["\s]*[:=]["\s]*[^"\s,}]+', 'token="***REDACTED***"'),
            (r'Bearer\s+[A-Za-z0-9\-_.~+/]+=*', 'Bearer ***REDACTED***'),
        ]
        
        for pattern, replacement in patterns:
            message = re.sub(pattern, replacement, message, flags=re.IGNORECASE)
        
        return message

# Configure secure logging
def configure_logging():
    # Create custom logger
    logger = logging.getLogger("fossa_security")
    logger.setLevel(logging.INFO)
    
    # File handler with secure formatter
    file_handler = logging.FileHandler("logs/security.log")
    file_handler.setFormatter(SecurityLoggingFormatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    
    # Console handler (development only)
    if os.getenv("ENVIRONMENT") == "development":
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(SecurityLoggingFormatter(
            '%(levelname)s - %(message)s'
        ))
        logger.addHandler(console_handler)
    
    logger.addHandler(file_handler)
    return logger

# Security event logging
security_logger = configure_logging()

def log_security_event(event_type: str, user_id: int = None, details: Dict = None):
    """Log security-related events"""
    event_data = {
        "event_type": event_type,
        "timestamp": datetime.utcnow().isoformat(),
        "user_id": user_id,
        "details": details or {}
    }
    
    security_logger.info(json.dumps(event_data))

# Usage examples
log_security_event("login_attempt", user_id=123, details={"success": True, "ip": "192.168.1.1"})
log_security_event("permission_denied", user_id=456, details={"resource": "/api/admin/users", "action": "DELETE"})
log_security_event("data_export", user_id=789, details={"table": "work_orders", "record_count": 150})
```

## File Handling

### Secure File Operations
```python
import os
import tempfile
from pathlib import Path
from typing import BinaryIO
import magic  # python-magic for file type detection

class SecureFileHandler:
    ALLOWED_EXTENSIONS = {'.txt', '.csv', '.json', '.xlsx', '.pdf', '.png', '.jpg', '.jpeg'}
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    @staticmethod
    def validate_file(file: BinaryIO, filename: str) -> bool:
        """Validate uploaded file"""
        # Check file extension
        file_ext = Path(filename).suffix.lower()
        if file_ext not in SecureFileHandler.ALLOWED_EXTENSIONS:
            raise ValueError(f"File type {file_ext} not allowed")
        
        # Check file size
        file.seek(0, 2)  # Seek to end
        file_size = file.tell()
        file.seek(0)  # Reset to beginning
        
        if file_size > SecureFileHandler.MAX_FILE_SIZE:
            raise ValueError("File too large")
        
        # Check MIME type
        file_content = file.read(1024)
        file.seek(0)
        
        mime_type = magic.from_buffer(file_content, mime=True)
        allowed_mimes = {
            '.txt': 'text/plain',
            '.csv': 'text/csv',
            '.json': 'application/json',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.pdf': 'application/pdf',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg'
        }
        
        if mime_type not in allowed_mimes.values():
            raise ValueError("Invalid file content")
        
        return True
    
    @staticmethod
    def secure_filename(filename: str) -> str:
        """Generate secure filename"""
        # Remove directory path
        filename = os.path.basename(filename)
        
        # Remove dangerous characters
        import re
        filename = re.sub(r'[^a-zA-Z0-9._-]', '', filename)
        
        # Ensure it's not empty and doesn't start with dot
        if not filename or filename.startswith('.'):
            filename = f"file_{int(time.time())}"
        
        return filename
    
    @staticmethod
    def save_upload(file: BinaryIO, filename: str, user_id: int) -> str:
        """Securely save uploaded file"""
        # Validate file
        SecureFileHandler.validate_file(file, filename)
        
        # Create secure filename
        secure_name = SecureFileHandler.secure_filename(filename)
        
        # Create user-specific directory
        user_dir = Path(f"data/users/{user_id}/uploads")
        user_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename to prevent overwrites
        timestamp = int(time.time())
        final_path = user_dir / f"{timestamp}_{secure_name}"
        
        # Save file
        with open(final_path, 'wb') as f:
            content = file.read()
            f.write(content)
        
        # Set secure permissions (Unix-like systems)
        if hasattr(os, 'chmod'):
            os.chmod(final_path, 0o600)  # Read/write for owner only
        
        return str(final_path)

# FastAPI endpoint example
@app.post("/api/upload/")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    try:
        file_path = SecureFileHandler.save_upload(file.file, file.filename, current_user.id)
        
        log_security_event("file_upload", 
                         user_id=current_user.id, 
                         details={"filename": file.filename, "size": file.size})
        
        return {"success": True, "file_path": file_path}
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logging.exception("File upload failed")
        raise HTTPException(status_code=500, detail="Upload failed")
```

## Dependency Management

### Security Scanning
```python
# requirements-security.txt - Add security tools
bandit==1.7.5         # Security linter
safety==2.3.4         # Vulnerability scanner
pip-audit==2.6.1      # Audit pip packages

# Pre-commit hook for security scanning
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/PyCQA/bandit
    rev: 1.7.5
    hooks:
      - id: bandit
        args: ['-r', 'backend/']
        
  - repo: https://github.com/pyupio/safety
    rev: 2.3.4
    hooks:
      - id: safety
```

### Package Verification
```bash
#!/bin/bash
# scripts/security-check.sh

echo "Running security checks..."

# Check for vulnerabilities in Python packages
echo "Checking Python dependencies..."
pip-audit --requirement backend/requirements.txt

# Check for vulnerabilities in npm packages
echo "Checking JavaScript dependencies..."
npm audit --audit-level moderate

# Run bandit security scanner
echo "Running security linter..."
bandit -r backend/ -f json -o security-report.json

# Check for secrets in code
echo "Scanning for secrets..."
git secrets --scan

echo "Security check complete!"
```

## Code Review Checklist

### Security Review Template
```markdown
## Security Code Review Checklist

### Authentication & Authorization
- [ ] All sensitive endpoints require authentication
- [ ] User permissions are verified before actions
- [ ] JWT tokens are properly validated
- [ ] Session management is secure

### Input Validation
- [ ] All user inputs are validated on both frontend and backend
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (input sanitization)
- [ ] File upload restrictions are enforced

### Data Protection
- [ ] Sensitive data is not logged
- [ ] Passwords are properly hashed
- [ ] Personal data access is controlled
- [ ] Data transmission uses HTTPS

### Error Handling
- [ ] Error messages don't reveal sensitive information
- [ ] Exceptions are caught and handled appropriately
- [ ] Security events are logged properly

### Dependencies
- [ ] No known vulnerabilities in dependencies
- [ ] Unnecessary packages are removed
- [ ] Versions are pinned for security

### Configuration
- [ ] No hardcoded secrets or credentials
- [ ] Environment variables are used for configuration
- [ ] Security headers are configured
- [ ] CORS is properly restricted

### Business Logic
- [ ] Access control logic is sound
- [ ] Race conditions are considered
- [ ] Business rules are enforced securely

### Testing
- [ ] Security tests are included
- [ ] Edge cases are covered
- [ ] Authentication bypass attempts are tested
```

### Automated Security Checks
```python
# tests/security/test_security.py
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

class TestSecurity:
    def test_sql_injection_protection(self):
        """Test SQL injection protection"""
        malicious_input = "'; DROP TABLE users; --"
        response = client.post("/api/work-orders/", json={
            "store_number": malicious_input,
            "customer_name": "Test",
            "service_code": 2861
        })
        # Should fail validation, not execute SQL
        assert response.status_code == 422
    
    def test_xss_protection(self):
        """Test XSS protection"""
        xss_payload = "<script>alert('xss')</script>"
        response = client.post("/api/work-orders/", json={
            "store_number": "1234",
            "customer_name": xss_payload,
            "service_code": 2861
        })
        # Should sanitize input
        assert "<script>" not in response.json().get("customer_name", "")
    
    def test_authentication_required(self):
        """Test that sensitive endpoints require authentication"""
        response = client.get("/api/work-orders/")
        assert response.status_code == 401
    
    def test_authorization_enforced(self):
        """Test that users can only access their own data"""
        # Create two users and test cross-access
        pass  # Implement based on your auth system
    
    def test_file_upload_restrictions(self):
        """Test file upload security"""
        # Test malicious file types
        malicious_files = [
            ("test.exe", b"MZ\x90\x00"),  # Executable
            ("../../../etc/passwd", b"root:x:0:0"),  # Path traversal
            ("test.php", b"<?php system($_GET['cmd']); ?>")  # Script
        ]
        
        for filename, content in malicious_files:
            response = client.post("/api/upload/", 
                                 files={"file": (filename, content)})
            assert response.status_code in [400, 422]  # Should be rejected
```

## Training Exercises

### Exercise 1: Fix the Vulnerabilities
```python
# Fix all security issues in this code:
def user_login(request):
    username = request.form['username']
    password = request.form['password']
    
    # Issue 1: SQL injection
    query = f"SELECT * FROM users WHERE username = '{username}' AND password = '{password}'"
    result = db.execute(query)
    
    if result:
        # Issue 2: Sensitive data in logs
        logger.info(f"User {username} logged in with password {password}")
        
        # Issue 3: Insecure session
        session['user'] = username
        session['admin'] = True  # Issue 4: Privilege escalation
        
        return "Login successful"
    else:
        # Issue 5: Information disclosure
        return f"Invalid credentials for user {username}"

# Your secure implementation here:
```

### Exercise 2: Security Design Review
**Scenario**: Design a secure API endpoint for bulk work order creation

**Requirements**:
- Accept CSV file with work order data
- Validate all input data
- Support up to 1000 work orders per batch
- Require appropriate permissions
- Log all activities

**Security Considerations**:
1. How will you validate the CSV file?
2. What rate limiting will you apply?
3. How will you handle partial failures?
4. What audit logging is needed?
5. How will you prevent abuse?

### Exercise 3: Incident Response Simulation
**Scenario**: You discover that user passwords may have been logged in plain text

**Your Response**:
1. Immediate actions?
2. Investigation steps?
3. Communication plan?
4. Remediation steps?
5. Prevention measures?

---

**Next Steps**:
1. Complete incident response training
2. Review compliance requirements
3. Practice vulnerability assessments
4. Implement security testing in CI/CD