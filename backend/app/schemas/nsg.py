from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime

# Base schemas
class NSGBase(BaseModel):
    name: str = Field(..., description="NSG name")
    resource_group: str = Field(..., description="Resource group name")
    region: str = Field(..., description="Azure region")
    subscription_id: str = Field(..., description="Azure subscription ID")

class NSGCreate(NSGBase):
    azure_id: str = Field(..., description="Azure resource ID")
    inbound_rules: List[Dict] = Field(default=[], description="Inbound security rules")
    outbound_rules: List[Dict] = Field(default=[], description="Outbound security rules")
    tags: Dict[str, str] = Field(default={}, description="Resource tags")

class NSGUpdate(BaseModel):
    inbound_rules: Optional[List[Dict]] = Field(None, description="Inbound security rules")
    outbound_rules: Optional[List[Dict]] = Field(None, description="Outbound security rules")
    tags: Optional[Dict[str, str]] = Field(None, description="Resource tags")
    is_active: Optional[bool] = Field(None, description="NSG active status")

class NSGResponse(NSGBase):
    id: int
    azure_id: str
    inbound_rules: List[Dict]
    outbound_rules: List[Dict]
    tags: Dict[str, str]
    is_active: bool
    compliance_score: int
    risk_level: str
    last_sync: Optional[datetime]
    last_backup: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Backup schemas
class BackupBase(BaseModel):
    backup_name: str = Field(..., description="Backup name")
    backup_type: str = Field(default="manual", description="Backup type")
    description: Optional[str] = Field(None, description="Backup description")

class BackupCreate(BackupBase):
    created_by: Optional[str] = Field(None, description="User who created the backup")

class BackupResponse(BackupBase):
    id: int
    nsg_id: int
    configuration: Dict[str, Any]
    blob_url: Optional[str]
    file_size: Optional[int]
    created_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Change schemas
class ChangeResponse(BaseModel):
    id: int
    nsg_id: int
    change_type: str
    previous_state: Optional[Dict[str, Any]]
    new_state: Optional[Dict[str, Any]]
    changes_summary: Optional[str]
    changed_by: Optional[str]
    changed_at: datetime
    change_reason: Optional[str]
    can_rollback: bool
    rollback_backup_id: Optional[int]

    class Config:
        from_attributes = True

# Golden Rule schemas
class GoldenRuleBase(BaseModel):
    name: str = Field(..., description="Golden rule name")
    description: Optional[str] = Field(None, description="Golden rule description")
    inbound_rules: List[Dict] = Field(default=[], description="Inbound rules template")
    outbound_rules: List[Dict] = Field(default=[], description="Outbound rules template")
    compliance_rules: Optional[Dict[str, Any]] = Field(None, description="Compliance rules")

class GoldenRuleCreate(GoldenRuleBase):
    created_by: Optional[str] = Field(None, description="User who created the golden rule")

class GoldenRuleResponse(GoldenRuleBase):
    id: int
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True

# Compliance Analysis schema
class ComplianceAnalysis(BaseModel):
    compliance_score: int = Field(..., description="Compliance score (0-100)")
    missing_rules: List[str] = Field(default=[], description="Missing rules from golden standard")
    extra_rules: List[str] = Field(default=[], description="Extra rules not in golden standard")
    recommendations: List[str] = Field(default=[], description="Compliance recommendations")
    risk_level: str = Field(..., description="Risk level (low, medium, high, critical)")

# Dashboard schemas
class DashboardStats(BaseModel):
    total_nsgs: int
    high_risk_nsgs: int
    compliant_nsgs: int
    recent_backups: int
    compliance_rate: float

class RecentActivity(BaseModel):
    id: int
    timestamp: Optional[datetime]
    user: Optional[str]
    action: str
    resource: str
    status: str

# API Response schemas
class MessageResponse(BaseModel):
    message: str
    details: Optional[Dict[str, Any]] = None

class ErrorResponse(BaseModel):
    error: str
    details: Optional[str] = None

# NSG Rule schemas
class NSGRule(BaseModel):
    name: str
    priority: int
    direction: str  # Inbound, Outbound
    access: str     # Allow, Deny
    protocol: str   # Tcp, Udp, Icmp, Esp, Ah, *
    source_port_range: Optional[str]
    destination_port_range: Optional[str]
    source_address_prefix: Optional[str]
    destination_address_prefix: Optional[str]

class NSGRuleCreate(NSGRule):
    pass

class NSGRuleUpdate(BaseModel):
    priority: Optional[int] = None
    access: Optional[str] = None
    protocol: Optional[str] = None
    source_port_range: Optional[str] = None
    destination_port_range: Optional[str] = None
    source_address_prefix: Optional[str] = None
    destination_address_prefix: Optional[str] = None

# Bulk operations
class BulkOperationRequest(BaseModel):
    nsg_ids: List[int]
    operation: str  # backup, restore, export, compliance_check
    parameters: Optional[Dict[str, Any]] = None

class BulkOperationResponse(BaseModel):
    operation_id: str
    status: str
    total_items: int
    successful_items: int
    failed_items: int
    errors: List[str] = []

# Search and filter schemas
class NSGSearchRequest(BaseModel):
    search_term: Optional[str] = None
    resource_group: Optional[str] = None
    region: Optional[str] = None
    risk_level: Optional[str] = None
    compliance_min: Optional[int] = None
    compliance_max: Optional[int] = None
    is_active: Optional[bool] = None
    tags: Optional[Dict[str, str]] = None

class NSGSearchResponse(BaseModel):
    items: List[NSGResponse]
    total_count: int
    page: int
    page_size: int
    has_next: bool
    has_previous: bool
