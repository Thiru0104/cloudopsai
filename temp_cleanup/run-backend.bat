@echo off
echo 🚀 Starting CloudOpsAI Backend Locally...

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed or not in PATH.
    exit /b 1
)

:: Check if virtual environment exists
if not exist "backend\venv" (
    echo ⚠️ Virtual environment not found. Creating...
    python -m venv backend\venv
    if %errorlevel% neq 0 (
        echo ❌ Failed to create virtual environment.
        exit /b 1
    )
)

:: Activate virtual environment
echo 🔌 Activating virtual environment...
call backend\venv\Scripts\activate.bat

:: Install dependencies
echo 📦 Installing/Updating dependencies...
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies.
    exit /b 1
)

:: Set environment variables
set PYTHONPATH=%CD%\backend
set DATABASE_URL=postgresql+asyncpg://cloudopsai:cloudopsai123@localhost:5432/cloudopsai
set REDIS_URL=redis://localhost:6379

:: Application settings
set ENVIRONMENT=development
set DEBUG=true
set LOG_LEVEL=INFO
set SECRET_KEY=cloudopsai-super-secret-key-2024-change-in-production
set SESSION_SECRET=cloudopsai-session-secret-2024
set JWT_SECRET=cloudopsai-jwt-secret-2024

:: Start the application
echo 🟢 Starting Uvicorn server...
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

echo 🟡 Backend stopped.
