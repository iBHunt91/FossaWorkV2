"""
Application Configuration
"""

import os


class Settings:
    """Application settings"""
    
    # Database
    database_url: str = "sqlite:///./fossawork_v2.db"
    
    # Security
    secret_key: str = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")
    
    # API
    api_v1_str: str = "/api/v1"
    
    # CORS
    backend_cors_origins: list = ["http://localhost:5173", "http://localhost:3000"]
    
    # Environment
    environment: str = os.getenv("ENVIRONMENT", "development")
    debug: bool = environment == "development"
    
    # Monitoring
    health_check_interval: int = 30  # seconds
    metrics_retention_days: int = 7


settings = Settings()