import asyncio
import logging
from app.core.database import init_db, AsyncSessionLocal
from app.models.user import User
from app.core.security import get_password_hash
from sqlalchemy import select

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed():
    try:
        logger.info("Initializing database...")
        await init_db()
        logger.info("Database initialized.")
        
        async with AsyncSessionLocal() as db:
            logger.info("Checking for admin user...")
            result = await db.execute(select(User).where(User.username == "admin"))
            user = result.scalar_one_or_none()
            
            if not user:
                logger.info("Creating admin user...")
                user = User(
                    email="admin@example.com",
                    username="admin",
                    hashed_password=get_password_hash("admin"),
                    full_name="Administrator",
                    role="admin",
                    is_superuser=True,
                    is_active=True
                )
                db.add(user)
                await db.commit()
                logger.info("Admin user created successfully.")
            else:
                logger.info("Admin user already exists.")
    except Exception as e:
        logger.error(f"Seeding failed: {e}")

if __name__ == "__main__":
    asyncio.run(seed())
