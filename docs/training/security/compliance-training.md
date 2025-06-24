# Compliance Training for FossaWork V2
*Legal, Security & Operations Team Training*

## Learning Objectives
By the end of this training, team members will:
- Understand GDPR, SOC2, and other relevant compliance requirements
- Know how to handle personal data according to legal standards
- Implement technical and organizational measures for compliance
- Recognize compliance violations and reporting requirements
- Execute proper data subject rights procedures

## Table of Contents
1. [Compliance Framework Overview](#compliance-framework-overview)
2. [GDPR (General Data Protection Regulation)](#gdpr-general-data-protection-regulation)
3. [SOC2 (Service Organization Control 2)](#soc2-service-organization-control-2)
4. [Data Classification and Handling](#data-classification-and-handling)
5. [Privacy by Design Implementation](#privacy-by-design-implementation)
6. [Breach Notification Requirements](#breach-notification-requirements)
7. [Data Subject Rights](#data-subject-rights)
8. [Technical Compliance Measures](#technical-compliance-measures)
9. [Audit and Documentation](#audit-and-documentation)
10. [FossaWork V2 Specific Compliance](#fossawork-v2-specific-compliance)

## Compliance Framework Overview

### Regulatory Landscape for FossaWork V2
As a business application handling work order data and user credentials, FossaWork V2 must comply with multiple regulatory frameworks:

#### Primary Regulations
- **GDPR**: If serving EU users or processing EU personal data
- **CCPA**: If serving California residents
- **SOC2**: For business customer trust and vendor requirements
- **HIPAA**: If handling healthcare-related work orders (potential future scope)
- **PCI DSS**: If handling payment information (not currently applicable)

#### Industry Standards
- **ISO 27001**: Information security management
- **NIST Cybersecurity Framework**: Security controls and best practices
- **OWASP**: Web application security standards

### Compliance Risk Assessment for FossaWork V2

#### High Risk Areas
1. **Credential Storage**: Currently plain text (CRITICAL VIOLATION)
2. **Cross-border Data Transfer**: WorkFossa integration
3. **Data Retention**: No defined retention policies
4. **User Consent**: Minimal consent management
5. **Audit Logging**: Limited compliance-focused logging

#### Medium Risk Areas
1. **Access Controls**: Basic user isolation
2. **Data Minimization**: Collecting necessary data only
3. **Encryption**: HTTPS in transit, but not at rest
4. **Vendor Management**: WorkFossa as data processor

#### Low Risk Areas
1. **Purpose Limitation**: Clear business purpose
2. **Data Accuracy**: User-controlled data updates
3. **Transparency**: Clear application purpose

## GDPR (General Data Protection Regulation)

### GDPR Principles Applied to FossaWork V2

#### 1. Lawfulness, Fairness, and Transparency
**Implementation Requirements**:
```python
# Privacy notice template for FossaWork V2
class GDPRPrivacyNotice:
    def __init__(self):
        self.notice = {
            "data_controller": "FossaWork V2 Development Team",
            "contact_details": "privacy@fossawork.com",
            "legal_basis": {
                "work_orders": "Legitimate interest - Business process automation",
                "user_credentials": "Contract - Service provision",
                "usage_logs": "Legitimate interest - Security and performance"
            },
            "purposes": [
                "Automate work order management",
                "Provide web scraping services",
                "Ensure system security and performance"
            ],
            "data_categories": [
                "Work order data (customer names, addresses, service details)",
                "Authentication credentials (usernames, encrypted passwords)",
                "System logs (access patterns, error logs)"
            ],
            "retention_periods": {
                "work_orders": "7 years (business records retention)",
                "credentials": "Until account deletion",
                "logs": "1 year (security purposes)"
            },
            "third_parties": [
                "WorkFossa (work order data source)",
                "Email providers (notification services)"
            ],
            "rights": [
                "Access your personal data",
                "Rectify inaccurate data",
                "Erase your data", 
                "Restrict processing",
                "Data portability",
                "Object to processing"
            ]
        }
```

#### 2. Purpose Limitation
**Current Status**: ✅ Compliant
- FossaWork V2 has clear, specific purposes
- Data used only for work order automation
- No secondary use without consent

**Implementation**:
```python
class PurposeLimitation:
    ALLOWED_PURPOSES = {
        "work_order_processing": [
            "scrape_work_orders",
            "store_work_orders", 
            "display_work_orders",
            "generate_reports"
        ],
        "user_management": [
            "authenticate_users",
            "store_preferences",
            "manage_credentials"
        ],
        "system_operation": [
            "security_monitoring",
            "performance_optimization",
            "error_logging"
        ]
    }
    
    @staticmethod
    def validate_data_use(data_type: str, purpose: str) -> bool:
        """Validate that data use aligns with stated purposes"""
        for allowed_purpose, operations in PurposeLimitation.ALLOWED_PURPOSES.items():
            if purpose in operations:
                # Check if data type is appropriate for this purpose
                if data_type == "work_orders" and allowed_purpose == "work_order_processing":
                    return True
                elif data_type == "credentials" and allowed_purpose == "user_management":
                    return True
                elif data_type == "logs" and allowed_purpose == "system_operation":
                    return True
        
        return False  # Purpose not allowed
```

#### 3. Data Minimization
**Current Status**: ⚠️ Needs Review
- Need to audit what data is actually necessary

**Implementation**:
```python
class DataMinimization:
    MINIMAL_WORK_ORDER_FIELDS = {
        "required": [
            "job_id",           # Essential for processing
            "store_number",     # Essential for location
            "service_code",     # Essential for automation
            "scheduled_date"    # Essential for planning
        ],
        "optional": [
            "customer_name",    # Useful for identification
            "address",          # Useful for routing
            "instructions"      # Useful for technicians
        ],
        "prohibited": [
            "personal_phone",   # Not needed for automation
            "personal_email",   # Not needed for automation
            "ssn",             # Never needed
            "payment_info"     # Not applicable
        ]
    }
    
    @staticmethod
    def sanitize_work_order(work_order_data: dict) -> dict:
        """Remove unnecessary personal data from work orders"""
        sanitized = {}
        
        # Include required fields
        for field in DataMinimization.MINIMAL_WORK_ORDER_FIELDS["required"]:
            if field in work_order_data:
                sanitized[field] = work_order_data[field]
        
        # Include optional fields if present and necessary
        for field in DataMinimization.MINIMAL_WORK_ORDER_FIELDS["optional"]:
            if field in work_order_data:
                sanitized[field] = work_order_data[field]
        
        # Log if prohibited fields are present
        for field in DataMinimization.MINIMAL_WORK_ORDER_FIELDS["prohibited"]:
            if field in work_order_data:
                logging.warning(f"GDPR VIOLATION: Prohibited field {field} found in work order data")
        
        return sanitized
```

#### 4. Accuracy
**Implementation**:
```python
class DataAccuracy:
    @staticmethod
    def enable_user_corrections():
        """Allow users to correct their own data"""
        # API endpoint for users to update their information
        pass
    
    @staticmethod
    def validate_data_freshness():
        """Check for outdated data that needs refreshing"""
        # Identify stale work orders, expired credentials
        pass
    
    @staticmethod
    def audit_data_quality():
        """Regular data quality checks"""
        issues = []
        
        # Check for incomplete work orders
        incomplete_orders = db.query("""
            SELECT id FROM work_orders 
            WHERE customer_name IS NULL OR store_number IS NULL
        """).fetchall()
        
        if incomplete_orders:
            issues.append(f"Found {len(incomplete_orders)} incomplete work orders")
        
        return issues
```

#### 5. Storage Limitation
**Current Status**: ❌ Non-Compliant (No retention policy)

**Implementation**:
```python
class RetentionPolicy:
    RETENTION_PERIODS = {
        "work_orders": timedelta(days=7*365),      # 7 years (business records)
        "user_credentials": None,                   # Until account deletion
        "access_logs": timedelta(days=365),        # 1 year
        "error_logs": timedelta(days=90),          # 3 months
        "performance_logs": timedelta(days=30)     # 1 month
    }
    
    @staticmethod
    async def cleanup_expired_data():
        """Automatically delete data past retention period"""
        cutoff_dates = {}
        
        for data_type, period in RetentionPolicy.RETENTION_PERIODS.items():
            if period:
                cutoff_dates[data_type] = datetime.now() - period
        
        # Delete expired work orders
        if "work_orders" in cutoff_dates:
            expired_orders = await db.execute(
                "DELETE FROM work_orders WHERE created_date < ?",
                (cutoff_dates["work_orders"],)
            )
            logging.info(f"GDPR CLEANUP: Deleted {expired_orders.rowcount} expired work orders")
        
        # Delete old logs
        for log_type in ["access_logs", "error_logs", "performance_logs"]:
            if log_type in cutoff_dates:
                log_files = glob.glob(f"/logs/{log_type}-*.jsonl")
                for log_file in log_files:
                    file_date = extract_date_from_filename(log_file)
                    if file_date < cutoff_dates[log_type]:
                        os.remove(log_file)
                        logging.info(f"GDPR CLEANUP: Deleted expired log file {log_file}")
    
    @staticmethod
    def schedule_cleanup():
        """Schedule automatic cleanup"""
        # Run cleanup daily at 2 AM
        scheduler.add_job(
            func=RetentionPolicy.cleanup_expired_data,
            trigger="cron",
            hour=2,
            minute=0,
            id="gdpr_cleanup"
        )
```

#### 6. Integrity and Confidentiality
**Current Status**: ❌ Critical Issues (Plain text credentials)

**Immediate Fixes Required**:
```python
class DataProtection:
    @staticmethod
    def encrypt_credentials_at_rest():
        """Encrypt stored credentials (CRITICAL FIX)"""
        from cryptography.fernet import Fernet
        
        key = Fernet.generate_key()
        cipher_suite = Fernet(key)
        
        # Store key securely (use proper key management in production)
        os.environ['FOSSA_ENCRYPTION_KEY'] = key.decode()
        
        # Encrypt all existing credentials
        for user_dir in os.listdir('data/users/'):
            cred_file = f'data/users/{user_dir}/credentials.json'
            if os.path.exists(cred_file):
                with open(cred_file, 'r') as f:
                    data = json.load(f)
                
                if 'password' in data and not data.get('encrypted', False):
                    encrypted_password = cipher_suite.encrypt(data['password'].encode())
                    data['password'] = encrypted_password.decode()
                    data['encrypted'] = True
                    
                    with open(cred_file, 'w') as f:
                        json.dump(data, f)
                    
                    # Set restrictive file permissions
                    os.chmod(cred_file, 0o600)
    
    @staticmethod
    def implement_pseudonymization():
        """Pseudonymize personal data where possible"""
        import hashlib
        
        def pseudonymize_name(name: str) -> str:
            """Create consistent pseudonym for customer names"""
            hash_object = hashlib.sha256(name.encode())
            hex_dig = hash_object.hexdigest()
            return f"Customer_{hex_dig[:8]}"
        
        # Use for non-essential display purposes
        return pseudonymize_name
```

### GDPR Data Subject Rights Implementation

#### Right of Access (Article 15)
```python
class DataSubjectAccess:
    @staticmethod
    async def generate_data_export(user_id: int) -> dict:
        """Generate complete data export for user"""
        user_data = {
            "request_date": datetime.now().isoformat(),
            "user_id": user_id,
            "personal_data": {},
            "processing_activities": []
        }
        
        # Collect user's work orders
        work_orders = await db.execute(
            "SELECT * FROM work_orders WHERE user_id = ?", (user_id,)
        ).fetchall()
        user_data["personal_data"]["work_orders"] = [dict(row) for row in work_orders]
        
        # Collect user credentials (encrypted)
        cred_file = f"data/users/{user_id}/credentials.json"
        if os.path.exists(cred_file):
            with open(cred_file, 'r') as f:
                creds = json.load(f)
                # Don't include actual passwords, just metadata
                user_data["personal_data"]["credentials"] = {
                    "username": creds.get("username"),
                    "last_updated": creds.get("last_updated"),
                    "encrypted": creds.get("encrypted", False)
                }
        
        # Collect processing activities
        user_data["processing_activities"] = [
            {
                "activity": "Work order automation",
                "legal_basis": "Legitimate interest",
                "data_categories": ["Work order details", "Customer information"],
                "retention_period": "7 years"
            },
            {
                "activity": "User authentication", 
                "legal_basis": "Contract",
                "data_categories": ["Username", "Encrypted password"],
                "retention_period": "Until account deletion"
            }
        ]
        
        return user_data

# API endpoint
@app.get("/api/gdpr/data-export/{user_id}")
async def request_data_export(
    user_id: int,
    current_user: User = Depends(get_current_user)
):
    # Verify user can only access their own data
    if current_user.id != user_id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied")
    
    user_data = await DataSubjectAccess.generate_data_export(user_id)
    
    # Log the data access request
    log_gdpr_event("data_access_request", user_id, {
        "requested_by": current_user.id,
        "export_size": len(json.dumps(user_data))
    })
    
    return user_data
```

#### Right to Rectification (Article 16)
```python
class DataRectification:
    @staticmethod
    async def update_work_order(user_id: int, order_id: int, updates: dict):
        """Allow users to correct their work order data"""
        # Verify ownership
        order = await db.execute(
            "SELECT * FROM work_orders WHERE id = ? AND user_id = ?",
            (order_id, user_id)
        ).fetchone()
        
        if not order:
            raise ValueError("Work order not found or access denied")
        
        # Validate updates
        allowed_fields = ['customer_name', 'address', 'instructions']
        validated_updates = {}
        
        for field, value in updates.items():
            if field in allowed_fields:
                validated_updates[field] = value
            else:
                raise ValueError(f"Field {field} cannot be updated")
        
        # Update database
        update_query = "UPDATE work_orders SET "
        update_params = []
        
        for field, value in validated_updates.items():
            update_query += f"{field} = ?, "
            update_params.append(value)
        
        update_query = update_query.rstrip(", ") + " WHERE id = ?"
        update_params.append(order_id)
        
        await db.execute(update_query, update_params)
        
        # Log rectification
        log_gdpr_event("data_rectification", user_id, {
            "order_id": order_id,
            "fields_updated": list(validated_updates.keys())
        })

# API endpoint
@app.put("/api/gdpr/rectify/work-order/{order_id}")
async def rectify_work_order(
    order_id: int,
    updates: dict,
    current_user: User = Depends(get_current_user)
):
    await DataRectification.update_work_order(current_user.id, order_id, updates)
    return {"success": True, "message": "Data updated successfully"}
```

#### Right to Erasure (Article 17)
```python
class DataErasure:
    @staticmethod
    async def delete_user_data(user_id: int, reason: str):
        """Complete user data deletion"""
        deletion_log = {
            "user_id": user_id,
            "deletion_date": datetime.now().isoformat(),
            "reason": reason,
            "deleted_items": []
        }
        
        # Delete work orders
        work_orders_deleted = await db.execute(
            "DELETE FROM work_orders WHERE user_id = ?", (user_id,)
        ).rowcount
        deletion_log["deleted_items"].append(f"{work_orders_deleted} work orders")
        
        # Delete user directory and credentials
        user_dir = Path(f"data/users/{user_id}")
        if user_dir.exists():
            shutil.rmtree(user_dir)
            deletion_log["deleted_items"].append("User directory and credentials")
        
        # Anonymize logs (can't delete for security reasons)
        await anonymize_user_logs(user_id)
        deletion_log["deleted_items"].append("Anonymized user logs")
        
        # Log the deletion (required for audit)
        log_gdpr_event("data_erasure", user_id, deletion_log)
        
        return deletion_log

async def anonymize_user_logs(user_id: int):
    """Replace user ID with anonymous identifier in logs"""
    anonymous_id = f"DELETED_USER_{hash(user_id) % 10000}"
    
    # Process log files
    for log_file in glob.glob("/logs/*.jsonl"):
        # Read, process, and rewrite log file
        with open(log_file, 'r') as f:
            lines = f.readlines()
        
        with open(log_file, 'w') as f:
            for line in lines:
                # Replace user ID references
                anonymized_line = line.replace(f'"user_id": {user_id}', f'"user_id": "{anonymous_id}"')
                f.write(anonymized_line)
```

## SOC2 (Service Organization Control 2)

### SOC2 Trust Service Criteria

#### Security (Common Criteria)
**Current Implementation Status**: ⚠️ Partial

**Required Controls**:
```python
class SOC2SecurityControls:
    @staticmethod
    def implement_access_controls():
        """CC6.1 - Logical and Physical Access Controls"""
        controls = {
            "logical_access": {
                "multi_factor_authentication": False,  # Not implemented
                "role_based_access": True,             # Basic implementation
                "privileged_access_management": False, # Not implemented
                "access_reviews": False                # Not implemented
            },
            "physical_access": {
                "data_center_security": "N/A",        # Cloud-based
                "workstation_security": "User managed",
                "mobile_device_management": False      # Not implemented
            }
        }
        return controls
    
    @staticmethod
    def network_security_controls():
        """CC6.7 - Data Transmission and Disposal"""
        return {
            "encryption_in_transit": True,   # HTTPS
            "encryption_at_rest": False,     # CRITICAL ISSUE
            "secure_disposal": False,        # No procedure
            "network_segmentation": False    # Single network
        }
    
    @staticmethod
    def system_operations_controls():
        """CC7.1 - System Capacity and Performance"""
        return {
            "capacity_monitoring": False,    # Basic monitoring only
            "performance_monitoring": True,  # Basic metrics
            "incident_response": True,       # Documented procedures
            "backup_procedures": False       # No automated backups
        }
```

#### Availability
**Implementation**:
```python
class SOC2AvailabilityControls:
    @staticmethod
    def implement_monitoring():
        """A1.2 - System Availability Monitoring"""
        
        # Health check endpoint
        @app.get("/api/health")
        async def health_check():
            checks = {
                "database": await check_database_health(),
                "filesystem": check_filesystem_health(),
                "external_services": await check_workfossa_connectivity(),
                "timestamp": datetime.now().isoformat()
            }
            
            all_healthy = all(checks.values())
            status_code = 200 if all_healthy else 503
            
            return JSONResponse(
                status_code=status_code,
                content={"status": "healthy" if all_healthy else "unhealthy", "checks": checks}
            )
    
    @staticmethod
    def backup_procedures():
        """A1.3 - Data Backup and Recovery"""
        async def create_system_backup():
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_dir = f"/backups/system_backup_{timestamp}"
            os.makedirs(backup_dir, exist_ok=True)
            
            # Database backup
            shutil.copy2("/backend/fossawork_v2.db", f"{backup_dir}/database.db")
            
            # User data backup
            shutil.copytree("/backend/data", f"{backup_dir}/data")
            
            # Configuration backup
            shutil.copy2("/.env", f"{backup_dir}/environment")
            
            # Verify backup integrity
            if verify_backup_integrity(backup_dir):
                log_soc2_event("backup_created", {"backup_path": backup_dir})
                return backup_dir
            else:
                raise Exception("Backup integrity check failed")
```

#### Processing Integrity
**Implementation**:
```python
class SOC2ProcessingIntegrity:
    @staticmethod
    def data_validation_controls():
        """PI1.1 - Data Input Completeness and Accuracy"""
        
        # Input validation middleware
        @app.middleware("http")
        async def validate_data_integrity(request: Request, call_next):
            if request.method in ["POST", "PUT", "PATCH"]:
                # Check for data completeness
                content_length = request.headers.get("content-length")
                if content_length and int(content_length) > MAX_REQUEST_SIZE:
                    return JSONResponse(
                        status_code=413,
                        content={"error": "Request too large"}
                    )
                
                # Log data processing events
                log_soc2_event("data_processing", {
                    "endpoint": request.url.path,
                    "method": request.method,
                    "content_length": content_length
                })
            
            response = await call_next(request)
            return response
    
    @staticmethod
    def processing_controls():
        """PI1.3 - Data Processing Accuracy"""
        
        # Transaction integrity checks
        async def process_work_order_with_integrity(work_order_data):
            transaction_id = str(uuid.uuid4())
            
            try:
                # Begin transaction
                async with db.transaction():
                    # Validate data integrity
                    if not validate_work_order_data(work_order_data):
                        raise ValueError("Data validation failed")
                    
                    # Process with checksums
                    data_checksum = calculate_checksum(work_order_data)
                    
                    # Store with integrity metadata
                    result = await db.execute(
                        "INSERT INTO work_orders (...) VALUES (...)",
                        work_order_data
                    )
                    
                    # Verify processing
                    stored_data = await db.execute(
                        "SELECT * FROM work_orders WHERE id = ?",
                        (result.lastrowid,)
                    ).fetchone()
                    
                    stored_checksum = calculate_checksum(stored_data)
                    if data_checksum != stored_checksum:
                        raise ValueError("Data integrity check failed")
                    
                    log_soc2_event("processing_integrity", {
                        "transaction_id": transaction_id,
                        "checksum": data_checksum,
                        "status": "success"
                    })
                    
                    return result
                    
            except Exception as e:
                log_soc2_event("processing_integrity", {
                    "transaction_id": transaction_id,
                    "status": "failed",
                    "error": str(e)
                })
                raise
```

#### Confidentiality
**Current Status**: ❌ Critical Issues

**Required Implementation**:
```python
class SOC2ConfidentialityControls:
    @staticmethod
    def data_classification():
        """C1.1 - Confidential Information Identification"""
        
        DATA_CLASSIFICATIONS = {
            "public": {
                "examples": ["Application version", "General documentation"],
                "access_level": "all_users",
                "encryption_required": False
            },
            "internal": {
                "examples": ["System logs", "Performance metrics"],
                "access_level": "authenticated_users",
                "encryption_required": False
            },
            "confidential": {
                "examples": ["Work order data", "User preferences"],
                "access_level": "owner_only",
                "encryption_required": True
            },
            "restricted": {
                "examples": ["Authentication credentials", "Encryption keys"],
                "access_level": "admin_only",
                "encryption_required": True
            }
        }
        
        @staticmethod
        def classify_data(data_type: str) -> str:
            """Classify data based on type"""
            classifications = {
                "credentials": "restricted",
                "work_orders": "confidential",
                "user_preferences": "confidential",
                "system_logs": "internal",
                "health_checks": "public"
            }
            return classifications.get(data_type, "confidential")
    
    @staticmethod
    def access_controls():
        """C1.2 - Confidential Information Access"""
        
        def check_data_access_permission(user: User, data_type: str, resource_id: int):
            classification = SOC2ConfidentialityControls.classify_data(data_type)
            
            if classification == "public":
                return True
            elif classification == "internal":
                return user.is_authenticated
            elif classification == "confidential":
                # Check ownership
                return user.owns_resource(data_type, resource_id)
            elif classification == "restricted":
                return user.is_admin
            
            return False
```

### SOC2 Audit Logging
```python
class SOC2AuditLogging:
    @staticmethod
    def setup_audit_logging():
        """Comprehensive audit logging for SOC2 compliance"""
        
        audit_logger = logging.getLogger("soc2_audit")
        audit_handler = logging.FileHandler("/logs/soc2_audit.log")
        audit_formatter = logging.Formatter(
            '%(asctime)s|%(levelname)s|%(message)s'
        )
        audit_handler.setFormatter(audit_formatter)
        audit_logger.addHandler(audit_handler)
        audit_logger.setLevel(logging.INFO)
        
        return audit_logger
    
    @staticmethod
    def log_security_event(event_type: str, user_id: int, details: dict):
        """Log security events for SOC2 compliance"""
        audit_data = {
            "event_type": event_type,
            "user_id": user_id,
            "timestamp": datetime.now().isoformat(),
            "source_ip": get_client_ip(),
            "user_agent": get_user_agent(),
            "details": details
        }
        
        soc2_logger.info(json.dumps(audit_data))
    
    REQUIRED_EVENTS = [
        "user_login",
        "user_logout", 
        "data_access",
        "data_modification",
        "privilege_escalation",
        "system_configuration_change",
        "backup_creation",
        "backup_restoration",
        "incident_detection",
        "incident_response"
    ]

# Middleware for automatic audit logging
@app.middleware("http")
async def soc2_audit_middleware(request: Request, call_next):
    start_time = time.time()
    
    # Log request
    if request.url.path.startswith("/api/"):
        SOC2AuditLogging.log_security_event(
            "api_request",
            getattr(request.state, "user_id", None),
            {
                "endpoint": request.url.path,
                "method": request.method,
                "query_params": dict(request.query_params)
            }
        )
    
    response = await call_next(request)
    
    # Log response
    processing_time = time.time() - start_time
    if request.url.path.startswith("/api/"):
        SOC2AuditLogging.log_security_event(
            "api_response",
            getattr(request.state, "user_id", None),
            {
                "endpoint": request.url.path,
                "status_code": response.status_code,
                "processing_time": processing_time
            }
        )
    
    return response
```

## Data Classification and Handling

### FossaWork V2 Data Classification Matrix

| **Data Type** | **Classification** | **Examples** | **Access Control** | **Encryption** | **Retention** |
|---------------|-------------------|--------------|-------------------|----------------|---------------|
| User Credentials | Restricted | Passwords, API keys | Admin only | Required | Until deletion |
| Work Order Data | Confidential | Customer names, addresses | Owner only | Required | 7 years |
| System Configuration | Internal | App settings, feature flags | Authenticated | Recommended | Indefinite |
| Usage Analytics | Internal | Performance metrics, errors | Authenticated | Not required | 1 year |
| Public Information | Public | Documentation, version info | All users | Not required | Indefinite |

### Data Handling Procedures

#### Secure Data Storage
```python
class SecureDataStorage:
    @staticmethod
    def store_classified_data(data: dict, classification: str, user_id: int):
        """Store data according to classification requirements"""
        
        if classification in ["restricted", "confidential"]:
            # Encrypt sensitive data
            encrypted_data = encrypt_data(data)
            
            # Store with access controls
            file_path = f"data/users/{user_id}/{classification}_data.enc"
            with open(file_path, 'wb') as f:
                f.write(encrypted_data)
            
            # Set restrictive permissions
            os.chmod(file_path, 0o600)  # Owner read/write only
            
        elif classification == "internal":
            # Store with user access controls
            file_path = f"data/users/{user_id}/internal_data.json"
            with open(file_path, 'w') as f:
                json.dump(data, f)
            
            os.chmod(file_path, 0o640)  # Owner read/write, group read
            
        else:  # public
            # Standard storage
            file_path = f"data/public/public_data.json"
            with open(file_path, 'w') as f:
                json.dump(data, f)
    
    @staticmethod
    def access_classified_data(classification: str, user_id: int, requesting_user: User):
        """Access data according to classification rules"""
        
        # Check access permissions
        if classification == "restricted" and not requesting_user.is_admin:
            raise PermissionError("Restricted data access denied")
        
        if classification == "confidential" and requesting_user.id != user_id:
            raise PermissionError("Confidential data access denied")
        
        if classification == "internal" and not requesting_user.is_authenticated:
            raise PermissionError("Internal data access denied")
        
        # Log access
        log_data_access(classification, user_id, requesting_user.id)
        
        # Return data
        return load_classified_data(classification, user_id)
```

#### Data Transfer Security
```python
class SecureDataTransfer:
    @staticmethod
    def prepare_data_for_transfer(data: dict, destination: str) -> dict:
        """Prepare data for secure transfer"""
        
        # Encrypt sensitive fields
        sensitive_fields = ['password', 'token', 'api_key', 'secret']
        
        for field in sensitive_fields:
            if field in data:
                data[field] = encrypt_field(data[field])
        
        # Add integrity check
        data['checksum'] = calculate_checksum(data)
        data['timestamp'] = datetime.now().isoformat()
        
        # Log transfer
        log_data_transfer(data.keys(), destination)
        
        return data
    
    @staticmethod
    def validate_received_data(data: dict) -> bool:
        """Validate integrity of received data"""
        
        # Check timestamp (reject old data)
        transfer_time = datetime.fromisoformat(data['timestamp'])
        if datetime.now() - transfer_time > timedelta(minutes=5):
            return False
        
        # Verify checksum
        received_checksum = data.pop('checksum')
        calculated_checksum = calculate_checksum(data)
        
        return received_checksum == calculated_checksum
```

## Privacy by Design Implementation

### Seven Foundational Principles

#### 1. Proactive not Reactive
```python
class ProactivePrivacy:
    @staticmethod
    def privacy_impact_assessment():
        """Assess privacy impact of new features"""
        
        assessment = {
            "feature": "Batch work order processing",
            "data_types": ["work_orders", "customer_data"],
            "privacy_risks": [
                "Bulk processing may expose more data",
                "Automated processing reduces human oversight"
            ],
            "mitigation_measures": [
                "Implement data minimization in batch queries",
                "Add automated privacy checks",
                "Limit batch size to reduce exposure"
            ],
            "approval_required": True
        }
        
        return assessment
    
    @staticmethod
    def automated_privacy_checks():
        """Automated privacy compliance checking"""
        
        def check_data_minimization(query: str) -> bool:
            """Check if database query follows data minimization"""
            
            # Flag queries selecting all columns
            if "SELECT *" in query.upper():
                return False
            
            # Flag queries without user restrictions
            if "WHERE user_id" not in query:
                return False
            
            return True
        
        def check_purpose_limitation(data_use: str, stated_purpose: str) -> bool:
            """Check if data use aligns with stated purpose"""
            return data_use in ALLOWED_PURPOSES.get(stated_purpose, [])
```

#### 2. Privacy as the Default
```python
class PrivacyByDefault:
    DEFAULT_SETTINGS = {
        "data_retention": "minimum_required",
        "data_sharing": False,
        "analytics_tracking": False,
        "email_notifications": "essential_only",
        "log_level": "errors_only"
    }
    
    @staticmethod
    def apply_privacy_defaults(user_settings: dict) -> dict:
        """Apply privacy-friendly defaults to user settings"""
        
        final_settings = PrivacyByDefault.DEFAULT_SETTINGS.copy()
        
        # Only override defaults if user explicitly opts in
        for setting, value in user_settings.items():
            if setting in final_settings:
                final_settings[setting] = value
        
        return final_settings
    
    @staticmethod
    def minimize_default_data_collection():
        """Collect only essential data by default"""
        
        ESSENTIAL_FIELDS = {
            "work_orders": ["job_id", "service_code", "scheduled_date"],
            "users": ["username", "email"],
            "logs": ["timestamp", "log_level", "message"]
        }
        
        return ESSENTIAL_FIELDS
```

#### 3. Privacy Embedded into Design
```python
class EmbeddedPrivacy:
    @staticmethod
    def design_with_privacy():
        """Embed privacy into system architecture"""
        
        # Data flow with privacy controls
        data_flow = {
            "collection": {
                "controls": ["consent_check", "purpose_validation", "minimization"],
                "implementation": "validate_data_collection()"
            },
            "processing": {
                "controls": ["access_control", "purpose_limitation", "accuracy"],
                "implementation": "secure_data_processing()"
            },
            "storage": {
                "controls": ["encryption", "access_logs", "retention_limits"],
                "implementation": "secure_data_storage()"
            },
            "sharing": {
                "controls": ["consent_required", "contract_required", "audit_trail"],
                "implementation": "controlled_data_sharing()"
            }
        }
        
        return data_flow
    
    @staticmethod
    def privacy_enhancing_technologies():
        """Implement privacy-enhancing technologies"""
        
        # Pseudonymization
        def pseudonymize_user_data(user_id: int) -> str:
            """Create consistent pseudonym for user"""
            salt = os.getenv("PSEUDONYM_SALT", "default_salt")
            return hashlib.sha256(f"{user_id}{salt}".encode()).hexdigest()[:16]
        
        # Data minimization
        def minimize_query_results(results: list, purpose: str) -> list:
            """Remove unnecessary fields based on purpose"""
            field_mapping = {
                "display": ["id", "customer_name", "service_code"],
                "processing": ["id", "service_code", "scheduled_date"],
                "reporting": ["service_code", "scheduled_date", "status"]
            }
            
            allowed_fields = field_mapping.get(purpose, [])
            return [{k: v for k, v in row.items() if k in allowed_fields} for row in results]
```

## Breach Notification Requirements

### Automated Breach Detection
```python
class BreachDetection:
    @staticmethod
    def setup_breach_monitoring():
        """Monitor for potential data breaches"""
        
        # Unusual access patterns
        def detect_unusual_access():
            """Detect suspicious access patterns"""
            
            # Multiple failed login attempts
            failed_logins = db.execute("""
                SELECT user_id, COUNT(*) as failures
                FROM auth_logs 
                WHERE success = FALSE 
                  AND timestamp > datetime('now', '-1 hour')
                GROUP BY user_id
                HAVING failures > 5
            """).fetchall()
            
            for user_id, failures in failed_logins:
                trigger_breach_alert("suspicious_login_attempts", {
                    "user_id": user_id,
                    "failure_count": failures
                })
        
        # Data access outside normal hours
        def detect_unusual_timing():
            """Detect data access outside business hours"""
            
            # Define business hours (9 AM - 6 PM)
            business_hours = range(9, 18)
            current_hour = datetime.now().hour
            
            if current_hour not in business_hours:
                recent_access = db.execute("""
                    SELECT COUNT(*) as access_count
                    FROM audit_logs
                    WHERE event_type = 'data_access'
                      AND timestamp > datetime('now', '-10 minutes')
                """).fetchone()
                
                if recent_access.access_count > 10:  # Threshold
                    trigger_breach_alert("unusual_timing_access", {
                        "access_count": recent_access.access_count,
                        "time": datetime.now().isoformat()
                    })
        
        # Large data exports
        def detect_bulk_data_access():
            """Detect potential data exfiltration"""
            
            large_exports = db.execute("""
                SELECT user_id, COUNT(*) as export_count
                FROM audit_logs
                WHERE event_type = 'data_export'
                  AND timestamp > datetime('now', '-1 hour')
                GROUP BY user_id
                HAVING export_count > 3
            """).fetchall()
            
            for user_id, export_count in large_exports:
                trigger_breach_alert("bulk_data_access", {
                    "user_id": user_id,
                    "export_count": export_count
                })

def trigger_breach_alert(alert_type: str, details: dict):
    """Trigger breach notification process"""
    
    # Immediate alert
    send_security_alert(f"POTENTIAL BREACH: {alert_type}", details)
    
    # Log incident
    incident_id = create_security_incident(alert_type, details)
    
    # Start investigation
    start_breach_investigation(incident_id)
```

### GDPR Breach Notification (72 hours)
```python
class GDPRBreachNotification:
    @staticmethod
    def assess_breach_risk(incident_data: dict) -> str:
        """Assess if incident constitutes a GDPR breach"""
        
        risk_factors = {
            "personal_data_involved": False,
            "unauthorized_access": False,
            "data_exfiltration": False,
            "system_compromise": False,
            "encryption_bypassed": False
        }
        
        # Analyze incident data
        if "personal_data" in incident_data.get("affected_data", []):
            risk_factors["personal_data_involved"] = True
        
        if incident_data.get("access_type") == "unauthorized":
            risk_factors["unauthorized_access"] = True
        
        # Calculate risk score
        risk_score = sum(risk_factors.values())
        
        if risk_score >= 3:
            return "high_risk_breach"
        elif risk_score >= 2:
            return "medium_risk_breach"
        elif risk_score >= 1:
            return "low_risk_breach"
        else:
            return "no_breach"
    
    @staticmethod
    def generate_breach_notification(incident_id: str, assessment: dict):
        """Generate GDPR breach notification"""
        
        notification = {
            "incident_id": incident_id,
            "notification_date": datetime.now().isoformat(),
            "controller_details": {
                "name": "FossaWork V2",
                "contact": "privacy@fossawork.com",
                "dpo_contact": "dpo@fossawork.com"
            },
            "breach_details": {
                "nature": assessment["breach_type"],
                "discovery_date": assessment["discovery_date"],
                "occurrence_date": assessment["estimated_occurrence"],
                "categories_affected": assessment["data_categories"],
                "individuals_affected": assessment["individual_count"],
                "likely_consequences": assessment["impact_assessment"]
            },
            "measures_taken": assessment["response_actions"],
            "measures_planned": assessment["remediation_plan"],
            "cross_border_transfer": assessment.get("cross_border", False)
        }
        
        # Submit to data protection authority
        submit_to_dpa(notification)
        
        # Notify affected individuals if required
        if assessment["individual_notification_required"]:
            notify_affected_individuals(notification)
        
        return notification

@scheduler.scheduled_job("interval", minutes=15)
def check_breach_notification_deadline():
    """Monitor 72-hour notification deadline"""
    
    cutoff_time = datetime.now() - timedelta(hours=72)
    
    pending_notifications = db.execute("""
        SELECT * FROM security_incidents
        WHERE created_date < ?
          AND gdpr_notification_status = 'pending'
          AND breach_risk_level IN ('high_risk_breach', 'medium_risk_breach')
    """, (cutoff_time,)).fetchall()
    
    for incident in pending_notifications:
        send_urgent_alert(f"GDPR DEADLINE EXCEEDED: {incident.incident_id}")
```

## Technical Compliance Measures

### Automated Compliance Checking
```python
class ComplianceChecker:
    def __init__(self):
        self.compliance_rules = self.load_compliance_rules()
    
    def load_compliance_rules(self):
        """Load compliance rules configuration"""
        return {
            "gdpr": {
                "encryption_required": ["credentials", "personal_data"],
                "consent_required": ["marketing", "analytics"],
                "retention_limits": {
                    "work_orders": timedelta(days=7*365),
                    "logs": timedelta(days=365)
                }
            },
            "soc2": {
                "audit_logging": ["authentication", "data_access", "configuration"],
                "access_controls": ["rbac", "session_management"],
                "monitoring": ["availability", "performance", "security"]
            }
        }
    
    async def run_compliance_check(self) -> dict:
        """Run comprehensive compliance check"""
        
        results = {
            "timestamp": datetime.now().isoformat(),
            "gdpr_compliance": await self.check_gdpr_compliance(),
            "soc2_compliance": await self.check_soc2_compliance(),
            "overall_score": 0,
            "critical_issues": [],
            "recommendations": []
        }
        
        # Calculate overall score
        scores = [results["gdpr_compliance"]["score"], results["soc2_compliance"]["score"]]
        results["overall_score"] = sum(scores) / len(scores)
        
        return results
    
    async def check_gdpr_compliance(self) -> dict:
        """Check GDPR compliance requirements"""
        
        checks = {
            "encryption_at_rest": await self.check_encryption(),
            "data_retention": await self.check_retention_policies(),
            "consent_management": await self.check_consent(),
            "data_subject_rights": await self.check_subject_rights(),
            "breach_procedures": await self.check_breach_procedures()
        }
        
        passed_checks = sum(1 for result in checks.values() if result["passed"])
        score = (passed_checks / len(checks)) * 100
        
        return {
            "score": score,
            "checks": checks,
            "compliance_level": "compliant" if score >= 80 else "non_compliant"
        }
    
    async def check_encryption(self) -> dict:
        """Check encryption implementation"""
        
        # Check credential encryption
        credential_files = glob.glob("data/users/*/credentials.json")
        encrypted_count = 0
        
        for file_path in credential_files:
            with open(file_path, 'r') as f:
                data = json.load(f)
                if data.get('encrypted', False):
                    encrypted_count += 1
        
        encryption_percentage = (encrypted_count / len(credential_files)) * 100 if credential_files else 0
        
        return {
            "passed": encryption_percentage >= 95,
            "score": encryption_percentage,
            "details": f"{encrypted_count}/{len(credential_files)} credential files encrypted"
        }

# Compliance monitoring middleware
@app.middleware("http")
async def compliance_monitoring(request: Request, call_next):
    """Monitor compliance in real-time"""
    
    # Check data access compliance
    if request.url.path.startswith("/api/") and request.method in ["GET", "POST", "PUT", "DELETE"]:
        
        # Verify proper authentication for data access
        if not has_valid_authentication(request):
            log_compliance_violation("unauthorized_data_access", {
                "path": request.url.path,
                "method": request.method,
                "ip": get_client_ip(request)
            })
    
    response = await call_next(request)
    
    # Check response for data leakage
    if hasattr(response, 'body') and len(response.body) > 10000:
        # Large response - check for potential data dump
        log_compliance_event("large_data_response", {
            "path": request.url.path,
            "response_size": len(response.body)
        })
    
    return response
```

### Compliance Reporting
```python
class ComplianceReporting:
    @staticmethod
    async def generate_gdpr_report() -> dict:
        """Generate GDPR compliance report"""
        
        report = {
            "report_date": datetime.now().isoformat(),
            "reporting_period": "last_30_days",
            "data_processing_activities": await get_processing_activities(),
            "data_subject_requests": await get_subject_requests(),
            "security_incidents": await get_security_incidents(),
            "compliance_metrics": await calculate_compliance_metrics()
        }
        
        return report
    
    @staticmethod
    async def generate_soc2_report() -> dict:
        """Generate SOC2 compliance report"""
        
        report = {
            "report_date": datetime.now().isoformat(),
            "control_testing_results": await test_soc2_controls(),
            "security_monitoring": await get_security_metrics(),
            "availability_metrics": await get_availability_metrics(),
            "incident_response": await get_incident_response_metrics()
        }
        
        return report

# Scheduled compliance reporting
@scheduler.scheduled_job("cron", day=1, hour=6)  # First day of month at 6 AM
async def monthly_compliance_report():
    """Generate monthly compliance reports"""
    
    gdpr_report = await ComplianceReporting.generate_gdpr_report()
    soc2_report = await ComplianceReporting.generate_soc2_report()
    
    # Save reports
    timestamp = datetime.now().strftime("%Y%m")
    
    with open(f"/reports/gdpr_report_{timestamp}.json", 'w') as f:
        json.dump(gdpr_report, f, indent=2)
    
    with open(f"/reports/soc2_report_{timestamp}.json", 'w') as f:
        json.dump(soc2_report, f, indent=2)
    
    # Send to compliance team
    send_compliance_reports([gdpr_report, soc2_report])
```

## Training Exercises

### Exercise 1: Data Subject Request Handling
**Scenario**: User requests all their personal data under GDPR Article 15

**Your Task**:
1. Identify all personal data stored for the user
2. Generate complete data export
3. Verify export completeness
4. Deliver securely to user
5. Log the request properly

```python
# Complete this implementation
async def handle_data_subject_request(user_id: int, request_type: str):
    """Handle GDPR data subject request"""
    
    if request_type == "access":
        # Your implementation here
        pass
    elif request_type == "rectification":
        # Your implementation here
        pass
    elif request_type == "erasure":
        # Your implementation here
        pass
    
    # What logging is required?
    # What verification steps are needed?
    # How do you ensure completeness?
```

### Exercise 2: Breach Assessment
**Scenario**: Monitoring alerts indicate potential unauthorized access to work order data

**Your Task**:
1. Assess if this constitutes a GDPR breach
2. Determine notification requirements
3. Calculate timeline for notifications
4. Draft initial breach notification
5. Plan remediation steps

### Exercise 3: SOC2 Control Testing
**Scenario**: Annual SOC2 audit is approaching

**Your Task**:
1. Test logical access controls
2. Verify data encryption implementation
3. Check audit logging completeness
4. Test incident response procedures
5. Document control effectiveness

## Assessment and Certification

### Compliance Knowledge Check
1. What are the six lawful bases for processing under GDPR?
2. What is the GDPR breach notification timeline?
3. Name the five SOC2 Trust Service Criteria
4. What constitutes personal data under GDPR?
5. When is a Data Protection Impact Assessment required?
6. What are the mandatory elements of a breach notification?
7. How do you determine if cross-border transfer restrictions apply?
8. What documentation is required for GDPR compliance?

### Practical Assessment
- Conduct a data mapping exercise for FossaWork V2
- Handle a simulated data subject request
- Assess a simulated security incident for breach notification requirements
- Design privacy controls for a new feature
- Create SOC2 control documentation

### Certification Requirements
- [ ] Complete all training modules with 85% minimum score
- [ ] Demonstrate GDPR data subject request handling
- [ ] Complete SOC2 control testing exercise
- [ ] Pass compliance scenario simulations
- [ ] Create compliance documentation for assigned system

### Ongoing Compliance Education
- Quarterly regulatory update sessions
- Annual compliance training refresh
- Industry best practice workshops
- Regulatory body guidance reviews
- Peer compliance community participation

---

**Critical Reminders**:
- Compliance is not optional - legal and business requirement
- Non-compliance can result in significant fines and legal action
- Regular monitoring and updates are essential
- Document everything - if it's not documented, it didn't happen
- When in doubt, consult legal counsel or DPO

**Next Steps**:
1. Complete penetration testing training
2. Review current FossaWork V2 compliance gaps
3. Implement priority compliance fixes
4. Schedule regular compliance assessments