<#
.SYNOPSIS
    Full deployment script for NSG Tool Resources (DB, Redis, Storage, KeyVault)
    and updates the Web App configuration.
    Also initializes the database.
    
.DESCRIPTION
    1. Ensures Resource Group exists.
    2. Ensures ACR exists, builds and pushes image.
    3. Ensures Key Vault, Storage, PostgreSQL, Redis exist.
    4. Updates Web App Settings with connection strings AND generated secrets.
    5. Initializes database tables via local python script.
    
.NOTES
    Author: CloudOpsAI
    Date: 2026-01-15
#>

$ErrorActionPreference = "Stop"

# --- Configuration ---
$ResourceGroup = "pep-poc-cloudengineering-srikanth-01-rg"
$Location = "southeastasia"
$WebAppName = "web-nsg-tool-dev-01"
$AppServicePlanName = "asp-nsg-tool-dev-01"
$AcrName = "acrnsgtooldev01"
$ImageName = "nsg-tool-backend"
$ImageTag = "dev"

# Resource Names (Must be globally unique where applicable)
$PostgresName = "psql-nsg-tool-dev-01"
$RedisName = "redis-nsg-tool-dev-01"
$StorageName = "stnsgtooldev01"
$KeyVaultName = "kv-nsg-tool-dev-01"
$ContainerName = "cloudopsai-reports"

# DB Config
$DbName = "cloudopsai"
$AdminUser = "cloudopsadmin"
$AdminPass = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 20 | % {[char]$_})

# --- Deployment Start ---
Write-Host "--- Starting Full Resource Deployment (Dev) ---" -ForegroundColor Cyan
Write-Host "Resource Group: $ResourceGroup"
Write-Host "Location: $Location"

# 0. Get Azure Context
$SubscriptionId = az account show --query id -o tsv
$TenantId = az account show --query tenantId -o tsv
Write-Host "Subscription ID: $SubscriptionId"

# 1. Resource Group
if (-not (az group exists --name $ResourceGroup)) {
    Write-Host "Creating Resource Group..."
    az group create --name $ResourceGroup --location $Location -o table
} else {
    Write-Host "Resource Group exists." -ForegroundColor Green
}

# 2. ACR & Image Build
Write-Host "Ensuring ACR exists: $AcrName..."
$acrInRg = az acr list --resource-group $ResourceGroup --query "[?name=='$AcrName']" -o tsv
if (-not $acrInRg) {
    az acr create --resource-group $ResourceGroup --name $AcrName --sku Basic --admin-enabled true -o table
}
Write-Host "Logging into ACR..."
az acr login --name $AcrName

$AcrServer = "$AcrName.azurecr.io"
$FullImageName = "$AcrServer/$ImageName`:$ImageTag"

Write-Host "Building Docker Image: $FullImageName..."
docker build -t $FullImageName -f backend/Dockerfile .

Write-Host "Pushing Docker Image..."
docker push $FullImageName

# 3. Key Vault
Write-Host "Ensuring Key Vault exists: $KeyVaultName..."
$kvExists = az keyvault list --resource-group $ResourceGroup --query "[?name=='$KeyVaultName']" -o tsv
if (-not $kvExists) {
    az keyvault create --name $KeyVaultName --resource-group $ResourceGroup --location $Location --sku standard -o table
}
$KeyVaultUrl = "https://$KeyVaultName.vault.azure.net/"

# 4. Storage Account
Write-Host "Ensuring Storage Account exists: $StorageName..."
$stInRg = az storage account list --resource-group $ResourceGroup --query "[?name=='$StorageName']" -o tsv
if (-not $stInRg) {
    az storage account create --name $StorageName --resource-group $ResourceGroup --location $Location --sku Standard_LRS --kind StorageV2 -o table
}
$StorageConnStr = az storage account show-connection-string --name $StorageName --resource-group $ResourceGroup --query connectionString -o tsv

Write-Host "Ensuring Blob Container exists: $ContainerName..."
try {
    az storage container create --name $ContainerName --account-name $StorageName --auth-mode key -o table 2>&1 | Out-Null
} catch {
    Write-Host "Container might already exist or error ignored." -ForegroundColor Yellow
}

# 5. PostgreSQL Flexible Server
Write-Host "Ensuring PostgreSQL exists: $PostgresName..."
$postgresExists = $false
try {
    az postgres flexible-server show --name $PostgresName --resource-group $ResourceGroup --query id -o tsv 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $postgresExists = $true }
} catch { $postgresExists = $false }

