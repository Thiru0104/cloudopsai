from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    model_config = {"extra": "allow", "env_file": ".env", "case_sensitive": True}
    
    # Application
    APP_NAME: str = "CloudOpsAI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    
    # Security
    SECRET_KEY: str
    SESSION_SECRET: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION: int = 3600
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8000"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Convert comma-separated CORS_ORIGINS string to list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    # Database
    DATABASE_URL: str
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # Azure Configuration
    AZURE_TENANT_ID: str
    AZURE_CLIENT_ID: str
    AZURE_CLIENT_SECRET: str
    AZURE_SUBSCRIPTION_ID: str
    AZURE_KEY_VAULT_URL: str
    
    # Azure Authentication
    # Use managed identity by default in cloud (can be overridden by env)
    AZURE_USE_SERVICE_PRINCIPAL: bool = False
    AZURE_DEFAULT_RESOURCE_GROUP: Optional[str] = None
    AZURE_DEFAULT_REGION: str = "eastus"
    
    # Azure Resource Management
    AZURE_ENABLE_MULTI_SUBSCRIPTION: bool = True
    AZURE_CACHE_SUBSCRIPTIONS: bool = True
    AZURE_CACHE_TTL_MINUTES: int = 30
    
    # Azure Storage
    AZURE_STORAGE_CONNECTION_STRING: Optional[str] = None
    AZURE_STORAGE_CONTAINER_NAME: str = "cloudopsai-reports"
    
    # AI Models
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    AZURE_OPENAI_ENDPOINT: Optional[str] = None
    AZURE_OPENAI_API_KEY: Optional[str] = None
    
    # Email
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    
    # Monitoring
    PROMETHEUS_ENDPOINT: Optional[str] = None
    JAEGER_ENDPOINT: Optional[str] = None
    
    # Backup Configuration
    BACKUP_RETENTION_DAYS: int = 30
    BACKUP_SCHEDULE: str = "0 2 * * *"  # Daily at 2 AM
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60
    
    # File Upload
    MAX_FILE_SIZE: int = 10485760  # 10MB
    ALLOWED_FILE_TYPES: str = ".pdf,.doc,.docx,.txt,.csv,.json"
    
    # Frontend URLs
    REACT_APP_API_URL: str = "http://localhost:8000"
    REACT_APP_WS_URL: str = "ws://localhost:8000/ws"


# Create settings instance
settings = Settings()


# Validate required settings
def validate_settings():
    """Validate that required settings are present, based on auth mode"""
    # Always required
    required_settings = [
        "SECRET_KEY",
        "DATABASE_URL",
        "AZURE_SUBSCRIPTION_ID",
    ]

    # Additional requirements only when using a service principal
    if settings.AZURE_USE_SERVICE_PRINCIPAL:
        required_settings += [
            "AZURE_TENANT_ID",
            "AZURE_CLIENT_ID",
            "AZURE_CLIENT_SECRET",
        ]

    missing_settings = []
    for setting in required_settings:
        value = getattr(settings, setting, None)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing_settings.append(setting)

    if missing_settings:
        raise ValueError(f"Missing required settings: {', '.join(missing_settings)}")


# Validate settings on import
validate_settings()

