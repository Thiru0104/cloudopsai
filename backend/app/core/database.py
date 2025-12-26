from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import MetaData, create_engine
import logging
from typing import AsyncGenerator

from app.core.config import settings

logger = logging.getLogger(__name__)

# Convert PostgreSQL URL to async version if needed
def get_async_database_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url

# Create async engine
# SQLite doesn't support pool_size and max_overflow
if "sqlite" in settings.DATABASE_URL:
    engine = create_async_engine(
        get_async_database_url(settings.DATABASE_URL),
        echo=settings.DEBUG
    )
else:
    engine = create_async_engine(
        get_async_database_url(settings.DATABASE_URL),
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20
    )

# Create synchronous engine for services that need sync operations
# Convert async SQLite URL to sync SQLite URL
sync_database_url = settings.DATABASE_URL.replace("sqlite+aiosqlite://", "sqlite://")
if "sqlite" in settings.DATABASE_URL:
    sync_engine = create_engine(
        sync_database_url,
        echo=settings.DEBUG
    )
else:
    sync_engine = create_engine(
        sync_database_url,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20
    )

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Create synchronous session factory
SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    class_=Session,
    expire_on_commit=False
)

# Create base class for models
Base = declarative_base()

# Metadata for migrations
metadata = MetaData()


async def init_db():
    """Initialize database connection and create tables"""
    try:
        # Import all models here to ensure they are registered
        from app.models import user, nsg, agent
        
        # Create tables for async engine only
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency to get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            await session.close()


def get_sync_db() -> Session:
    """Get synchronous database session for services"""
    return SyncSessionLocal()


async def close_db():
    """Close database connections"""
    await engine.dispose()
    logger.info("Database connections closed")
