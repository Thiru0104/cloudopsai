# CloudOpsAI Local Development Guide

This guide explains how to run the CloudOpsAI platform locally with the backend running outside of Docker for easier development and debugging.

## 🏗️ Architecture

- **Backend**: FastAPI running locally on port 8007
- **Frontend**: React running in Docker on port 3001
- **Database**: PostgreSQL running in Docker on port 5432
- **Cache**: Redis running in Docker on port 6379

## 📋 Prerequisites

1. **Python 3.11+** installed on your system
2. **Docker Desktop** running
3. **Git** for version control

## 🚀 Quick Start

### 1. Start Database Services

```powershell
# Start PostgreSQL and Redis in Docker
docker-compose up postgres redis -d
```

### 2. Run Backend Locally

**Option A: Using PowerShell Script (Recommended)**
```powershell
.\run-backend.ps1
```

**Option B: Using Batch File**
```cmd
run-backend.bat
```

**Option C: Manual Setup**
```powershell
# Create virtual environment
py -m venv backend/venv

# Activate virtual environment
backend/venv/Scripts/Activate.ps1

# Install dependencies
py -m pip install -r backend/requirements.txt

# Set environment variables (see .env file)
# Then run the server
py -m uvicorn app.main:app --host 0.0.0.0 --port 8007 --reload
```

### 3. Run Frontend Locally

**Option A: Using PowerShell Script (Recommended)**
```powershell
.\run-frontend.ps1
```

**Option B: Using Batch File**
```cmd
run-frontend.bat
```

**Option C: Manual Setup**
```powershell
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Set environment variables
$env:REACT_APP_API_URL = "http://localhost:8007"
$env:REACT_APP_WS_URL = "ws://localhost:8007/ws"

# Start development server
npm start
```

## 🌐 Access Points

- **Backend API**: http://localhost:8007
- **API Documentation**: http://localhost:8007/docs
- **Frontend**: http://localhost:3000
- **Database**: localhost:5432
- **Redis**: localhost:6379

## 🔧 Development Workflow

### Backend Development

1. **Code Changes**: Edit files in `backend/app/`
2. **Auto-reload**: Server automatically restarts on file changes
3. **Logs**: View logs in the terminal where you started the backend
4. **Debugging**: Use VS Code debugger or print statements

### Database Management

```powershell
# View database logs
docker-compose logs postgres

# Connect to database
docker-compose exec postgres psql -U cloudopsai -d cloudopsai

# Reset database
docker-compose down
docker volume rm nsg-tool-01_postgres_data
docker-compose up postgres redis -d
```

### Environment Variables

Key environment variables are set in the run scripts:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `AZURE_*`: Azure service principal credentials
- `SECRET_KEY`, `SESSION_SECRET`, `JWT_SECRET`: Security keys

## 🐛 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```powershell
   # Check what's using port 8007
   netstat -ano | findstr :8007
   
   # Kill the process
   taskkill /PID <PID> /F
   ```

2. **Database Connection Failed**
   ```powershell
   # Check if PostgreSQL is running
   docker-compose ps
   
   # Restart database services
   docker-compose restart postgres redis
   ```

3. **Python Dependencies Issues**
   ```powershell
   # Recreate virtual environment
   Remove-Item -Recurse -Force backend/venv
   py -m venv backend/venv
   backend/venv/Scripts/Activate.ps1
   py -m pip install -r backend/requirements.txt
   ```

4. **Azure SDK Issues**
   - Verify Azure credentials in `.env` file
   - Check if Azure resources are accessible
   - Test with Azure CLI: `az login`

### Debug Mode

The backend runs in debug mode by default. You can:
- View detailed error messages
- Use interactive debugger
- Access detailed API documentation

## 📁 Project Structure

```
cloudopsai/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Configuration, database
│   │   ├── models/         # SQLAlchemy models
│   │   └── main.py         # FastAPI application
│   ├── requirements.txt    # Python dependencies
│   └── venv/              # Virtual environment (created)
├── frontend/               # React frontend
├── docker-compose.yml      # Database services
├── run-backend.ps1         # Backend startup script
├── run-backend.bat         # Alternative startup script
└── .env                    # Environment variables
```

## 🔄 Integration with Azure

When ready to integrate with Azure:

1. **Update Environment Variables**: Modify `.env` file with production Azure settings
2. **Database Migration**: Use Alembic for database schema changes
3. **Deployment**: Use Azure Container Instances or Azure App Service
4. **Monitoring**: Add Azure Application Insights

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Azure SDK for Python](https://docs.microsoft.com/en-us/azure/developer/python/)
- [SQLAlchemy Async Documentation](https://docs.sqlalchemy.org/en/14/orm/extensions/asyncio.html)
- [React Development](https://react.dev/)

## 🆘 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs in the terminal
3. Verify all prerequisites are installed
4. Ensure Docker Desktop is running


