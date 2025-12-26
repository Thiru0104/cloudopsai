import asyncio
import os
import sys
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.models.user import User

# Add parent dir to path
sys.path.append(os.getcwd())

async def check_users():
    print("Checking users in database...")
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        
        if not users:
            print("No users found in database.")
        else:
            print(f"Found {len(users)} users:")
            for user in users:
                print(f" - ID: {user.id}, Email: {user.email}, Superuser: {user.is_superuser}, Active: {user.is_active}")

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(check_users())
