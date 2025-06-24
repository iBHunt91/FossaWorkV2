"""
Configuration Manager for FossaWork V2
Handles environment-based configuration with validation and hot-reloading
"""

import os
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional, List, Union
from datetime import datetime, timedelta
import secrets
from functools import lru_cache
import yaml
from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings
from pydantic.networks import EmailStr, HttpUrl
from enum import Enum
# Optional dependencies for external secret providers
try:
    import hvac  # HashiCorp Vault client
    VAULT_AVAILABLE = True
except ImportError:
    VAULT_AVAILABLE = False

try:
    import boto3  # AWS Secrets Manager
    AWS_AVAILABLE = True
except ImportError:
    AWS_AVAILABLE = False
# More optional dependencies
try:
    from cryptography.fernet import Fernet
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False

logger = logging.getLogger(__name__)


class Environment(str, Enum):
    """Application environments"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class LogLevel(str, Enum):
    """Logging levels"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class SecretProvider(str, Enum):
    """Secret management providers"""
    LOCAL = "local"
    AWS_SECRETS_MANAGER = "aws_secrets_manager"
    HASHICORP_VAULT = "hashicorp_vault"
    AZURE_KEYVAULT = "azure_keyvault"
    KUBERNETES_SECRET = "kubernetes_secret"


if WATCHDOG_AVAILABLE:
    class ConfigFileHandler(FileSystemEventHandler):
    """Handles configuration file changes for hot-reloading"""
    
    def __init__(self, config_manager):
        self.config_manager = config_manager
        
    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('.env'):
            logger.info(f"Configuration file modified: {event.src_path}")
            self.config_manager.reload()


