# Test script to demonstrate restore monitoring functionality
# This script will perform a test restore operation to show the progress monitoring in action

Write-Host "Testing NSG Restore Monitoring Functionality" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Create a test CSV file for restore
$testCsvContent = @"
name,priority,direction,access,protocol,sourceAddressPrefix,sourcePortRange,destinationAddressPrefix,destinationPortRange,description
AllowHTTPS,100,Inbound,Allow,TCP,*,*,*,443,Allow HTTPS traffic
AllowSSH,200,Inbound,Allow,TCP,*,*,*,22,Allow SSH access
AllowRDP,300,Inbound,Allow,TCP,*,*,*,3389,Allow RDP access
DenyAll,4000,Inbound,Deny,*,*,*,*,*,Deny all other traffic
"@

$csvPath = "D:\AI project\NSG-Tool-01\test-restore-data.csv"
$testCsvContent | Out-File -FilePath $csvPath -Encoding UTF8

Write-Host "Created test CSV file: $csvPath" -ForegroundColor Yellow
Write-Host "CSV Content:" -ForegroundColor Cyan
Get-Content $csvPath | ForEach-Object { Write-Host "  $_" -ForegroundColor White }

Write-Host "`nNow performing test restore operation..." -ForegroundColor Yellow
Write-Host "This will demonstrate the progress monitoring functionality." -ForegroundColor Cyan

# Prepare the restore request payload
$restorePayload = @{
    source_type = "csv"
    csv_file = $testCsvContent
    subscription_id = "0a519345-d9f4-400c-a3b4-e8379de6638e"
    resource_group = "Resourcegroup001"
    target_resource_groups = @("Resourcegroup001")
    target_type = "single"
    apply_to_all_nsgs = $false
    selected_nsgs = @()
    create_new_nsgs = $true
    new_nsg_names = @(@{
        resourceGroup = "Resourcegroup001"
        nsgName = "test-monitoring-nsg"
    })
    overwrite_existing = $false
    validate_rules = $true
    create_backup_before_restore = $false
    edited_rules = @()
} | ConvertTo-Json -Depth 10

Write-Host "`nSending restore request to backend..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/backup/restore/confirm" `
                                  -Method POST `
                                  -ContentType "application/json" `
                                  -Body $restorePayload
    
    Write-Host "Restore operation completed successfully!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5 | Write-Host -ForegroundColor White
    
    Write-Host "`n✅ Test completed successfully!" -ForegroundColor Green
    Write-Host "Check the frontend UI to see the progress monitoring in action." -ForegroundColor Yellow
    Write-Host "The progress sidebar should show the restore operation details." -ForegroundColor Yellow
    
} catch {
    Write-Host "❌ Error during restore operation:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Red
    }
}

# Clean up test files
Write-Host "`nCleaning up test files..." -ForegroundColor Yellow
if (Test-Path $csvPath) {
    Remove-Item $csvPath -Force
    Write-Host "Removed test CSV file" -ForegroundColor Green
}

Write-Host "`n🎉 Test script completed!" -ForegroundColor Green
Write-Host "Visit http://localhost:4004 to see the progress monitoring UI" -ForegroundColor Cyan
Write-Host "Click the Activity icon in the top-right corner to open the progress sidebar" -ForegroundColor Cyan