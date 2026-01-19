<#
.SYNOPSIS
    Updates the NSG Tool Docker Image (Build, Push, Update Web App) for DEV Environment.
    
.DESCRIPTION
    1. Logs into ACR.
    2. Builds the Docker Image (using backend/Dockerfile).
    3. Pushes the Image to ACR.
    4. Restarts the Web App to pull the latest image.
    
    Does NOT deploy or validate infrastructure.
#>

$ErrorActionPreference = "Stop"

# --- User Configuration (DEV) ---
$ResourceGroup = "pep-poc-cloudengineering-srikanth-01-rg"
$WebAppName = "web-nsg-tool-dev-01"
$AcrName = "acrnsgtooldev01"
$ImageName = "nsg-tool-backend"
$ImageTag = "dev"
$Dockerfile = "backend/Dockerfile"

Write-Host "--- Starting Image Update (DEV) ---" -ForegroundColor Cyan
Write-Host "Resource Group: $ResourceGroup"
Write-Host "Web App: $WebAppName"
Write-Host "ACR: $AcrName"

# 1. ACR Login
Write-Host "Logging into ACR..."
az acr login --name $AcrName

$AcrServer = "$AcrName.azurecr.io"
$FullImageName = "$AcrServer/$ImageName`:$ImageTag"

# 2. Build Image
Write-Host "Building Docker Image: $FullImageName..."
if (-not (Test-Path $Dockerfile)) {
    Write-Error "Dockerfile not found at $Dockerfile. Please run this script from the project root."
}

# Build using the dev Dockerfile
docker build -t $FullImageName -f $Dockerfile .

# 3. Push Image
Write-Host "Pushing Docker Image..."
docker push $FullImageName

# 4. Update Web App
Write-Host "Restarting Web App to pull new image..."
az webapp restart --name $WebAppName --resource-group $ResourceGroup -o table

Write-Host "--- Image Update Complete ---" -ForegroundColor Green
Write-Host "Please allow a few minutes for the Web App to restart and pull the new image."