class Settings(BaseSettings):
    """
    Comprehensive settings for FossaWork V2
    Supports environment variables, .env files, and external secret providers
    """
    
    # Application Settings
    app_name: str = Field("FossaWork V2", env="APP_NAME")
    app_version: str = Field("2.0.0", env="APP_VERSION")
    environment: Environment = Field(Environment.DEVELOPMENT, env="ENVIRONMENT")
    debug: bool = Field(False, env="DEBUG")
    log_level: LogLevel = Field(LogLevel.INFO, env="LOG_LEVEL")
    
    # API Configuration
    api_host: str = Field("0.0.0.0", env="API_HOST")
    api_port: int = Field(8000, env="API_PORT", ge=1, le=65535)
    api_workers: int = Field(4, env="API_WORKERS", ge=1)
    api_reload: bool = Field(False, env="API_RELOAD")
    api_base_path: str = Field("/api", env="API_BASE_PATH")
    api_docs_enabled: bool = Field(True, env="API_DOCS_ENABLED")
    
    # Database Configuration
    database_url: str = Field(..., env="DATABASE_URL")
    database_pool_size: int = Field(20, env="DATABASE_POOL_SIZE", ge=1)
    database_pool_timeout: int = Field(30, env="DATABASE_POOL_TIMEOUT", ge=1)
    database_pool_recycle: int = Field(1800, env="DATABASE_POOL_RECYCLE", ge=1)
    database_max_overflow: int = Field(10, env="DATABASE_MAX_OVERFLOW", ge=0)
    database_echo_pool: bool = Field(False, env="DATABASE_ECHO_POOL")
    
    # Security Settings
    secret_key: SecretStr = Field(..., env="SECRET_KEY")
    fossawork_master_key: SecretStr = Field(..., env="FOSSAWORK_MASTER_KEY")
    jwt_algorithm: str = Field("HS256", env="JWT_ALGORITHM")
    jwt_expiration_hours: int = Field(24, env="JWT_EXPIRATION_HOURS", ge=1)
    jwt_refresh_enabled: bool = Field(True, env="JWT_REFRESH_ENABLED")
    jwt_refresh_expiration_days: int = Field(7, env="JWT_REFRESH_EXPIRATION_DAYS", ge=1)
    
    # CORS Configuration
    cors_allow_all_origins: bool = Field(False, env="CORS_ALLOW_ALL_ORIGINS")
    cors_allowed_origins: List[str] = Field([], env="CORS_ALLOWED_ORIGINS")
    cors_allow_credentials: bool = Field(True, env="CORS_ALLOW_CREDENTIALS")
    cors_allowed_methods: List[str] = Field(["GET", "POST", "PUT", "DELETE", "OPTIONS"], env="CORS_ALLOWED_METHODS")
    cors_allowed_headers: List[str] = Field(["*"], env="CORS_ALLOWED_HEADERS")
    cors_max_age: int = Field(3600, env="CORS_MAX_AGE", ge=0)
    
    # Rate Limiting
    rate_limit_enabled: bool = Field(True, env="RATE_LIMIT_ENABLED")
    auth_rate_limit_attempts: int = Field(5, env="AUTH_RATE_LIMIT_ATTEMPTS", ge=1)
    auth_rate_limit_window_minutes: int = Field(15, env="AUTH_RATE_LIMIT_WINDOW_MINUTES", ge=1)
    api_rate_limit_per_minute: int = Field(100, env="API_RATE_LIMIT_PER_MINUTE", ge=1)
    api_rate_limit_per_hour: int = Field(1000, env="API_RATE_LIMIT_PER_HOUR", ge=1)
    
    # Browser Automation
    browser_headless: bool = Field(True, env="BROWSER_HEADLESS")
    browser_timeout: int = Field(30000, env="BROWSER_TIMEOUT", ge=1000)
    browser_screenshot_dir: str = Field("data/screenshots", env="BROWSER_SCREENSHOT_DIR")
    browser_max_instances: int = Field(5, env="BROWSER_MAX_INSTANCES", ge=1)
    
    # Email Configuration
    smtp_enabled: bool = Field(False, env="SMTP_ENABLED")
    smtp_host: Optional[str] = Field(None, env="SMTP_HOST")
    smtp_port: int = Field(587, env="SMTP_PORT", ge=1, le=65535)
    smtp_username: Optional[str] = Field(None, env="SMTP_USERNAME")
    smtp_password: Optional[SecretStr] = Field(None, env="SMTP_PASSWORD")
    smtp_from: EmailStr = Field("noreply@fossawork.com", env="SMTP_FROM")
    smtp_tls: bool = Field(True, env="SMTP_TLS")
    smtp_ssl: bool = Field(False, env="SMTP_SSL")
    
    # Feature Flags
    enable_browser_automation: bool = Field(True, env="ENABLE_BROWSER_AUTOMATION")
    enable_email_notifications: bool = Field(True, env="ENABLE_EMAIL_NOTIFICATIONS")
    enable_pushover_notifications: bool = Field(True, env="ENABLE_PUSHOVER_NOTIFICATIONS")
    enable_schedule_detection: bool = Field(True, env="ENABLE_SCHEDULE_DETECTION")
    enable_filter_calculation: bool = Field(True, env="ENABLE_FILTER_CALCULATION")
    enable_security_monitoring: bool = Field(True, env="ENABLE_SECURITY_MONITORING")
    enable_audit_logging: bool = Field(True, env="ENABLE_AUDIT_LOGGING")
    
    # Secret Management
    secret_provider: SecretProvider = Field(SecretProvider.LOCAL, env="SECRET_PROVIDER")
    secret_rotation_enabled: bool = Field(False, env="SECRET_ROTATION_ENABLED")
    secret_rotation_interval_days: int = Field(90, env="SECRET_ROTATION_INTERVAL_DAYS", ge=1)
    
    @validator("cors_allowed_origins", pre=True)
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v
    
    @validator("secret_key", "fossawork_master_key")
    def validate_secrets(cls, v, field):
        if not v or len(v.get_secret_value()) < 32:
            raise ValueError(f"{field.name} must be at least 32 characters long")
        return v
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        
        @classmethod
        def customise_sources(
            cls,
            init_settings,
            env_settings,
            file_secret_settings,
        ):
            return (
                init_settings,
                env_settings,
                file_secret_settings,
            )


