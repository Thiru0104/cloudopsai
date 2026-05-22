import asyncio
import logging
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.core.security import get_password_hash
from sqlalchemy import select

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def reset_password():
    try:
        async with AsyncSessionLocal() as db:
            logger.info("Finding admin user...")
            result = await db.execute(select(User).where(User.username == "admin"))
            user = result.scalar_one_or_none()
            
            if user:
                logger.info("Resetting password to 'admin123'...")
                user.hashed_password = get_password_hash("admin123")
                db.add(user)
                await db.commit()
                logger.info("Password reset successfully.")
            else:
                logger.error("Admin user not found!")
    except Exception as e:
        logger.error(f"Reset failed: {e}")

if __name__ == "__main__":
    asyncio.run(reset_password())
