@echo off
echo Starting CloudOpsAI Frontend Locally...

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Please install Node.js 18+ and try again.
    pause
    exit /b 1
)

REM Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo npm not found. Please install npm and try again.
    pause
    exit /b 1
)

REM Change to frontend directory
cd frontend

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing npm dependencies...
    npm install --legacy-peer-deps
)

REM Set environment variables for local development
set REACT_APP_API_URL=http://localhost:8007
set REACT_APP_WS_URL=ws://localhost:8007/ws
set NODE_ENV=development

echo Environment variables set
echo API URL: %REACT_APP_API_URL%
echo WebSocket URL: %REACT_APP_WS_URL%

echo Starting React development server on http://localhost:3000
echo Press Ctrl+C to stop the server

REM Start the React development server
npm start
