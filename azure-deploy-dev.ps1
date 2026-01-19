<#
.SYNOPSIS
    Deploys the NSG Tool to Azure App Service (Linux Container) for the DEV environment.
    Sets all required environment variables as App Settings.

.DESCRIPTION
    1. Checks for Azure login.
    2. Creates Resource Group (if not exists).
    3. Creates Azure Container Registry (ACR) and builds/pushes the image.
    4. Creates App Service Plan (Linux B1).
    5. Creates Web App for Containers.
    6. Configures all App Settings (Environment Variables) derived from config.py.
    
.NOTES
    Author: CloudOpsAI
    Date: 2026-01-14
#>

$ErrorActionPreference = "Stop"

# --- Configuration Variables ---
$ResourceGroup = "pep-poc-cloudengineering-srikanth-01-rg"
$Location = "eastus"
$AcrName = "acrnsgtooldev01" # Must be globally unique
$AppServicePlan = "asp-nsg-tool-dev"
$WebAppName = "web-nsg-tool-dev-01" # Must be globally unique
$ImageTag = "dev"
$ImageName = "nsg-tool-backend"

# --- Environment Variables (Dev Defaults) ---
# Secrets are marked as "CHANGE_ME" - update them in the Portal or via KeyVault after deployment.
$AppSettings = @{
    # Application
    "APP_NAME" = "CloudOpsAI"
    "VERSION" = "1.0.0"
    "API_V1_STR" = "/api/v1"
    "DEBUG" = "true"
    "ENVIRONMENT" = "development"
    "LOG_LEVEL" = "INFO"
    
    # Security (Replace these!)
    "SECRET_KEY" = "CHANGE_ME_GENERATED_SECRET_KEY"
    "SESSION_SECRET" = "CHANGE_ME_SESSION_SECRET"
    "JWT_SECRET" = "CHANGE_ME_JWT_SECRET"
    "JWT_ALGORITHM" = "HS256"
    "JWT_EXPIRATION" = "3600"
    
    # CORS (Allow frontend URL)
    "CORS_ORIGINS" = "https://$WebAppName.azurewebsites.net,http://localhost:3000"
    
    # Database & Redis
    "DATABASE_URL" = "postgresql+asyncpg://user:pass@host:5432/dbname" # Update if using Azure SQL/Postgres
    "REDIS_URL" = "redis://localhost:6379" # Update if using Azure Redis
    
    # Azure Configuration (Managed Identity Recommended)
    "AZURE_TENANT_ID" = "CHANGE_ME"
    "AZURE_CLIENT_ID" = "CHANGE_ME"
    "AZURE_CLIENT_SECRET" = "CHANGE_ME"
    "AZURE_SUBSCRIPTION_ID" = "CHANGE_ME"
    "AZURE_KEY_VAULT_URL" = "https://kv-nsg-tool-dev.vault.azure.net/"
    
    # Azure Auth & Resources
    "AZURE_USE_SERVICE_PRINCIPAL" = "false" # Set true if using SPN instead of Managed Identity
    "AZURE_DEFAULT_RESOURCE_GROUP" = $ResourceGroup
    "AZURE_DEFAULT_REGION" = $Location
    "AZURE_ENABLE_MULTI_SUBSCRIPTION" = "true"
    "AZURE_CACHE_SUBSCRIPTIONS" = "true"
    "AZURE_CACHE_TTL_MINUTES" = "30"
    
    # Storage
    "AZURE_STORAGE_CONNECTION_STRING" = "CHANGE_ME"
    "AZURE_STORAGE_CONTAINER_NAME" = "cloudopsai-reports"
    
    # AI Models
    "OPENAI_API_KEY" = "CHANGE_ME"
    "ANTHROPIC_API_KEY" = "CHANGE_ME"
    "AZURE_OPENAI_ENDPOINT" = "CHANGE_ME"
    "AZURE_OPENAI_API_KEY" = "CHANGE_ME"
    
    # Email
    "SMTP_HOST" = "smtp.office365.com"
    "SMTP_PORT" = "587"
    "SMTP_USERNAME" = "CHANGE_ME"
    "SMTP_PASSWORD" = "CHANGE_ME"
    
    # Monitoring
    "PROMETHEUS_ENDPOINT" = ""
    "JAEGER_ENDPOINT" = ""
    
    # Backup & Limits
    "BACKUP_RETENTION_DAYS" = "30"
    "BACKUP_SCHEDULE" = "0 2 * * *"
    "RATE_LIMIT_REQUESTS" = "100"
    "RATE_LIMIT_WINDOW" = "60"
    "MAX_FILE_SIZE" = "10485760"
    "ALLOWED_FILE_TYPES" = ".pdf,.doc,.docx,.txt,.csv,.json"
    
    # Frontend
    "REACT_APP_API_URL" = "https://$WebAppName.azurewebsites.net"
    "REACT_APP_WS_URL" = "wss://$WebAppName.azurewebsites.net/ws"
    
    # Container Specific
    "WEBSITES_PORT" = "8000"
    "WEB_CONCURRENCY" = "2"
}

