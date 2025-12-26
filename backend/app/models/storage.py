from pydantic import BaseModel
from typing import Optional, List

class StorageAccountReport(BaseModel):
    subscription_name: str
    subscription_id: str
    storage_account: str
    resource_group: str
    total_size_gb: float
    last_activity: str
    status: str
    sku: str
    location: str
    container_count: int
    archive_recommendation: str

class StorageReportResponse(BaseModel):
    report: List[StorageAccountReport]

class ContainerReport(BaseModel):
    subscription_name: str
    subscription_id: str
    storage_account: str
    resource_group: str
    location: str
    container_name: str
    total_size_gb: float
    last_activity: str
    status: str # Active/Inactive
    archive_recommendation: str
    blob_count: int

class ContainerReportResponse(BaseModel):
    report: List[ContainerReport]