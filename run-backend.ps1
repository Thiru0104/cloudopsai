# CloudOpsAI Backend Local Development Script

# Print header
Write-Host "Starting CloudOpsAI Backend Locally..." -ForegroundColor Green

# Check if Python is installed
if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
$venvPython = "$PSScriptRoot\backend\venv\Scripts\python.exe"

if (-not (Test-Path "backend\venv")) {
    Write-Host "Virtual environment not found. Creating..." -ForegroundColor Yellow
    python -m venv backend/venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create virtual environment." -ForegroundColor Red
        exit 1
    }
}

if (-not (Test-Path $venvPython)) {
     # Try Linux/Mac path if Windows path fails (though we are on Windows)
    $venvPython = "$PSScriptRoot/backend/venv/bin/python"
}

if (-not (Test-Path $venvPython)) {
    Write-Host "Could not find python executable in venv." -ForegroundColor Red
    exit 1
}

# Install dependencies if requirements.txt has changed
# For simplicity, we'll just try to install/upgrade
Write-Host "Installing/Updating dependencies..." -ForegroundColor Yellow
# & $venvPython -m pip install --upgrade pip wheel setuptools
& $venvPython -m pip install -r backend/requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to install dependencies." -ForegroundColor Red
    exit 1
}

# Set environment variables for local development
$env:PYTHONPATH = "$PWD/backend"
# Use PostgreSQL by default (commented out to use SQLite if preferred)
# $env:DATABASE_URL = "postgresql+asyncpg://cloudopsai:cloudopsai123@localhost:5432/cloudopsai"

# If you want to use SQLite instead, uncomment below:
$env:DATABASE_URL = "sqlite+aiosqlite:///./sql_app.db"
if (-not (Test-Path "backend/sql_app.db")) {
    Write-Host "Using SQLite database at ./backend/sql_app.db" -ForegroundColor Yellow
}

# Application settings
$env:ENVIRONMENT = "development"
$env:DEBUG = "true"
$env:LOG_LEVEL = "INFO"
$env:SECRET_KEY = "cloudopsai-super-secret-key-2024-change-in-production"
$env:SESSION_SECRET = "cloudopsai-session-secret-2024"
$env:JWT_SECRET = "cloudopsai-jwt-secret-2024"

# Run database migrations (if using Alembic)
# Write-Host "Running database migrations..." -ForegroundColor Yellow
# alembic upgrade head

# Start the application using uvicorn directly
Write-Host "Starting Uvicorn server..." -ForegroundColor Green
cd backend
& $venvPython -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8007

# Cleanup on exit
Write-Host "Backend stopped." -ForegroundColor Yellow

