from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import json

from app.core.database import Base

class NSG(Base):
    __tablename__ = "nsgs"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    resource_group = Column(String(255), nullable=False)
    region = Column(String(100), nullable=False)
    subscription_id = Column(String(255), nullable=False)
    azure_id = Column(String(500), unique=True, nullable=False)
    
    # Configuration
    inbound_rules = Column(JSON, default=list)
    outbound_rules = Column(JSON, default=list)
    tags = Column(JSON, default=dict)
    
    # Status and monitoring
    is_active = Column(Boolean, default=True)
    compliance_score = Column(Integer, default=0)
    risk_level = Column(String(50), default='low')  # low, medium, high, critical
    last_sync = Column(DateTime, default=datetime.utcnow)
    last_backup = Column(DateTime, nullable=True)
    
    # Audit trail
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    backups = relationship("NSGBackup", back_populates="nsg")
    changes = relationship("NSGChange", back_populates="nsg")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "resource_group": self.resource_group,
            "region": self.region,
            "subscription_id": self.subscription_id,
            "azure_id": self.azure_id,
            "inbound_rules": self.inbound_rules or [],
            "outbound_rules": self.outbound_rules or [],
            "tags": self.tags or {},
            "is_active": self.is_active,
            "compliance_score": self.compliance_score,
            "risk_level": self.risk_level,
            "last_sync": self.last_sync.isoformat() if self.last_sync else None,
            "last_backup": self.last_backup.isoformat() if self.last_backup else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class NSGBackup(Base):
    __tablename__ = "nsg_backups"
    
    id = Column(Integer, primary_key=True, index=True)
    nsg_id = Column(Integer, ForeignKey("nsgs.id"), nullable=False)
    backup_name = Column(String(255), nullable=False)
    backup_type = Column(String(50), default='manual')  # manual, scheduled, golden_rule
    
    # Backup data
    configuration = Column(JSON, nullable=False)
    blob_url = Column(String(1000), nullable=True)
    file_size = Column(Integer, nullable=True)
    
    # Metadata
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    description = Column(Text, nullable=True)
    
    # Relationships
    nsg = relationship("NSG", back_populates="backups")
    
    def to_dict(self):
        return {
            "id": self.id,
            "nsg_id": self.nsg_id,
            "backup_name": self.backup_name,
            "backup_type": self.backup_type,
            "configuration": self.configuration,
            "blob_url": self.blob_url,
            "file_size": self.file_size,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "description": self.description
        }

class NSGChange(Base):
    __tablename__ = "nsg_changes"
    
    id = Column(Integer, primary_key=True, index=True)
    nsg_id = Column(Integer, ForeignKey("nsgs.id"), nullable=False)
    change_type = Column(String(50), nullable=False)  # create, update, delete, backup, restore
    
    # Change details
    previous_state = Column(JSON, nullable=True)
    new_state = Column(JSON, nullable=True)
    changes_summary = Column(Text, nullable=True)
    
    # Audit info
    changed_by = Column(String(255), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow)
    change_reason = Column(Text, nullable=True)
    
    # Rollback info
    can_rollback = Column(Boolean, default=True)
    rollback_backup_id = Column(Integer, ForeignKey("nsg_backups.id"), nullable=True)
    
    # Relationships
    nsg = relationship("NSG", back_populates="changes")
    
    def to_dict(self):
        return {
            "id": self.id,
            "nsg_id": self.nsg_id,
            "change_type": self.change_type,
            "previous_state": self.previous_state,
            "new_state": self.new_state,
            "changes_summary": self.changes_summary,
            "changed_by": self.changed_by,
            "changed_at": self.changed_at.isoformat() if self.changed_at else None,
            "change_reason": self.change_reason,
            "can_rollback": self.can_rollback,
            "rollback_backup_id": self.rollback_backup_id
        }

class GoldenRule(Base):
    __tablename__ = "golden_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    
    # Rule configuration
    inbound_rules = Column(JSON, nullable=False, default=list)
    outbound_rules = Column(JSON, nullable=False, default=list)
    compliance_rules = Column(JSON, nullable=True)
    
    # Metadata
    created_by = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "inbound_rules": self.inbound_rules or [],
            "outbound_rules": self.outbound_rules or [],
            "compliance_rules": self.compliance_rules or {},
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_active": self.is_active
        }
