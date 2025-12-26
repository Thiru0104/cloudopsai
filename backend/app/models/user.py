from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base
import uuid


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(255))
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    role = Column(String(50), default="viewer")  # admin, analyst, viewer
    
    # Azure AD integration
    azure_ad_id = Column(String(255), unique=True, index=True)
    azure_ad_tenant_id = Column(String(255))
    
    # Profile information
    department = Column(String(100))
    job_title = Column(String(100))
    phone = Column(String(20))
    
    # Preferences
    preferences = Column(JSON, default={})
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))
    
    # Relationships
    # Note: Relationships to be added when corresponding models are implemented
    # audit_logs = relationship("AuditLog", back_populates="user")
    # created_backups = relationship("Backup", back_populates="created_by")
    # created_agents = relationship("Agent", back_populates="created_by")
    # created_remediations = relationship("Remediation", back_populates="created_by")
    
    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"
    
    @property
    def is_admin(self) -> bool:
        return self.role == "admin" or self.is_superuser
    
    @property
    def is_analyst(self) -> bool:
        return self.role == "analyst" or self.is_admin
    
    def can_access_resource(self, resource_type: str, action: str) -> bool:
        """Check if user has permission to perform action on resource type"""
        if self.is_admin:
            return True
        
        if self.role == "analyst":
            # Analysts can read all resources and modify NSGs/ASGs
            if action == "read":
                return True
            if action in ["create", "update", "delete"] and resource_type in ["nsg", "asg"]:
                return True
        
        if self.role == "viewer":
            # Viewers can only read resources
            return action == "read"
        
        return False
