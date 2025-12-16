# Script to set secrets DIRECTLY in App Settings (Fallback for Free Tier)
# Use this if you don't want to upgrade to the Standard Plan.
# This bypasses Key Vault and stores encrypted secrets directly in the App Service.

# 1. Configuration (Dynamically read from local config files)
$SettingsPath = ".\local.settings.json"
if (-not (Test-Path $SettingsPath)) { Write-Error "local.settings.json not found!"; exit 1 }
$Settings = Get-Content $SettingsPath | ConvertFrom-Json

$APP_NAME = $Settings.Values.AzureAppName
$RESOURCE_GROUP = $Settings.Values.AzureResourceGroup

# Secrets Read
$BLOCKFROST_ID_VAL = $Settings.Values.BLOCKFROST_PROJECT_ID
$BLOCKFROST_NET_VAL = $Settings.Values.BLOCKFROST_NETWORK

$EnvPath = "..\StakingContractDeploy\lucid-staking\.env"
$EnvContent = Get-Content $EnvPath
foreach ($line in $EnvContent) {
    if ($line -match "^MNEMONIC=(.*)$") {
        $MNEMONIC_VAL = $matches[1].Trim()
        break
    }
}

Write-Host "Setting secrets DIRECTLY in Static Web App: $APP_NAME..."
Write-Host "(This works on the Free Plan)"

# Set App Settings directly (No KeyVault Reference)
az staticwebapp appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP --setting-names "BLOCKFROST_PROJECT_ID=$BLOCKFROST_ID_VAL"
az staticwebapp appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP --setting-names "BLOCKFROST_NETWORK=$BLOCKFROST_NET_VAL"
az staticwebapp appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP --setting-names "MNEMONIC=$MNEMONIC_VAL"

Write-Host "Done! Secrets configured directly."
