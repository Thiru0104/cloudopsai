from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.date import DateTrigger
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import logging
import asyncio
import json

from app.core.database import SyncSessionLocal
from app.models.backup import BackupSchedule
from app.services.azure_service import AzureService
# We can import AzureService here because we'll use it inside the function or it's already available
# But to avoid circular import issues if AzureService imports this, we might need to be careful.
# AzureService doesn't seem to import scheduler.

logger = logging.getLogger(__name__)

class SchedulerService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SchedulerService, cls).__new__(cls)
            cls._instance.scheduler = BackgroundScheduler()
            cls._instance.scheduler.start()
            logger.info("Scheduler started")
        return cls._instance

    def add_job(self, schedule_id: int):
        with SyncSessionLocal() as db:
            schedule = db.query(BackupSchedule).filter(BackupSchedule.id == schedule_id).first()
            if not schedule:
                return
            
            # Define the job function
            def backup_job():
                logger.info(f"Running scheduled backup: {schedule.name} (ID: {schedule.id})")
                
                async def perform_backup():
                    try:
                        # Initialize service
                        service = AzureService()
                        
                        # Get items to backup
                        items = schedule.selected_items
                        if isinstance(items, str):
                            try:
                                items = json.loads(items)
                            except:
                                items = [items]
                        
                        results = []
                        timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
                        
                        for item in items:
                            nsg_name = item
                            # If item is a dict or full ID, extract name
                            if isinstance(item, dict) and 'name' in item:
                                nsg_name = item['name']
                            elif isinstance(item, str) and '/' in item:
                                nsg_name = item.split('/')[-1]
                                
                            try:
                                logger.info(f"Backing up NSG: {nsg_name}")
                                # Get NSG details
                                nsg_data = await service.get_nsg(schedule.resource_group, nsg_name)
                                
                                if nsg_data:
                                    # Create backup
                                    backup_name_full = f"{schedule.name}_{nsg_name}_{timestamp}"
                                    result = await service.create_backup(
                                        nsg_data=nsg_data,
                                        backup_name=backup_name_full,
                                        container_name=schedule.container_name,
                                        backup_format=schedule.backup_format,
                                        storage_account_name=schedule.storage_account
                                    )
                                    if result:
                                        results.append(f"Success: {nsg_name}")
                                    else:
                                        results.append(f"Failed: {nsg_name}")
                                else:
                                    results.append(f"Not Found: {nsg_name}")
                            except Exception as e:
                                logger.error(f"Error backing up {nsg_name}: {e}")
                                results.append(f"Error {nsg_name}: {str(e)}")
                        
                        return results
                    except Exception as e:
                        logger.error(f"Fatal error in backup job: {e}")
                        return []

                try:
                    # Run async function in sync context
                    # Check if there is an existing loop
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_closed():
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                    except RuntimeError:
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                    
                    results = loop.run_until_complete(perform_backup())
                    # Do not close the loop if it's the main loop, but here it's likely a thread loop
                    # loop.close() 
                    
                    logger.info(f"Backup job completed. Results: {results}")
                    
                    # Update last_run in DB
                    # We need a new session here because the outer session might be closed or not thread-safe if passed
                    with SyncSessionLocal() as db_session:
                         current_schedule = db_session.query(BackupSchedule).filter(BackupSchedule.id == schedule.id).first()
                         if current_schedule:
                             current_schedule.last_run = datetime.utcnow()
                             # Update next run if it's not repeating? 
                             # APScheduler handles next firing time, but we might want to track it in DB
                             db_session.commit()

                except Exception as e:
                    logger.error(f"Backup job execution failed: {e}")

            # Add to scheduler
            trigger = None
            if schedule.frequency == 'daily':
                trigger = IntervalTrigger(days=1, start_date=schedule.start_time)
            elif schedule.frequency == 'weekly':
                trigger = IntervalTrigger(weeks=1, start_date=schedule.start_time)
            elif schedule.frequency == 'monthly':
                trigger = IntervalTrigger(days=30, start_date=schedule.start_time)
            elif schedule.frequency == 'once':
                trigger = DateTrigger(run_date=schedule.start_time)
            
            if trigger:
                job_id = f"backup_{schedule.id}"
                self.scheduler.add_job(
                    backup_job,
                    trigger,
                    id=job_id,
                    replace_existing=True
                )
                logger.info(f"Added job {job_id} for schedule {schedule.name} at {schedule.start_time}")

    def load_jobs_from_db(self):
        """Load all active schedules from DB on startup"""
        try:
            with SyncSessionLocal() as db:
                schedules = db.query(BackupSchedule).filter(BackupSchedule.status == 'active').all()
                for schedule in schedules:
                    self.add_job(schedule.id)
            logger.info(f"Loaded {len(schedules)} schedules from database")
        except Exception as e:
            logger.error(f"Failed to load schedules: {e}")

scheduler_service = SchedulerService()
