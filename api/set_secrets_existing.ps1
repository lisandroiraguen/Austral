# Helper script to Set Secrets in EXISTING Key Vault and Link to App
# Run in Azure PowerShell

# 1. Configuration (Dynamically read from local config files)
# Update api/local.settings.json with your actual values first
$SettingsPath = ".\local.settings.json"
if (-not (Test-Path $SettingsPath)) { Write-Error "local.settings.json not found!"; exit 1 }
$Settings = Get-Content $SettingsPath | ConvertFrom-Json

$KEY_VAULT_NAME = $Settings.Values.AzureKeyVaultName
$APP_NAME = $Settings.Values.AzureAppName
$RESOURCE_GROUP = $Settings.Values.AzureResourceGroup

if (-not $KEY_VAULT_NAME -or -not $APP_NAME -or -not $RESOURCE_GROUP) {
    Write-Error "Missing Azure configuration in local.settings.json (AzureKeyVaultName, AzureAppName, AzureResourceGroup)"
    exit 1
}

# Secrets to Set (Dynamically read from local config files)
# 1. Read local.settings.json for Blockfrost
$SettingsPath = ".\local.settings.json"
if (-not (Test-Path $SettingsPath)) { Write-Error "local.settings.json not found!"; exit 1 }
$Settings = Get-Content $SettingsPath | ConvertFrom-Json
$BLOCKFROST_ID_VAL = $Settings.Values.BLOCKFROST_PROJECT_ID
$BLOCKFROST_NET_VAL = $Settings.Values.BLOCKFROST_NETWORK

# 2. Read .env for Mnemonic
$EnvPath = "..\StakingContractDeploy\lucid-staking\.env"
if (-not (Test-Path $EnvPath)) { Write-Error ".env not found at $EnvPath!"; exit 1 }

# Simple parser for .env
$EnvContent = Get-Content $EnvPath
$MNEMONIC_VAL = $null
foreach ($line in $EnvContent) {
    if ($line -match "^MNEMONIC=(.*)$") {
        $MNEMONIC_VAL = $matches[1].Trim()
        break
    }
}

if (-not $MNEMONIC_VAL) { Write-Error "MNEMONIC not found in .env!"; exit 1 }

Write-Host "Setting secrets in Key Vault: $KEY_VAULT_NAME..."

# 2. Set Secrets
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "BLOCKFROST-PROJECT-ID" --value $BLOCKFROST_ID_VAL
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "BLOCKFROST-NETWORK"    --value $BLOCKFROST_NET_VAL
az keyvault secret set --vault-name $KEY_VAULT_NAME --name "MNEMONIC"              --value $MNEMONIC_VAL

# 3. Link to Static Web App
Write-Host "Linking secrets to Static Web App: $APP_NAME..."

# Construct URIs
$URI_ID = "https://$KEY_VAULT_NAME.vault.azure.net/secrets/BLOCKFROST-PROJECT-ID"
$URI_NET = "https://$KEY_VAULT_NAME.vault.azure.net/secrets/BLOCKFROST-NETWORK"
$URI_MNEMONIC = "https://$KEY_VAULT_NAME.vault.azure.net/secrets/MNEMONIC"

# Set App Settings
az staticwebapp appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP --setting-names "BLOCKFROST_PROJECT_ID=@Microsoft.KeyVault(SecretUri=$URI_ID)"
az staticwebapp appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP --setting-names "BLOCKFROST_NETWORK=@Microsoft.KeyVault(SecretUri=$URI_NET)"
az staticwebapp appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP --setting-names "MNEMONIC=@Microsoft.KeyVault(SecretUri=$URI_MNEMONIC)"

Write-Host "Done! Secrets valid in Production."
