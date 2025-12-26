from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
import os
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
STORAGE_DIR = os.path.join(BACKEND_ROOT, "app", "storage")
NOTIFICATION_PATH = os.path.join(STORAGE_DIR, "notification_settings.json")
SECURITY_PATH = os.path.join(STORAGE_DIR, "security_settings.json")

os.makedirs(STORAGE_DIR, exist_ok=True)


class NotificationSettings(BaseModel):
    securityAlerts: bool = True
    systemUpdates: bool = True
    backupStatus: bool = True


class SecuritySettings(BaseModel):
    twoFactorAuth: bool = False
    sessionTimeout: str = "30m"  # values like 30m, 1h, 4h
    passwordPolicy: bool = True
    auditLogging: bool = True


def load_json(path: str, default: Dict[str, Any]) -> Dict[str, Any]:
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read {path}: {e}")
    return default


def save_json(path: str, data: Dict[str, Any]) -> None:
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to write {path}: {e}")
        raise HTTPException(status_code=500, detail="Failed to persist settings")


@router.get("/settings/notifications")
def get_notifications():
    return load_json(NOTIFICATION_PATH, NotificationSettings().dict())


@router.post("/settings/notifications")
def save_notifications(settings: NotificationSettings):
    save_json(NOTIFICATION_PATH, settings.dict())
    return {"success": True, "message": "Notification settings saved"}


@router.get("/settings/security")
def get_security():
    return load_json(SECURITY_PATH, SecuritySettings().dict())


@router.post("/settings/security")
def save_security(settings: SecuritySettings):
    save_json(SECURITY_PATH, settings.dict())
    return {"success": True, "message": "Security settings saved"}