class ConfigurationManager:
    """
    Manages application configuration with support for:
    - Multiple environments
    - External secret providers
    - Configuration validation
    - Hot-reloading
    - Secret rotation
    """
    
    def __init__(
        self,
        env_file: Optional[str] = None,
        environment: Optional[Environment] = None,
        watch_changes: bool = False
    ):
        self.env_file = env_file or self._get_env_file(environment)
        self.environment = environment or self._detect_environment()
        self.watch_changes = watch_changes
        self._settings: Optional[Settings] = None
        self._secret_client = None
        self._observer = None
        self._encryption_key = None
        
        # Initialize configuration
        self.reload()
        
        # Setup file watching if enabled
        if self.watch_changes:
            self._setup_file_watcher()
    
    def _get_env_file(self, environment: Optional[Environment] = None) -> str:
        """Get environment file path based on environment"""
        env = environment or self._detect_environment()
        base_path = Path(__file__).parent.parent.parent
        
        env_files = {
            Environment.DEVELOPMENT: base_path / ".env.development",
            Environment.STAGING: base_path / ".env.staging",
            Environment.PRODUCTION: base_path / ".env.production",
            Environment.TESTING: base_path / ".env.testing",
        }
        
        env_file = env_files.get(env, base_path / ".env")
        
        # Fall back to default .env if specific file doesn't exist
        if not env_file.exists() and env_file != base_path / ".env":
            logger.warning(f"Environment file {env_file} not found, using default .env")
            env_file = base_path / ".env"
        
        return str(env_file)
    
    def _detect_environment(self) -> Environment:
        """Detect current environment from env var or hostname"""
        env_str = os.getenv("ENVIRONMENT", "").lower()
        
        if env_str in [e.value for e in Environment]:
            return Environment(env_str)
        
        # Try to detect from hostname
        hostname = os.getenv("HOSTNAME", "").lower()
        if "prod" in hostname:
            return Environment.PRODUCTION
        elif "staging" in hostname:
            return Environment.STAGING
        elif "test" in hostname:
            return Environment.TESTING
        
        return Environment.DEVELOPMENT
    
    def reload(self) -> None:
        """Reload configuration from files and external sources"""
        logger.info(f"Loading configuration for environment: {self.environment}")
        
        # Load base settings
        self._settings = Settings(_env_file=self.env_file)
        
        # Load secrets from external provider if configured
        if self._settings.secret_provider != SecretProvider.LOCAL:
            self._load_external_secrets()
        
        # Validate configuration
        self._validate_configuration()
        
        logger.info("Configuration loaded successfully")
    
    def _load_external_secrets(self) -> None:
        """Load secrets from external secret management service"""
        provider = self._settings.secret_provider
        
        if provider == SecretProvider.AWS_SECRETS_MANAGER:
            self._load_aws_secrets()
        elif provider == SecretProvider.HASHICORP_VAULT:
            self._load_vault_secrets()
        elif provider == SecretProvider.AZURE_KEYVAULT:
            self._load_azure_secrets()
        elif provider == SecretProvider.KUBERNETES_SECRET:
            self._load_k8s_secrets()
    
    def _load_aws_secrets(self) -> None:
        """Load secrets from AWS Secrets Manager"""
        try:
            session = boto3.session.Session()
            client = session.client('secretsmanager')
            
            secret_name = f"fossawork/{self.environment.value}"
            response = client.get_secret_value(SecretId=secret_name)
            
            secrets = json.loads(response['SecretString'])
            
            # Update settings with secrets
            for key, value in secrets.items():
                if hasattr(self._settings, key):
                    setattr(self._settings, key, value)
            
            logger.info("Successfully loaded secrets from AWS Secrets Manager")
        except Exception as e:
            logger.error(f"Failed to load AWS secrets: {e}")
            raise
    
    def _load_vault_secrets(self) -> None:
        """Load secrets from HashiCorp Vault"""
        try:
            vault_url = os.getenv("VAULT_URL", "http://localhost:8200")
            vault_token = os.getenv("VAULT_TOKEN")
            
            client = hvac.Client(url=vault_url, token=vault_token)
            
            if not client.is_authenticated():
                raise ValueError("Vault authentication failed")
            
            path = f"secret/data/fossawork/{self.environment.value}"
            response = client.secrets.kv.v2.read_secret_version(path=path)
            
            secrets = response['data']['data']
            
            # Update settings with secrets
            for key, value in secrets.items():
                if hasattr(self._settings, key):
                    setattr(self._settings, key, value)
            
            logger.info("Successfully loaded secrets from HashiCorp Vault")
        except Exception as e:
            logger.error(f"Failed to load Vault secrets: {e}")
            raise
    
    def _validate_configuration(self) -> None:
        """Validate configuration for the current environment"""
        errors = []
        
        # Production-specific validations
        if self.environment == Environment.PRODUCTION:
            if self._settings.debug:
                errors.append("Debug mode must be disabled in production")
            
            if self._settings.api_docs_enabled:
                errors.append("API documentation should be disabled in production")
            
            if self._settings.cors_allow_all_origins:
                errors.append("CORS must not allow all origins in production")
            
            if not self._settings.rate_limit_enabled:
                errors.append("Rate limiting must be enabled in production")
            
            if "sqlite" in self._settings.database_url:
                errors.append("SQLite is not suitable for production use")
        
        # General validations
        if self._settings.smtp_enabled and not self._settings.smtp_host:
            errors.append("SMTP host must be configured when email is enabled")
        
        if errors:
            error_msg = "Configuration validation failed:\n" + "\n".join(f"- {e}" for e in errors)
            logger.error(error_msg)
            raise ValueError(error_msg)
    
    def _setup_file_watcher(self) -> None:
        """Setup file watcher for configuration hot-reloading"""
        event_handler = ConfigFileHandler(self)
        self._observer = Observer()
        
        watch_path = Path(self.env_file).parent
        self._observer.schedule(event_handler, str(watch_path), recursive=False)
        self._observer.start()
        
        logger.info(f"Configuration file watcher started for: {watch_path}")
    
    def get_settings(self) -> Settings:
        """Get current settings instance"""
        if not self._settings:
            raise RuntimeError("Configuration not loaded")
        return self._settings
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key"""
        return getattr(self._settings, key, default)
    
    def set(self, key: str, value: Any) -> None:
        """Set configuration value (runtime only, not persisted)"""
        if hasattr(self._settings, key):
            setattr(self._settings, key, value)
        else:
            raise KeyError(f"Unknown configuration key: {key}")
    
    def rotate_secrets(self) -> Dict[str, str]:
        """Rotate application secrets"""
        if not self._settings.secret_rotation_enabled:
            raise RuntimeError("Secret rotation is not enabled")
        
        logger.info("Starting secret rotation")
        
        new_secrets = {
            "secret_key": secrets.token_urlsafe(32),
            "fossawork_master_key": secrets.token_urlsafe(32),
            "jwt_private_key": self._generate_rsa_keypair()
        }
        
        # Store new secrets based on provider
        if self._settings.secret_provider == SecretProvider.AWS_SECRETS_MANAGER:
            self._store_aws_secrets(new_secrets)
        elif self._settings.secret_provider == SecretProvider.HASHICORP_VAULT:
            self._store_vault_secrets(new_secrets)
        
        # Schedule old secret expiration
        expiration = datetime.utcnow() + timedelta(days=7)
        logger.info(f"Secret rotation complete. Old secrets expire at: {expiration}")
        
        return {
            "status": "success",
            "expiration": expiration.isoformat(),
            "rotated_keys": list(new_secrets.keys())
        }
    
    def _generate_rsa_keypair(self) -> Dict[str, str]:
        """Generate RSA key pair for JWT"""
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )
        
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        public_key = private_key.public_key()
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        return {
            "private": private_pem.decode(),
            "public": public_pem.decode()
        }
    
    def encrypt_value(self, value: str) -> str:
        """Encrypt a configuration value"""
        if not self._encryption_key:
            self._encryption_key = Fernet.generate_key()
        
        f = Fernet(self._encryption_key)
        return f.encrypt(value.encode()).decode()
    
    def decrypt_value(self, encrypted_value: str) -> str:
        """Decrypt a configuration value"""
        if not self._encryption_key:
            raise RuntimeError("Encryption key not initialized")
        
        f = Fernet(self._encryption_key)
        return f.decrypt(encrypted_value.encode()).decode()
    
    def export_config(self, include_secrets: bool = False) -> Dict[str, Any]:
        """Export current configuration as dictionary"""
        config = self._settings.dict()
        
        if not include_secrets:
            # Remove sensitive values
            secret_fields = [
                "secret_key", "fossawork_master_key", "database_url",
                "smtp_password", "pushover_app_token"
            ]
            for field in secret_fields:
                if field in config:
                    config[field] = "***REDACTED***"
        
        return config
    
    def health_check(self) -> Dict[str, Any]:
        """Perform configuration health check"""
        health = {
            "status": "healthy",
            "environment": self.environment.value,
            "configuration_loaded": self._settings is not None,
            "file_watcher_active": self._observer and self._observer.is_alive(),
            "secret_provider": self._settings.secret_provider.value if self._settings else None,
            "checks": []
        }
        
        # Check database connectivity
        if self._settings:
            if "postgresql" in self._settings.database_url:
                health["checks"].append({
                    "name": "database_config",
                    "status": "ok",
                    "type": "postgresql"
                })
            elif "sqlite" in self._settings.database_url:
                health["checks"].append({
                    "name": "database_config",
                    "status": "warning" if self.environment == Environment.PRODUCTION else "ok",
                    "type": "sqlite",
                    "message": "SQLite not recommended for production" if self.environment == Environment.PRODUCTION else None
                })
        
        return health
    
    def __del__(self):
        """Cleanup resources"""
        if self._observer and self._observer.is_alive():
            self._observer.stop()
            self._observer.join()


# Global configuration instance
_config_manager: Optional[ConfigurationManager] = None


def get_config_manager() -> ConfigurationManager:
    """Get or create global configuration manager instance"""
    global _config_manager
    
    if _config_manager is None:
        _config_manager = ConfigurationManager(
            watch_changes=os.getenv("CONFIG_WATCH_CHANGES", "false").lower() == "true"
        )
    
    return _config_manager


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return get_config_manager().get_settings()


# Convenience function for direct access
def config(key: str, default: Any = None) -> Any:
    """Get configuration value by key"""
    return get_config_manager().get(key, default)