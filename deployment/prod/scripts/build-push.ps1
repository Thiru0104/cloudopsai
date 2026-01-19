<#
.SYNOPSIS
    Builds and Pushes the Production Docker Image.
    
.DESCRIPTION
    1. Builds the image using the multi-stage Dockerfile in deployment/prod/docker/Dockerfile.
    2. Pushes the image to ACR.
    3. Restarts the Web App to pick up the new image.

.NOTES
    Run this from the project root.
#>

$ErrorActionPreference = "Stop"

# --- Configuration ---
# Update these values or pass them as arguments if needed
$ResourceGroup = "pep-poc-cloudengineering-srikanth-01-rg"
$WebAppName = "web-nsg-tool-prod-01"
$AcrName = "acrnsgtoolprod01"
$ImageName = "nsg-tool-prod"
$ImageTag = "latest"

Write-Host "--- Starting Production Build & Push ---" -ForegroundColor Cyan

# 1. Login to ACR
Write-Host "Logging into ACR: $AcrName..."
az acr login --name $AcrName

$AcrServer = "$AcrName.azurecr.io"
$FullImageName = "$AcrServer/$ImageName`:$ImageTag"

# 2. Build Image
Write-Host "Building Production Docker Image: $FullImageName..."
Write-Host "Using Dockerfile: deployment/prod/docker/Dockerfile"
# Context is '.' (root) so we can access backend/ and frontend/
docker build -t $FullImageName -f deployment/prod/docker/Dockerfile .

# 3. Push Image
Write-Host "Pushing Docker Image..."
docker push $FullImageName

# 4. Restart Web App
Write-Host "Restarting Web App: $WebAppName..."
try {
    az webapp restart --name $WebAppName --resource-group $ResourceGroup -o table
    Write-Host "Web App restarted successfully." -ForegroundColor Green
} catch {
    Write-Host "Warning: Web App might not exist yet. Skipping restart." -ForegroundColor Yellow
}

Write-Host "Build and Push Complete." -ForegroundColor Green
