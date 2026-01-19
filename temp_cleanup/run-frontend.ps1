# CloudOpsAI Frontend Local Development Script
# This script helps you run the frontend locally

Write-Host "Starting CloudOpsAI Frontend Locally..." -ForegroundColor Green

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js not found. Please install Node.js 18+ and try again." -ForegroundColor Red
    exit 1
}

# Check if npm is available
try {
    $npmVersion = npm --version
    Write-Host "npm found: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "npm not found. Please install npm and try again." -ForegroundColor Red
    exit 1
}

# Change to frontend directory
Set-Location frontend

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
    npm install --legacy-peer-deps
}

# Set environment variables for local development
$env:REACT_APP_API_URL = "http://localhost:8007"
$env:REACT_APP_WS_URL = "ws://localhost:8007/ws"
$env:NODE_ENV = "development"

Write-Host "Environment variables set" -ForegroundColor Green
Write-Host "API URL: $env:REACT_APP_API_URL" -ForegroundColor Cyan
Write-Host "WebSocket URL: $env:REACT_APP_WS_URL" -ForegroundColor Cyan

Write-Host "Starting Vite development server on http://localhost:4004" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow

# Start the Vite development server
npm run dev
