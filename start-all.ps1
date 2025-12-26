# CloudOpsAI Complete Local Development Script
# This script starts the backend and frontend in separate windows

# Print header
Write-Host "Starting CloudOpsAI Platform Locally..." -ForegroundColor Green

# Check if Python is installed
if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# Check if Node.js is installed
if (-not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Node.js (npm) is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# Backend Setup
Write-Host "Setting up Backend..." -ForegroundColor Yellow

# Check if virtual environment exists
if (-not (Test-Path "backend/venv")) {
    Write-Host "Virtual environment not found. Creating..." -ForegroundColor Yellow
    python -m venv backend/venv
}

# Environment Variables for Backend
$env:PYTHONPATH = "$PWD/backend"
$env:DATABASE_URL = "postgresql+asyncpg://cloudopsai:cloudopsai123@localhost:5432/cloudopsai"
$env:ENVIRONMENT = "development"
$env:DEBUG = "true"
$env:LOG_LEVEL = "INFO"
$env:SECRET_KEY = "cloudopsai-super-secret-key-2024-change-in-production"
$env:SESSION_SECRET = "cloudopsai-session-secret-2024"
$env:JWT_SECRET = "cloudopsai-jwt-secret-2024"

# Start Backend in a new window
Write-Host "Starting Backend in new window..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& {
    Write-Host 'CloudOpsAI Backend' -ForegroundColor Cyan
    cd backend
    if (Test-Path venv/Scripts/Activate.ps1) { . venv/Scripts/Activate.ps1 }
    pip install -r requirements.txt
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}"

# Frontend Setup
Write-Host "Setting up Frontend..." -ForegroundColor Yellow

# Start Frontend in a new window
Write-Host "Starting Frontend in new window..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& {
    Write-Host 'CloudOpsAI Frontend' -ForegroundColor Cyan
    cd frontend
    npm install
    npm run dev
}"

Write-Host "CloudOpsAI Platform is starting..." -ForegroundColor Green
Write-Host "Backend will be at http://localhost:8000"
Write-Host "Frontend will be at http://localhost:3000"

