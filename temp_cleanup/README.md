# CloudOpsAI - Azure NSG/ASG Management Platform

A comprehensive, enterprise-grade platform for managing Azure Network Security Groups (NSGs) and Application Security Groups (ASGs) with advanced features including backup/restore, compliance monitoring, and state management.

## 🚀 Features

### Core Functionality
- **NSG Management**: Create, update, and manage Network Security Groups
- **Rule Editor**: Visual editor for inbound and outbound security rules
- **Backup & Restore**: Automated backup to Azure Blob Storage with restore capabilities
- **Golden Rule Compliance**: Compare NSGs against golden standards
- **State Management**: Track changes and enable rollback functionality
- **Real-time Monitoring**: Dashboard with key metrics and recent activity

### Advanced Features
- **Azure SDK Integration**: Direct integration with Azure services
- **Database Storage**: PostgreSQL for persistent data storage
- **Blob Storage**: Azure Blob Storage for backup files and exports
- **Compliance Analysis**: Automated compliance scoring and recommendations
- **Audit Trail**: Complete change history and audit logging
- **Professional UI**: Modern, responsive interface built with React and Tailwind CSS

## 🏗️ Architecture

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Routing**: React Router for navigation
- **State Management**: React Query for server state
- **UI Components**: Tailwind CSS with Lucide React icons
- **Build Tool**: Vite for fast development and building

### Backend (FastAPI + Python)
- **Framework**: FastAPI for high-performance API
- **Database**: SQLAlchemy ORM with PostgreSQL
- **Azure Integration**: Azure SDK for Network Management
- **Storage**: Azure Blob Storage for backups and exports
- **Authentication**: JWT-based authentication system

### Key Components
```markdown
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service layer
│   │   └── utils/           # Utility functions
│   └── public/              # Static assets
├── backend/                  # FastAPI backend application
│   ├── app/
│   │   ├── api/             # API endpoints
│   │   ├── core/            # Core configuration
│   │   ├── models/          # Database models
│   │   ├── schemas/         # Pydantic schemas
│   │   └── services/        # Business logic services
│   └── requirements.txt     # Python dependencies
└── docker-compose.yml       # Development environment
```

## 🛠️ Installation & Setup

### Prerequisites
- Python 3.9+
- Node.js 18+
- Docker and Docker Compose
- Azure subscription with appropriate permissions

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd NSG-Tool-01
   ```

2. **Set up environment variables**
   ```bash
   cp env.copy.example .env
   # Edit .env with your Azure credentials
   ```

3. **Start the development environment**
   ```bash
   # Using PowerShell (Windows)
   .\start-all.ps1
   
   # Using bash (Linux/Mac)
   ./setup.sh
   ```

4. **Access the application**
   - Frontend: http://localhost:4004
   - Backend API: http://localhost:8007
   - API Documentation: http://localhost:8007/docs

### Manual Setup

#### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Set environment variables
export AZURE_SUBSCRIPTION_ID="your-subscription-id"
export AZURE_TENANT_ID="your-tenant-id"
export AZURE_CLIENT_ID="your-client-id"
export AZURE_CLIENT_SECRET="your-client-secret"
export AZURE_STORAGE_CONNECTION_STRING="your-storage-connection-string"

# Run the backend
uvicorn app.main:app --host 0.0.0.0 --port 8007 --reload
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 🔧 Configuration

### Azure Configuration
The application requires the following Azure permissions:
- **Network Contributor**: For NSG management
- **Storage Account Contributor**: For blob storage operations
- **Reader**: For resource discovery

### Environment Variables
```bash
# Azure Configuration
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=your-storage-connection-string
AZURE_STORAGE_ACCOUNT_NAME=your-storage-account
AZURE_STORAGE_ACCOUNT_KEY=your-storage-key

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost/cloudopsai

# Security
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

## 📖 Usage Guide

### Dashboard
The dashboard provides an overview of your NSG environment:
- **Key Metrics**: Total NSGs, compliance scores, recent changes
- **Recent Activity**: Latest changes and operations
- **Quick Actions**: Common tasks and shortcuts

### NSG Management
1. **View NSGs**: Navigate to the NSGs page to see all Network Security Groups
2. **Edit Rules**: Click on an NSG to open the rule editor
3. **Filter & Search**: Use filters to find specific NSGs
4. **Bulk Operations**: Perform operations on multiple NSGs

### Backup & Restore
1. **Create Backup**: Select an NSG and create a backup
2. **Schedule Backups**: Set up automated backup schedules
3. **Restore**: Restore NSGs from previous backups
4. **Export**: Export configurations to CSV format

### Compliance Monitoring
1. **Golden Rules**: Define compliance standards
2. **Compliance Analysis**: Compare NSGs against golden rules
3. **Recommendations**: Get automated compliance recommendations
4. **Risk Assessment**: View risk levels and compliance scores

### State Management
1. **Change Tracking**: All changes are automatically tracked
2. **Rollback**: Rollback to previous states if needed
3. **Audit Trail**: Complete history of all operations
4. **Snapshots**: Create state snapshots for critical changes

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control
- Secure API endpoints
- Session management

### Data Protection
- Encrypted data transmission
- Secure storage of credentials
- Audit logging
- Data backup and recovery

### Azure Security
- Managed Identity support
- Azure Key Vault integration
- Network security best practices
- Compliance monitoring

## 🚀 Deployment

### Production Deployment
```bash
# Build frontend
cd frontend
npm run build

# Build backend Docker image
cd backend
docker build -t cloudopsai-backend .

# Deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Azure Deployment
```bash
# Deploy to Azure App Service
az webapp up --name cloudopsai-app --resource-group your-rg --runtime "PYTHON:3.9"

# Deploy to Azure Container Instances
az container create --resource-group your-rg --name cloudopsai --image cloudopsai-backend
```

## 🧪 Testing

### Backend Testing
```bash
cd backend
pytest tests/ -v
pytest tests/ --cov=app --cov-report=html
```

### Frontend Testing
```bash
cd frontend
npm test
npm run test:coverage
```

### Integration Testing
```bash
# Run full integration tests
pytest tests/integration/ -v
```

## 📊 Monitoring & Logging

### Application Monitoring
- Structured logging with structlog
- Performance metrics
- Error tracking with Sentry
- Health check endpoints

### Azure Monitoring
- Azure Monitor integration
- Application Insights
- Log Analytics
- Custom metrics and alerts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Development Guidelines
- Follow PEP 8 for Python code
- Use TypeScript for frontend code
- Write comprehensive tests
- Update documentation
- Follow conventional commits

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [API Documentation](http://localhost:8007/docs)
- [User Guide](docs/user-guide.md)
- [Developer Guide](docs/developer-guide.md)

### Troubleshooting
- Check the [Troubleshooting Guide](docs/troubleshooting.md)
- Review application logs
- Verify Azure permissions
- Check network connectivity

### Getting Help
- Create an issue on GitHub
- Contact the development team
- Check the FAQ section

## 🔄 Changelog

### Version 1.0.0
- Initial release
- Core NSG management functionality
- Backup and restore capabilities
- Compliance monitoring
- Professional UI/UX

### Upcoming Features
- AI-powered security recommendations
- Advanced analytics and reporting
- Multi-cloud support
- Mobile application
- Integration with security tools

---

**CloudOpsAI** - Enterprise-grade Azure NSG/ASG Management Platform
