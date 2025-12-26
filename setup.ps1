# CloudOpsAI Platform Setup Script for Windows
Write-Host "🚀 Starting CloudOpsAI Platform Setup" -ForegroundColor Blue
Write-Host "=====================================" -ForegroundColor Blue

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Cyan

$prerequisites = @{
    "Docker" = "docker"
    "Docker Compose" = "docker-compose"
    "Node.js" = "node"
    "Python" = "python"
}

$missingPrerequisites = @()

foreach ($prereq in $prerequisites.GetEnumerator()) {
    try {
        $version = & $prereq.Value --version 2>$null
        Write-Host "✓ $($prereq.Key): $version" -ForegroundColor Green
    } catch {
        Write-Host "✗ $($prereq.Key): Not found" -ForegroundColor Red
        $missingPrerequisites += $prereq.Key
    }
}

if ($missingPrerequisites.Count -gt 0) {
    Write-Host "Missing prerequisites: $($missingPrerequisites -join ', ')" -ForegroundColor Red
    Write-Host "Please install the missing prerequisites and run this script again." -ForegroundColor Yellow
    exit 1
}

# Create necessary directories
Write-Host "Creating necessary directories..." -ForegroundColor Cyan
$directories = @("logs", "backend/logs", "frontend/dist", "nginx/ssl", "data/postgres", "data/redis")

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created directory: $dir" -ForegroundColor Green
    }
}

# Generate placeholder SSL certificate
Write-Host "Generating placeholder SSL certificate..." -ForegroundColor Cyan
$sslDir = "nginx/ssl"
$certPath = "$sslDir/cloudopsai.crt"
$keyPath = "$sslDir/cloudopsai.key"

if (-not (Test-Path $certPath) -or -not (Test-Path $keyPath)) {
    "PLACEHOLDER_CERTIFICATE" | Out-File -FilePath $certPath -Encoding UTF8
    "PLACEHOLDER_PRIVATE_KEY" | Out-File -FilePath $keyPath -Encoding UTF8
    Write-Host "Created placeholder SSL certificate files" -ForegroundColor Green
}

# Build and start Docker services
Write-Host "Building and starting Docker services..." -ForegroundColor Cyan

try {
    # Stop any existing containers
    Write-Host "Stopping existing containers..." -ForegroundColor Yellow
    & docker-compose down 2>$null
    
    # Build Docker images
    Write-Host "Building Docker images..." -ForegroundColor Yellow
    & docker-compose build --no-cache
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to build Docker images" -ForegroundColor Red
        exit 1
    }
    
    # Start services
    Write-Host "Starting Docker services..." -ForegroundColor Yellow
    & docker-compose up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start Docker services" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Docker services started successfully" -ForegroundColor Green
}
catch {
    Write-Host "Failed to start Docker services: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Wait for services to be ready
Write-Host "Waiting for services to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Setup frontend
Write-Host "Setting up frontend..." -ForegroundColor Cyan
try {
    Set-Location frontend
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    & npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install frontend dependencies" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Building frontend..." -ForegroundColor Yellow
    & npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to build frontend" -ForegroundColor Red
        exit 1
    }
    
    Set-Location ..
    Write-Host "Frontend setup completed" -ForegroundColor Green
}
catch {
    Write-Host "Frontend setup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Display access information
Write-Host "`n🎉 CloudOpsAI Platform Setup Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

Write-Host "`n📋 Access Information:" -ForegroundColor Blue
Write-Host "Frontend: https://localhost" -ForegroundColor White
Write-Host "Backend API: http://localhost:8007" -ForegroundColor White
Write-Host "API Documentation: http://localhost:8007/docs" -ForegroundColor White
Write-Host "Health Check: http://localhost:8007/health" -ForegroundColor White

Write-Host "`n🔧 Useful Commands:" -ForegroundColor Blue
Write-Host "View logs: docker-compose logs -f [service_name]" -ForegroundColor White
Write-Host "Stop services: docker-compose down" -ForegroundColor White
Write-Host "Restart services: docker-compose restart" -ForegroundColor White

Write-Host "`n📝 Next Steps:" -ForegroundColor Blue
Write-Host "1. Access the web interface at https://localhost" -ForegroundColor White
Write-Host "2. Create your first admin user" -ForegroundColor White
Write-Host "3. Start managing your NSGs and ASGs!" -ForegroundColor White

Write-Host "`n⚠️  Important Notes:" -ForegroundColor Yellow
Write-Host "- The SSL certificate is self-signed. Accept the security warning in your browser." -ForegroundColor White
Write-Host "- Monitor the logs for any issues: docker-compose logs -f" -ForegroundColor White



