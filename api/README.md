# Austral Staking API

Backend serverless implementado con Azure Functions para manejar la construcción segura de transacciones de Staking.

## 🚀 Overview

Esta API actúa como intermediario seguro entre el Frontend y la Blockchain. Protege las claves de API (Blockfrost), gestiona la lógica de negocio (cálculo de recompensas) y construye las transacciones usando [Lucid Evolution](https://github.com/Anastasia-Labs/lucid-evolution).

## ⚠️ Configuración de Producción vs Testing

> [!IMPORTANT]
> **Diferencia Crítica de Tiempos:**
> *   **API (Este Backend):** Usa lógica de **Producción**.
>     *   1 Mes = **30 Días** reales.
> *   **Scripts Locales (`lock.mjs`):** Usan lógica de **Testing**.
>     *   1 Mes = **5 Minutos**.

## 🔌 Endpoints

### 1. `POST /api/CreateStakeTx`
Crea una transacción de bloqueo de fondos (Staking).

*   **Body:** `{ amount: "100", lockMonths: 1, walletAddress: "addr_test..." }`
*   **Lógica:** Calcula la fecha de desbloqueo basada en `lockMonths * 30 días`.
*   **Retorno:** CBOR de la transacción parcial para firmar en el cliente.

### 2. `POST /api/ClaimStakeTx`
Reclama el principal + recompensas (Rewards) desde el Tesoro si el tiempo de bloqueo ha pasado.

*   **Body:** `{ walletAddress: "addr_test..." }`
*   **Lógica:**
    *   Verifica UTZOs de staking activos del usuario.
    *   Verifica si `ahora > fecha_desbloqueo`.
    *   Consume UTXO del Tesoro para pagar recompensas en Token Austral.
    *   Usa el Script de Referencia del Tesoro.

### 3. `POST /api/CancelStakeTx` (Refund)
Permite retirar el principal ANTES de tiempo (o si no hay recompensas), renunciando a los intereses.

*   **Body:** `{ walletAddress: "addr_test..." }`
*   **Lógica:** Devuelve solo los ADA originales al usuario.

### 4. `POST /api/SubmitTx`
Envía la transacción firmada a la red Cardano.

*   **Body:** `{ signedTxCbor: "..." }`

### 5. `POST /api/CheckStake`
Verifica si una dirección tiene un stake activo visible.

*   **Body:** `{ walletAddress: "addr_test..." }`

## 🛠️ Desarrollo Local

1.  Asegúrate de tener las `local.settings.json` configuradas:
    ```json
    {
      "IsEncrypted": false,
      "Values": {
        "AzureWebJobsStorage": "",
        "FUNCTIONS_WORKER_RUNTIME": "node",
        "BLOCKFROST_PROJECT_ID": "preview...",
        "BLOCKFROST_NETWORK": "Preview"
      }
    }
    ```
2.  Correr funciones:
    ```bash
    npm start
    ```