if (-not $postgresExists) {
    Write-Host "Creating PostgreSQL Server..."
    az postgres flexible-server create --resource-group $ResourceGroup --name $PostgresName `
        --location $Location --admin-user $AdminUser --admin-password $AdminPass `
        --sku-name Standard_B1ms --tier Burstable --version 13 `
        --storage-size 32 --yes -o table
    
    az postgres flexible-server db create --resource-group $ResourceGroup --server-name $PostgresName --database-name $DbName -o table
} else {
    Write-Host "PostgreSQL Server exists. Updating Password..." -ForegroundColor Yellow
    az postgres flexible-server update --resource-group $ResourceGroup --name $PostgresName --admin-password $AdminPass -o table
}

# Allow Azure Services
az postgres flexible-server firewall-rule create --resource-group $ResourceGroup --name $PostgresName `
    --rule-name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o table 2>$null | Out-Null

# 6. Redis Cache
Write-Host "Ensuring Redis Cache exists: $RedisName..."
$redisExists = $false
try {
    az redis show --name $RedisName --resource-group $ResourceGroup --query id -o tsv 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $redisExists = $true }
} catch { $redisExists = $false }

if (-not $redisExists) {
    Write-Host "Creating Redis Cache..."
    az redis create --resource-group $ResourceGroup --name $RedisName --location $Location --sku Basic --vm-size C0 -o table
}

$RedisKey = az redis list-keys --resource-group $ResourceGroup --name $RedisName --query "primaryKey" -o tsv
$RedisHost = az redis show --resource-group $ResourceGroup --name $RedisName --query "hostName" -o tsv

# Connection Strings
$PostgresHost = "$PostgresName.postgres.database.azure.com"
$DatabaseUrl = "postgresql+asyncpg://$($AdminUser):$($AdminPass)@$($PostgresHost):5432/$($DbName)?ssl=require"
$RedisUrl = "redis://:$($RedisKey)@$($RedisHost):6380/0?ssl=true"

# 7. Web App
Write-Host "Ensuring App Service Plan exists..."
$planExists = az appservice plan list --resource-group $ResourceGroup --query "[?name=='$AppServicePlanName']" -o tsv
if (-not $planExists) {
    az appservice plan create --name $AppServicePlanName --resource-group $ResourceGroup --location $Location --is-linux --sku B1 -o table
}

Write-Host "Ensuring Web App exists: $WebAppName..."
$webAppExists = az webapp list --resource-group $ResourceGroup --query "[?name=='$WebAppName']" -o tsv
if (-not $webAppExists) {
    az webapp create --resource-group $ResourceGroup --plan $AppServicePlanName --name $WebAppName `
        --deployment-container-image-name $FullImageName -o table
} else {
    az webapp config container set --name $WebAppName --resource-group $ResourceGroup `
        --docker-custom-image-name $FullImageName -o table
}

# Generate Secrets
$SecretKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 50 | % {[char]$_})
$SessionSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 50 | % {[char]$_})
$JwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 50 | % {[char]$_})

# Configure App Settings
Write-Host "Configuring App Settings (Environment Variables)..."
az webapp config appsettings set --resource-group $ResourceGroup --name $WebAppName --settings `
    "DATABASE_URL=$DatabaseUrl" `
    "REDIS_URL=$RedisUrl" `
    "AZURE_KEY_VAULT_URL=$KeyVaultUrl" `
    "AZURE_STORAGE_CONNECTION_STRING=$StorageConnStr" `
    "AZURE_STORAGE_CONTAINER_NAME=$ContainerName" `
    "AZURE_SUBSCRIPTION_ID=$SubscriptionId" `
    "AZURE_TENANT_ID=$TenantId" `
    "SECRET_KEY=$SecretKey" `
    "SESSION_SECRET=$SessionSecret" `
    "JWT_SECRET=$JwtSecret" `
    "WEBSITES_PORT=8000" `
    "SCM_DO_BUILD_DURING_DEPLOYMENT=false" -o table

# 8. Initialize Database
Write-Host "Initializing Database Tables..."
$MyIp = (Invoke-WebRequest -Uri "https://api.ipify.org").Content
az postgres flexible-server firewall-rule create --resource-group $ResourceGroup --name $PostgresName `
    --rule-name AllowLocalScript --start-ip-address $MyIp --end-ip-address $MyIp -o table 2>$null

$env:DATABASE_URL = $DatabaseUrl
$env:PYTHONPATH = "$PWD\backend"
Write-Host "Running table creation script..."
try {
    python backend/create_admin.py
    Write-Host "Database initialized successfully." -ForegroundColor Green
} catch {
    Write-Error "Failed to initialize database: $_"
}

Write-Host "--- Deployment Complete ---" -ForegroundColor Cyan
Write-Host "URL: https://$WebAppName.azurewebsites.net"
Write-Host "DB User: $AdminUser"
Write-Host "DB Password: $AdminPass"
Write-Host "Redis Key: $RedisKey"
