# Lucid Staking Scripts

Scripts para interactuar con el contrato de staking de Australes usando [Lucid Evolution](https://github.com/Anastasia-Labs/lucid-evolution).

## Requisitos

- Node.js v18+
- Cuenta en [Blockfrost](https://blockfrost.io/)

## Instalación

```bash
npm install
```

## Configuración

Crear archivo `.env`:

```env
BLOCKFROST_PROJECT_ID=tu_api_key_de_blockfrost
MNEMONIC=tu seed phrase de 24 palabras
SCRIPT_PATH=../../StakingContract/plutus.json
NETWORK=Preview
```

| Variable | Descripción |
|----------|-------------|
| `BLOCKFROST_PROJECT_ID` | API key de Blockfrost para la red correspondiente |
| `MNEMONIC` | Seed phrase de tu wallet |
| `SCRIPT_PATH` | Ruta al `plutus.json` generado por Aiken |
| `NETWORK` | `Preview`, `Preprod`, o `Mainnet` |

## Uso

### Lock (Bloquear fondos)

```bash
node lock.mjs
```

Bloquea 1 ADA en el contrato por 5 minutos (configurable en `LOCK_MONTHS`).

### Unlock (Desbloquear fondos)

```bash
node unlock.mjs
```

Desbloquea los fondos después de que expire el periodo de lock.

## Estructura

```
lucid-staking/
├── .env           # Variables de entorno (no commitear)
├── lock.mjs       # Script para bloquear fondos
├── unlock.mjs     # Script para desbloquear fondos
├── state.json     # Estado guardado después del lock (generado automáticamente)
└── package.json
```

## Notas

- El script `lock.mjs` genera `state.json` con los datos del UTXO bloqueado
- El script `unlock.mjs` lee `state.json` automáticamente
- El periodo de lock usa 5 minutos por "mes" para testing
