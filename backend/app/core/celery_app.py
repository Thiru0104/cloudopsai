from celery import Celery
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Create Celery app
celery_app = Celery(
    "cloudopsai",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.nsg_tasks",
        "app.tasks.backup_tasks", 
        "app.tasks.ai_tasks",
        "app.tasks.remediation_tasks",
        "app.tasks.monitoring_tasks"
    ]
)

# Celery configuration
celery_app.conf.update(
    # Task serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    
    # Task routing
    task_routes={
        "app.tasks.nsg_tasks.*": {"queue": "nsg"},
        "app.tasks.backup_tasks.*": {"queue": "backup"},
        "app.tasks.ai_tasks.*": {"queue": "ai"},
        "app.tasks.remediation_tasks.*": {"queue": "remediation"},
        "app.tasks.monitoring_tasks.*": {"queue": "monitoring"},
    },
    
    # Worker configuration
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_max_tasks_per_child=1000,
    
    # Result backend
    result_expires=3600,
    result_backend_transport_options={
        "master_name": "mymaster",
        "visibility_timeout": 3600,
    },
    
    # Beat schedule
    beat_schedule={
        "backup-nsgs-daily": {
            "task": "app.tasks.backup_tasks.scheduled_nsg_backup",
            "schedule": 86400.0,  # 24 hours
        },
        "cleanup-old-backups": {
            "task": "app.tasks.backup_tasks.cleanup_old_backups",
            "schedule": 604800.0,  # 7 days
        },
        "monitor-nsg-changes": {
            "task": "app.tasks.monitoring_tasks.monitor_nsg_changes",
            "schedule": 300.0,  # 5 minutes
        },
    },
    
    # Error handling
    task_reject_on_worker_lost=True,
    task_always_eager=False,
    
    # Logging
    worker_log_format="[%(asctime)s: %(levelname)s/%(processName)s] %(message)s",
    worker_task_log_format="[%(asctime)s: %(levelname)s/%(processName)s][%(task_name)s(%(task_id)s)] %(message)s",
)


@celery_app.task(bind=True)
def debug_task(self):
    """Debug task for testing"""
    logger.info(f"Request: {self.request!r}")


# Task error handling
@celery_app.task(bind=True, autoretry_for=(Exception,), retry_kwargs={'max_retries': 3})
def retry_task(self, *args, **kwargs):
    """Base task with retry logic"""
    try:
        # Task logic here
        pass
    except Exception as exc:
        logger.error(f"Task {self.name} failed: {exc}")
        raise self.retry(exc=exc, countdown=60)


# Health check task
@celery_app.task
def health_check():
    """Health check task for monitoring"""
    return {"status": "healthy", "timestamp": "2024-01-01T00:00:00Z"}


if __name__ == "__main__":
    celery_app.start()
