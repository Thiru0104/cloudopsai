from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict, Any
import time
import os
from urllib.parse import urlparse

from app.core.config import settings
from app.core.database import get_db
from app.main import APP_START_TIME

router = APIRouter()


def _format_uptime(seconds: float) -> str:
    seconds = int(seconds)
    days, seconds = divmod(seconds, 86400)
    hours, seconds = divmod(seconds, 3600)
    minutes, seconds = divmod(seconds, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    parts.append(f"{seconds}s")
    return " ".join(parts)


def _dir_size_info(path: str) -> Dict[str, Any]:
    total_size = 0
    file_count = 0
    if os.path.isdir(path):
        for root, _, files in os.walk(path):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    total_size += os.path.getsize(fp)
                    file_count += 1
                except OSError:
                    # Skip files that cannot be accessed
                    continue
    return {"path": path, "total_size_bytes": total_size, "file_count": file_count}


def _parse_database_url(url: str) -> Dict[str, Any]:
    parsed = urlparse(url.replace("+asyncpg", ""))
    # Remove credentials from exposure
    database = parsed.path.lstrip("/") if parsed.path else ""
    return {
        "type": parsed.scheme,
        "host": parsed.hostname or "",
        "port": parsed.port or "",
        "database": database,
    }


@router.get("/info")
async def system_info(db: AsyncSession = Depends(get_db)) -> Dict[str, Any]:
    """Return real system information: version, uptime, database details, storage sizes."""
    now = time.time()
    uptime_seconds = now - APP_START_TIME

    # Database details
    db_details = _parse_database_url(settings.DATABASE_URL)
    db_connected = True
    db_size_bytes = None
    db_error = None

    try:
        if db_details["type"].startswith("postgresql"):
            # Use PostgreSQL function to get current database size
            result = await db.execute(text("SELECT pg_database_size(current_database())"))
            row = result.fetchone()
            if row and row[0] is not None:
                db_size_bytes = int(row[0])
        elif db_details["type"].startswith("sqlite"):
            # Attempt to derive file path from URL
            # Typical forms: sqlite+aiosqlite:///./cloudopsai.db or sqlite:///absolute/path.db
            url_no_driver = settings.DATABASE_URL.replace("sqlite+aiosqlite://", "sqlite://")
            parsed_sqlite = urlparse(url_no_driver)
            db_path = parsed_sqlite.path
            if db_path.startswith("/"):
                # Absolute path
                sqlite_path = db_path
            else:
                # Relative path (prefix may be . or ./)
                sqlite_path = os.path.join(os.getcwd(), db_path)
            try:
                if os.path.isfile(sqlite_path):
                    db_size_bytes = os.path.getsize(sqlite_path)
            except OSError:
                pass
    except Exception as e:
        db_connected = False
        db_error = str(e)

    # Storage: compute actual sizes
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
    backups_dir = os.path.join(root_dir, "backend", "backups")
    logs_dir = os.path.join(root_dir, "backend", "logs")

    storage_info = {
        "backups": _dir_size_info(backups_dir),
        "logs": _dir_size_info(logs_dir),
    }

    return {
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": int(uptime_seconds),
        "uptime": _format_uptime(uptime_seconds),
        "database": {
            **db_details,
            "connected": db_connected,
            "size_bytes": db_size_bytes,
            "error": db_error,
        },
        "storage": storage_info,
    }


