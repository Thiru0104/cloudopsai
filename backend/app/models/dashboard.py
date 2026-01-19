from sqlalchemy import Column, Integer, DateTime, JSON, String
from datetime import datetime
from app.core.database import Base

class DashboardSnapshot(Base):
    __tablename__ = "dashboard_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    data = Column(JSON, nullable=False)
    
    # Filter keys to allow caching different views
    subscription_id = Column(String(255), nullable=True, index=True)
    region = Column(String(100), nullable=True)
    resource_group = Column(String(255), nullable=True)
    vm_name = Column(String(255), nullable=True)
    time_range = Column(String(50), nullable=True)
