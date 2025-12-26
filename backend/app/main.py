from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
import logging
import asyncio
import time
import os
from typing import Dict, Any

from app.core.config import settings
from app.core.database import init_db
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI application
app = FastAPI(
    title="CloudOpsAI - Azure NSG/ASG Management Platform",
    description="Enterprise-grade Azure Network Security Group and Application Security Group management platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Track application start time for accurate uptime
APP_START_TIME = time.time()

from app.api.v1.api import api_router

# Security middleware
# (Proxy headers are handled by Uvicorn flags in container start command)
# app.add_middleware(HTTPSRedirectMiddleware)  # redirect HTTP -> HTTPS

# HSTS & security headers
class HSTSMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

app.add_middleware(HSTSMiddleware)

# CORS middleware (configurable via env)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api/v1")

# Mount static files if they exist (for React frontend)
static_dir = "/app/static"
if os.path.exists(static_dir):
    # Mount assets directory
    assets_dir = os.path.join(static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

# Startup event to initialize database
@app.on_event("startup")
async def startup_event():
    """Initialize database on startup without failing the app"""
    try:
        await asyncio.wait_for(init_db(), timeout=5)
    except Exception as e:
        logger.error(f"Startup DB init failed: {e}")
    except asyncio.TimeoutError:
        logger.warning("Startup DB init timed out; continuing without DB")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "nsg-tool-backend", "version": "1.0.4-relative-path"}

@app.get("/api/info")
async def api_info():
    """API information endpoint"""
    return {
        "name": "CloudOpsAI API",
        "version": "1.0.0",
        "description": "Azure NSG/ASG Management Platform with AI Agents",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "api_info": "/api/info",
            "frontend": "/app",
            "nsgs": "/api/v1/nsgs",
            "agents": "/api/v1/agents",
            "agent_models": "/api/v1/agents/models",
            "remediation_plans": "/api/v1/agents/remediation-plans"
        },
        "features": [
            "AI Agent Management",
            "NSG Analysis & Remediation",
            "Multiple AI Model Support",
            "Real-time Agent Monitoring",
            "Automated Remediation Plans"
        ]
    }

@app.get("/api/test-network")
def test_network():
    """Test network connectivity from the container"""
    results = {}
    try:
        # Test Azure Login (critical for auth)
        resp = requests.get("https://login.microsoftonline.com", timeout=5)
        results["azure_login"] = {"status": resp.status_code, "reason": resp.reason}
    except Exception as e:
        results["azure_login"] = {"error": str(e)}
        
    try:
        # Test Google (general internet)
        resp = requests.get("https://google.com", timeout=5)
        results["google"] = {"status": resp.status_code, "reason": resp.reason}
    except Exception as e:
        results["google"] = {"error": str(e)}
        
    return results

# SPA Catch-all handler
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve React App for any other path (SPA support)"""
    # If path starts with api, return 404 because it should have been caught by api_router
    if full_path.startswith("api/"):
        return {"detail": "Not Found"}
        
    # Check if we have the static build
    if os.path.exists(static_dir):
        # Serve index.html
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
            
    # Fallback if no frontend build found
    return {
        "message": "Welcome to CloudOpsAI - Azure NSG/ASG Management Platform",
        "detail": "Frontend not found. Please ensure the frontend is built and mounted at /app/static",
        "version": "1.0.0",
        "docs": "/docs"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9010)









