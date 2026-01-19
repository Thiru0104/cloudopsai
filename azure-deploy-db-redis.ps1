<#
.SYNOPSIS
    Deploys PostgreSQL Flexible Server and Redis Cache to Azure.
    Updates the existing Web App with connection strings.
    Creates tables and a default admin user.

.DESCRIPTION
    1. Creates Azure Database for PostgreSQL - Flexible Server.
    2. Creates Azure Cache for Redis.
    3. Configures Firewall rules for Azure Services and Local Machine.
    4. Updates Web App Settings.
    5. Runs local python script to seed the database (Admin User).

.NOTES
    Author: CloudOpsAI
    Date: 2026-01-14
#>

$ErrorActionPreference = "Stop"

# --- Configuration ---
$ResourceGroup = "pep-poc-cloudengineering-srikanth-01-rg"
$Location = "southeastasia"
$WebAppName = "web-nsg-tool-dev-01"
$PostgresName = "psql-nsg-tool-dev-01" # Globally Unique
$RedisName = "redis-nsg-tool-dev-01"   # Globally Unique
$AdminUser = "cloudopsadmin"
$AdminPass = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | % {[char]$_}) # Random Password
$DbName = "cloudopsai"

Write-Host "--- Starting DB & Redis Deployment ---" -ForegroundColor Cyan
Write-Host "Resource Group: $ResourceGroup"
Write-Host "Web App: $WebAppName"
Write-Host "Generated Admin Password: $AdminPass" -ForegroundColor Yellow

# 1. Create PostgreSQL Flexible Server
Write-Host "Creating PostgreSQL Flexible Server: $PostgresName..."
# Note: SKU B_Standard_B1ms is cost-effective for dev.
$postgresExists = $false
try {
    az postgres flexible-server show --name $PostgresName --resource-group $ResourceGroup --query id -o tsv 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $postgresExists = $true }
} catch {
    $postgresExists = $false
}

if (-not $postgresExists) {
    az postgres flexible-server create --resource-group $ResourceGroup --name $PostgresName `
        --location $Location --admin-user $AdminUser --admin-password $AdminPass `
        --sku-name Standard_B1ms --tier Burstable --version 13 `
        --storage-size 32 --yes -o table
    
    # Create DB
    az postgres flexible-server db create --resource-group $ResourceGroup --server-name $PostgresName --database-name $DbName -o table
} else {
    Write-Host "PostgreSQL Server already exists." -ForegroundColor Yellow
    # We don't overwrite password if exists, so we might need to reset it if we don't know it.
    # For this script, we assume we created it or user knows it. 
    # BUT, since we generated a random one, we might lose access if we don't reset.
    # Let's reset it to be safe for this "Ensure" task.
    Write-Host "Resetting Admin Password to ensure access..."
    az postgres flexible-server update --resource-group $ResourceGroup --name $PostgresName --admin-password $AdminPass -o table
}

# 2. Configure Firewall
Write-Host "Configuring Postgres Firewall..."
# Attempt 1: Allow Azure Services (might be blocked by policy)
try {
    Write-Host "Attempting to allow Azure Services (0.0.0.0)..."
    az postgres flexible-server firewall-rule create --resource-group $ResourceGroup --name $PostgresName `
        --rule-name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o table 2>$null | Out-Null
} catch {
    Write-Host "Policy blocked 'Allow Azure Services'. Falling back to Web App Outbound IPs." -ForegroundColor Yellow
}

# Attempt 2: Add Web App Outbound IPs
Write-Host "Fetching Web App Outbound IPs..."
$WebAppIps = az webapp show --resource-group $ResourceGroup --name $WebAppName --query outboundIpAddresses -o tsv
if ($WebAppIps) {
    $Ips = $WebAppIps -split ","
    foreach ($Ip in $Ips) {
        $Ip = $Ip.Trim()
        $RuleName = "AllowWebApp_$($Ip -replace '\.', '_')"
        Write-Host "Adding Firewall Rule for IP: $Ip"
        try {
            az postgres flexible-server firewall-rule create --resource-group $ResourceGroup --name $PostgresName `
                --rule-name $RuleName --start-ip-address $Ip --end-ip-address $Ip -o table 2>$null | Out-Null
        } catch {
            Write-Host "Failed to add rule for $Ip (might already exist or invalid)" -ForegroundColor Red
        }
    }
}

# 3. Create Redis Cache
Write-Host "Creating Redis Cache: $RedisName..."
$redisExists = $false
try {
    az redis show --name $RedisName --resource-group $ResourceGroup --query id -o tsv 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $redisExists = $true }
} catch {
    $redisExists = $false
}

if (-not $redisExists) {
    az redis create --resource-group $ResourceGroup --name $RedisName --location $Location --sku Basic --vm-size C0 -o table
} else {
    Write-Host "Redis Cache already exists." -ForegroundColor Yellow
}

# 4. Get Connection Details
Write-Host "Retrieving Connection Details..."
$RedisKey = az redis list-keys --resource-group $ResourceGroup --name $RedisName --query "primaryKey" -o tsv
$RedisHost = az redis show --resource-group $ResourceGroup --name $RedisName --query "hostName" -o tsv

$PostgresHost = "$PostgresName.postgres.database.azure.com"
# Connection String Format: postgresql+asyncpg://user:pass@host:5432/db
$DatabaseUrl = "postgresql+asyncpg://$($AdminUser):$($AdminPass)@$($PostgresHost):5432/$($DbName)"
$RedisUrl = "redis://:$($RedisKey)@$($RedisHost):6380/0?ssl=true"

# 5. Update Web App Settings
Write-Host "Updating Web App Settings..."
az webapp config appsettings set --resource-group $ResourceGroup --name $WebAppName --settings `
    "DATABASE_URL=$DatabaseUrl" `
    "REDIS_URL=$RedisUrl" -o table

# 6. Initialize Database (Create Tables & User)
Write-Host "Initializing Database..."

# Add Local IP to Firewall to allow script connection
$MyIp = (Invoke-WebRequest -Uri "https://api.ipify.org").Content
Write-Host "Adding Local IP ($MyIp) to Firewall..."
az postgres flexible-server firewall-rule create --resource-group $ResourceGroup --name $PostgresName `
    --rule-name AllowLocalScript --start-ip-address $MyIp --end-ip-address $MyIp -o table 2>$null

Write-Host "Running 'create_admin.py' locally..."
# Set Env Var for the script
$env:DATABASE_URL = $DatabaseUrl
$env:PYTHONPATH = "$PWD\backend"

# Run the python script
python backend/create_admin.py

# Clean up Firewall (Optional - keeping it might be useful for dev)
# Write-Host "Removing Local IP Firewall Rule..."
# az postgres flexible-server firewall-rule delete --resource-group $ResourceGroup --name $PostgresName --rule-name AllowLocalScript --yes

Write-Host "--- Deployment & Initialization Complete ---" -ForegroundColor Cyan
Write-Host "DB Host: $PostgresHost"
Write-Host "DB User: $AdminUser"
Write-Host "DB Pass: $AdminPass"
Write-Host "Web App Configured."
