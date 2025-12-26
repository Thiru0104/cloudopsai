#!/bin/bash

# CloudOpsAI - Azure NSG/ASG Management Platform Setup Script
# This script sets up the complete CloudOpsAI platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

print_status "Starting CloudOpsAI platform setup..."

# Check prerequisites
print_status "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.11+ first."
    exit 1
fi

print_success "Prerequisites check passed"

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating .env file from template..."
    cp env.example .env
    print_warning "Please edit .env file with your Azure credentials and other configuration"
    print_warning "You can find the required Azure credentials in the Azure Portal"
else
    print_status ".env file already exists"
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p nginx/ssl
mkdir -p backend/static
mkdir -p frontend/public

# Generate self-signed SSL certificate for development
if [ ! -f nginx/ssl/cert.pem ]; then
    print_status "Generating self-signed SSL certificate for development..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/key.pem \
        -out nginx/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
    print_success "SSL certificate generated"
fi

# Build and start services
print_status "Building and starting services with Docker Compose..."

# Build images
print_status "Building Docker images..."
docker-compose build

# Start services
print_status "Starting services..."
docker-compose up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 30

# Check if services are running
print_status "Checking service status..."
if docker-compose ps | grep -q "Up"; then
    print_success "Services are running"
else
    print_error "Some services failed to start. Check logs with: docker-compose logs"
    exit 1
fi

# Initialize database (if needed)
print_status "Initializing database..."
docker-compose exec backend python -c "
from app.core.database import init_db
import asyncio
asyncio.run(init_db())
" || print_warning "Database initialization failed or already initialized"

# Create admin user (if needed)
print_status "Creating admin user..."
docker-compose exec backend python -c "
from app.models.user import User
from app.core.database import AsyncSessionLocal
from app.core.auth import get_password_hash
import asyncio

async def create_admin():
    async with AsyncSessionLocal() as session:
        # Check if admin exists
        admin = await session.get(User, 1)
        if not admin:
            admin = User(
                email='admin@cloudopsai.local',
                username='admin',
                full_name='Administrator',
                hashed_password=get_password_hash('admin123'),
                is_superuser=True,
                role='admin'
            )
            session.add(admin)
            await session.commit()
            print('Admin user created: admin@cloudopsai.local / admin123')

asyncio.run(create_admin())
" || print_warning "Admin user creation failed or already exists"

# Install frontend dependencies and build
print_status "Installing frontend dependencies..."
cd frontend
npm install

print_status "Building frontend..."
npm run build

cd ..

# Final status check
print_status "Performing final status check..."

# Check if API is responding
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    print_success "Backend API is responding"
else
    print_warning "Backend API is not responding yet. It may take a few minutes to start."
fi

# Check if frontend is accessible
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    print_success "Frontend is accessible"
else
    print_warning "Frontend is not accessible yet. It may take a few minutes to start."
fi

# Display access information
echo ""
print_success "CloudOpsAI platform setup completed!"
echo ""
echo "Access Information:"
echo "=================="
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:8000"
echo "API Documentation: http://localhost:8000/api/docs"
echo ""
echo "Default Admin Credentials:"
echo "Email: admin@cloudopsai.local"
echo "Password: admin123"
echo ""
echo "Useful Commands:"
echo "==============="
echo "View logs: docker-compose logs -f"
echo "Stop services: docker-compose down"
echo "Restart services: docker-compose restart"
echo "Update services: docker-compose pull && docker-compose up -d"
echo ""
print_warning "Remember to:"
echo "1. Change the default admin password"
echo "2. Configure your Azure credentials in .env file"
echo "3. Set up proper SSL certificates for production"
echo "4. Configure backup and monitoring settings"
echo ""
print_success "Setup complete! You can now access CloudOpsAI at http://localhost:3000"


