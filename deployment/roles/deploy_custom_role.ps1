# Script to deploy the custom role for NSG Tool
# Usage: .\deploy_custom_role.ps1 -SubscriptionId "your-subscription-id"

param(
    [Parameter(Mandatory=$true)]
    [string]$SubscriptionId
)

# Login to Azure if not already logged in
# Connect-AzAccount

# Set the subscription context
Set-AzContext -SubscriptionId $SubscriptionId

# Define the role definition file path
$roleDefinitionFile = ".\nsg_tool_custom_role.json"

# Read the JSON file
$roleDefinition = Get-Content -Path $roleDefinitionFile -Raw | ConvertFrom-Json

# Update the AssignableScopes with the provided Subscription ID
$roleDefinition.AssignableScopes = @("/subscriptions/$SubscriptionId")

# Check if the role already exists
$existingRole = Get-AzRoleDefinition -Name $roleDefinition.Name -ErrorAction SilentlyContinue

if ($existingRole) {
    Write-Host "Updating existing role: $($roleDefinition.Name)"
    # Update the existing role definition object
    $existingRole.Description = $roleDefinition.Description
    $existingRole.Actions = $roleDefinition.Actions
    $existingRole.NotActions = $roleDefinition.NotActions
    $existingRole.DataActions = $roleDefinition.DataActions
    $existingRole.AssignableScopes = $roleDefinition.AssignableScopes
    
    Set-AzRoleDefinition -Role $existingRole
} else {
    Write-Host "Creating new role: $($roleDefinition.Name)"
    # Create a new role definition object
    New-AzRoleDefinition -InputObject $roleDefinition
}

Write-Host "Custom role deployment completed successfully."
