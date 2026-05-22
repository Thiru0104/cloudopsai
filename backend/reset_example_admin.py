import asyncio
import os
import sys
sys.path.append(os.getcwd())
from passlib.context import CryptContext
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def reset_example_admin():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == "admin@example.com"))
        admin = result.scalar_one_or_none()
        
        if admin:
            print("Found admin@example.com, resetting password to admin123")
            admin.hashed_password = pwd_context.hash("admin123")
            await session.commit()
            print("Password reset successfully.")
        else:
            print("User admin@example.com not found.")

asyncio.run(reset_example_admin())
