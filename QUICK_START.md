# CloudOpsAI Quick Start Guide

## 🚀 Local Development

### Option 1: Start Everything at Once (Recommended)
```powershell
.\start-all.ps1
```
This starts: Backend + Frontend + Database Services

### Option 2: Start Services Individually

#### Start Database Services Only
```powershell
docker-compose up postgres redis -d
```

#### Start Backend Only
```powershell
.\run-backend.ps1
```

#### Start Frontend Only
```powershell
.\run-frontend.ps1
```

### Option 3: Manual Setup

#### Backend
```powershell
cd backend
py -m venv venv
venv\Scripts\Activate.ps1
py -m pip install -r requirements-minimal.txt
py -m uvicorn app.main:app --host 0.0.0.0 --port 8007 --reload
```

#### Frontend
```powershell
cd frontend
npm install --legacy-peer-deps
npm start
```

## 🌐 Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | React application |
| Backend API | http://localhost:8007 | FastAPI backend |
| API Docs | http://localhost:8007/docs | Interactive API documentation |
| Database | localhost:5432 | PostgreSQL database |
| Redis | localhost:6379 | Redis cache |

## 📋 Prerequisites

- **Python 3.11+** with `py` launcher
- **Node.js 18+** with npm
- **Docker Desktop** running
- **Git** for version control

## 🔧 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```powershell
   netstat -ano | findstr :8007
   taskkill /PID <PID> /F
   ```

2. **Docker Not Running**
   - Start Docker Desktop
   - Wait for it to fully initialize

3. **Python Dependencies**
   ```powershell
   Remove-Item -Recurse -Force backend/venv
   py -m venv backend/venv
   backend/venv/Scripts/Activate.ps1
   py -m pip install -r backend/requirements-minimal.txt
   ```

4. **Node.js Dependencies**
   ```powershell
   cd frontend
   Remove-Item -Recurse -Force node_modules
   npm install --legacy-peer-deps
   ```

## ☁️ Azure Cloud Deployment

### Quick Deployment Steps

1. **Setup Azure Infrastructure**
   ```bash
   # Follow AZURE_DEPLOYMENT.md for detailed steps
   az login
   az group create --name cloudopsai-prod-rg --location eastus
   ```

2. **Deploy Backend**
   ```bash
   az acr build --registry cloudopsaiacr --image cloudopsai-backend:latest ./backend
   az container create --resource-group cloudopsai-prod-rg --name cloudopsai-backend --image cloudopsaiacr.azurecr.io/cloudopsai-backend:latest
   ```

3. **Deploy Frontend**
   ```bash
   cd frontend
   npm run build
   az storage blob upload-batch --account-name cloudopsaistorage --source ./build --destination '$web'
   ```

### Production Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Azure CDN     │    │  Azure Front    │    │  Azure          │
│   (Frontend)    │◄──►│   Door (WAF)    │◄──►│  Container      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │  Azure Redis    │    │  Azure          │
                       │    Cache        │    │  Database for   │
                       └─────────────────┘    │  PostgreSQL     │
                                              └─────────────────┘
```

## 📚 Documentation

- **Local Development**: [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)
- **Azure Deployment**: [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md)
- **Project Overview**: [README.md](README.md)

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review service logs
3. Verify all prerequisites are installed
4. Ensure Docker Desktop is running
5. Check the detailed documentation files

## 🔄 Development Workflow

1. **Start Services**: `.\start-all.ps1`
2. **Make Changes**: Edit code in `backend/app/` or `frontend/src/`
3. **Auto-reload**: Both backend and frontend will automatically reload
4. **Test**: Access the application at http://localhost:3000
5. **Deploy**: Follow Azure deployment guide when ready for production



