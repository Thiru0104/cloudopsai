from sqlalchemy import Column, Integer, String, DateTime, JSON, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class BackupSchedule(Base):
    __tablename__ = "backup_schedules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    frequency = Column(String)  # daily, weekly, monthly, custom
    start_time = Column(DateTime(timezone=True))
    next_run = Column(DateTime(timezone=True), nullable=True)
    last_run = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="active")  # active, paused, error
    
    # Configuration
    resource_type = Column(String)  # nsg, asg, both
    subscription_id = Column(String)
    resource_group = Column(String, nullable=True)
    selected_items = Column(JSON)  # List of NSG/ASG names or IDs
    storage_account = Column(String)
    container_name = Column(String)
    backup_format = Column(String)  # json, csv, both
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