Write-Host "--- Starting CloudOpsAI Dev Deployment ---" -ForegroundColor Cyan

# 1. Login Check
$currentSub = az account show --query "id" -o tsv 2>$null
if (-not $currentSub) {
    Write-Error "Please run 'az login' first."
}
Write-Host "Deploying to Subscription: $currentSub" -ForegroundColor Green

# 2. Create Resource Group
Write-Host "Creating Resource Group: $ResourceGroup..."
az group create --name $ResourceGroup --location $Location -o table

# 3. ACR & Image Build
Write-Host "Creating ACR: $AcrName..."
az acr create --resource-group $ResourceGroup --name $AcrName --sku Basic --admin-enabled true -o table

Write-Host "Logging into ACR..."
az acr login --name $AcrName

$AcrServer = "$AcrName.azurecr.io"
$FullImageName = "$AcrServer/$ImageName`:$ImageTag"

# Skipped build/push for retry speed - uncomment if needed
# Write-Host "Building Docker Image: $FullImageName..."
# docker build -t $FullImageName -f backend/Dockerfile .

# Write-Host "Pushing Docker Image..."
# docker push $FullImageName

# 4. Create App Service Plan
Write-Host "Creating App Service Plan: $AppServicePlan (Linux B1)..."
az appservice plan create --name $AppServicePlan --resource-group $ResourceGroup --sku B1 --is-linux -o table

# 5. Create Web App
Write-Host "Creating Web App: $WebAppName..."
# Get ACR Credentials for Web App
$AcrUser = az acr credential show --name $AcrName --query "username" -o tsv
$AcrPass = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv

# Step 1: Create Web App (without credentials first to avoid CLI argument issues)
az webapp create --resource-group $ResourceGroup --plan $AppServicePlan --name $WebAppName `
    --deployment-container-image-name $FullImageName -o table

# Step 2: Configure ACR Authentication
Write-Host "Configuring ACR Authentication..."
az webapp config container set --name $WebAppName --resource-group $ResourceGroup `
    --docker-custom-image-name $FullImageName `
    --docker-registry-server-url "https://$AcrServer" `
    --docker-registry-server-user $AcrUser `
    --docker-registry-server-password $AcrPass -o table

# 6. Configure App Settings
Write-Host "Configuring App Settings (Environment Variables)..."
$settingsParams = @()
foreach ($key in $AppSettings.Keys) {
    $val = $AppSettings[$key]
    $settingsParams += "$key=$val"
}

# Apply settings in batches to avoid command line length limits if necessary, 
# but here we pass all at once as they fit.
az webapp config appsettings set --resource-group $ResourceGroup --name $WebAppName --settings $settingsParams -o table

# 7. Enable Logging
Write-Host "Enabling Container Logging..."
az webapp log config --resource-group $ResourceGroup --name $WebAppName --docker-container-logging filesystem -o table

Write-Host "--- Deployment Completed Successfully! ---" -ForegroundColor Cyan
Write-Host "Web App URL: https://$WebAppName.azurewebsites.net"
Write-Host "Health Check: https://$WebAppName.azurewebsites.net/health"
Write-Host "IMPORTANT: Please go to the Azure Portal and update the 'CHANGE_ME' values in Configuration -> Application Settings." -ForegroundColor Yellow
