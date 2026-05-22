import asyncio
import logging
from app.core.database import init_db, AsyncSessionLocal
from app.models.user import User
from app.core.security import get_password_hash
from sqlalchemy import select

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def debug_users():
    try:
        async with AsyncSessionLocal() as db:
            logger.info("Listing all users:")
            result = await db.execute(select(User))
            users = result.scalars().all()
            for u in users:
                logger.info(f"User: id={u.id}, username='{u.username}', email='{u.email}', password_hash='{u.hashed_password}'")
            
            if not users:
                logger.info("No users found!")
                
                # Create admin if missing
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
                logger.info("Admin user created.")

    except Exception as e:
        logger.error(f"Debug failed: {e}")

if __name__ == "__main__":
    asyncio.run(debug_users())
