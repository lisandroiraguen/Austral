# Script to fix "ForbiddenByRbac" error
# Assigns "Key Vault Secrets Officer" to the current user
# Run this, wait 1-2 minutes, then run set_secrets_existing.ps1 again.

# Script to fix "ForbiddenByRbac" error
# Assigns "Key Vault Secrets Officer" to the current user
# Run this, wait 1-2 minutes, then run set_secrets_existing.ps1 again.

$SettingsPath = ".\local.settings.json"
if (-not (Test-Path $SettingsPath)) { Write-Error "local.settings.json not found!"; exit 1 }
$Settings = Get-Content $SettingsPath | ConvertFrom-Json

$KEY_VAULT_NAME = $Settings.Values.AzureKeyVaultName
$RESOURCE_GROUP = $Settings.Values.AzureResourceGroup
$SUBSCRIPTION_ID = $Settings.Values.AzureSubscriptionId

if (-not $KEY_VAULT_NAME -or -not $RESOURCE_GROUP -or -not $SUBSCRIPTION_ID) {
    Write-Error "Missing Azure configuration in local.settings.json (AzureKeyVaultName, AzureResourceGroup, AzureSubscriptionId)"
    exit 1
}

Write-Host "Getting current user ID..."
$USER_ID = az ad signed-in-user show --query id -o tsv

if (-not $USER_ID) {
    Write-Error "Could not get User ID. Please run 'az login' first."
    exit 1
}

Write-Host "User ID found: $USER_ID"
Write-Host "Assigning 'Key Vault Secrets Officer' role..."

# Scope is specific to this Key Vault
$SCOPE = "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.KeyVault/vaults/$KEY_VAULT_NAME"

az role assignment create --assignee $USER_ID --role "Key Vault Secrets Officer" --scope $SCOPE

Write-Host "Role Assigned!"
Write-Host "⚠️ IMPORTANT: It may take 1-2 minutes for permissions to propagate."
Write-Host "Please wait, then retry '.\set_secrets_existing.ps1'"
