from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
import os
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

# Storage paths (persist across reloads)
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
STORAGE_DIR = os.path.join(BACKEND_ROOT, "app", "storage")
EMAIL_CONFIG_PATH = os.path.join(STORAGE_DIR, "email_config.json")
EMAIL_SCHEDULES_PATH = os.path.join(STORAGE_DIR, "email_schedules.json")

os.makedirs(STORAGE_DIR, exist_ok=True)


class EmailConfig(BaseModel):
    smtpServer: str
    smtpPort: str = "587"
    smtpUsername: Optional[str] = None
    smtpPassword: Optional[str] = None
    fromEmail: EmailStr
    fromName: str = "NSG Tool Reports"
    enableTLS: bool = True


class EmailTestRequest(EmailConfig):
    testRecipient: EmailStr


class SendReportRequest(BaseModel):
    recipients: List[EmailStr]
    subject: Optional[str] = "NSG Tool Report"
    body: Optional[str] = "This is an auto-generated report from the NSG Tool."


def load_email_config() -> Dict[str, Any]:
    if os.path.exists(EMAIL_CONFIG_PATH):
        try:
            with open(EMAIL_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data
        except Exception as e:
            logger.error(f"Failed to read email config: {e}")
    return {}


def save_email_config(config: Dict[str, Any]) -> None:
    try:
        with open(EMAIL_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to write email config: {e}")
        raise HTTPException(status_code=500, detail="Failed to persist email configuration")


def send_email(config: Dict[str, Any], recipients: List[str], subject: str, body: str) -> None:
    smtp_server = config.get("smtpServer")
    smtp_port = int(config.get("smtpPort") or 587)
    smtp_username = config.get("smtpUsername")
    smtp_password = config.get("smtpPassword")
    from_email = config.get("fromEmail")
    from_name = config.get("fromName") or "NSG Tool Reports"
    enable_tls = bool(config.get("enableTLS", True))

    if not smtp_server or not from_email:
        raise HTTPException(status_code=400, detail="SMTP server and fromEmail are required")

    msg = MIMEMultipart()
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(smtp_server, smtp_port, timeout=20) as server:
            server.ehlo()
            if enable_tls:
                try:
                    server.starttls()
                    server.ehlo()
                except Exception as e:
                    logger.warning(f"TLS negotiation failed; continuing without TLS: {e}")
            if smtp_username and smtp_password:
                server.login(smtp_username, smtp_password)
            server.sendmail(from_email, recipients, msg.as_string())
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=401, detail="SMTP authentication failed - check username/password")
    except smtplib.SMTPConnectError:
        raise HTTPException(status_code=503, detail="SMTP connection failed - server unavailable")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        raise HTTPException(status_code=500, detail=f"Email send failed: {str(e)}")


@router.get("/email/config")
def get_email_config():
    """Return saved email configuration (excluding password)."""
    cfg = load_email_config() or {}
    if "smtpPassword" in cfg:
        cfg["smtpPassword"] = ""
    return cfg


@router.post("/email/config")
def save_email_configuration(config: EmailConfig):
    data = config.dict()
    save_email_config(data)
    return {"success": True, "message": "Email configuration saved"}


@router.post("/email/test")
def test_email_configuration(req: EmailTestRequest):
    """Send a test email using provided configuration to verify connectivity."""
    try:
        send_email(req.dict(), [req.testRecipient], "NSG Tool - Test Email", "Test email from NSG Tool notification settings.")
        return {"success": True, "message": f"Test email sent to {req.testRecipient}"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Email test failed: {e}")
        raise HTTPException(status_code=500, detail="Email test failed")


@router.get("/email/schedules")
def list_email_schedules():
    if os.path.exists(EMAIL_SCHEDULES_PATH):
        try:
            with open(EMAIL_SCHEDULES_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to read schedules: {e}")
    return {"schedules": []}


@router.post("/email/schedule")
def create_email_schedule(schedule: Dict[str, Any]):
    """Persist a simple schedule object; does not start workers."""
    existing: Dict[str, Any] = {"schedules": []}
    if os.path.exists(EMAIL_SCHEDULES_PATH):
        try:
            with open(EMAIL_SCHEDULES_PATH, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = {"schedules": []}

    schedule_id = str(len(existing.get("schedules", [])) + 1)
    schedule["id"] = schedule_id
    existing.setdefault("schedules", []).append(schedule)

    try:
        with open(EMAIL_SCHEDULES_PATH, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save schedule: {e}")
        raise HTTPException(status_code=500, detail="Failed to persist schedule")

    return {"success": True, "schedule": schedule}


@router.post("/email/send-report")
def send_report(req: SendReportRequest):
    cfg = load_email_config()
    if not cfg:
        raise HTTPException(status_code=400, detail="Email configuration not set")

    try:
        send_email(cfg, req.recipients, req.subject or "NSG Tool Report", req.body or "")
        return {"success": True, "message": f"Report sent to {', '.join(req.recipients)}"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Failed to send report: {e}")
        raise HTTPException(status_code=500, detail="Failed to send report")

