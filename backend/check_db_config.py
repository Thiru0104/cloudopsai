import sys
import os

# Add the current directory to sys.path so we can import app
sys.path.append(os.getcwd())

from app.core.config import settings

print(f"DATABASE_URL: {settings.DATABASE_URL}")
