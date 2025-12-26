import asyncio
import os
import sys
from passlib.context import CryptContext
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, engine, Base
from app.models.user import User

# Add parent dir to path if needed
sys.path.append(os.getcwd())

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    print("Connecting to database...")
    try:
        # Create tables
        print("Creating tables if they don't exist...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Tables created.")

        async with AsyncSessionLocal() as session:
            # Check if user exists
            print("Checking for existing admin user...")
            result = await session.execute(select(User).where(User.email == "admin@cloudopsai.com"))
            user = result.scalar_one_or_none()
            
            if user:
                print("Admin user already exists.")
                return

            print("Creating admin user...")
            hashed_password = pwd_context.hash("admin123")
            new_user = User(
                email="admin@cloudopsai.com",
                username="admin",
                full_name="System Admin",
                hashed_password=hashed_password,
                is_active=True,
                is_superuser=True,
                role="admin"
            )
            session.add(new_user)
            await session.commit()
            print("Admin user created successfully.")
    except Exception as e:
        print(f"Error creating admin user: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(create_admin())


