import asyncio
import os
import sys
sys.path.append(os.getcwd())
from passlib.context import CryptContext
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def check_and_reset():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print("Existing users:")
        for u in users:
            print(f"ID: {u.id}, Email: {u.email}, Username: {u.username}")
        
        admin_email = "admin@cloudopsai.com"
        result = await session.execute(select(User).where(User.email == admin_email))
        admin = result.scalar_one_or_none()
        
        if admin:
            print("Found admin user, resetting password to admin123")
            admin.hashed_password = pwd_context.hash("admin123")
            await session.commit()
            print("Password reset successfully.")
        else:
            print("Admin user not found. Let's create one.")
            new_user = User(
                email=admin_email,
                username="admin2", # Using admin2 to avoid username conflict
                full_name="System Admin",
                hashed_password=pwd_context.hash("admin123"),
                is_active=True,
                is_superuser=True,
                role="admin"
            )
            session.add(new_user)
            await session.commit()
            print("Admin user created successfully.")

asyncio.run(check_and_reset())
