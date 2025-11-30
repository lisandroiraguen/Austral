# Austral Token Minting Script

A .NET console application designed to mint native assets (tokens) on the Cardano blockchain using [CardanoSharp](https://github.com/CardanoSharp/cardanosharp-wallet) and [Blockfrost](https://blockfrost.io/).

This tool was built to mint the **Australes** token but can be configured to mint any custom token.

## Features

*   **Native Asset Minting**: Mints tokens with a specified policy and amount.
*   **Automatic UTXO Selection**: Automatically selects the best UTXO (prioritizing pure ADA UTXOs) to cover fees and collateral.
*   **Fee Calculation**: accurate fee estimation with safety buffers.
*   **Network Support**: Supports Preprod, Preview, and Mainnet.
*   **Secure Configuration**: Uses `.env` file for sensitive data (mnemonic, API keys).

## Prerequisites

*   [.NET 9.0 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
*   A [Blockfrost](https://blockfrost.io/) Project ID (for Preprod, Preview, or Mainnet).
*   A Cardano wallet mnemonic (seed phrase) with funds.

## Setup

1.  **Clone the repository** (if applicable) or navigate to the project directory.

2.  **Restore dependencies**:
    ```bash
    dotnet restore
    ```

3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory of the project (`MintingScript/.env`). You can use the example below:

    ```env
    # Blockfrost Project ID (e.g., preprod...)
    BLOCKFROST_PROJECT_ID=your_blockfrost_project_id_here

    # Wallet Mnemonic (24 words)
    MNEMONIC=word1 word2 word3 ... word24

    # Network (Preprod, Preview, or Mainnet)
    NETWORK=Preprod

    # Token Configuration
    TOKEN_NAME=Australes
    TOKEN_AMOUNT=1000000
    ```

    > **Note**: Ensure your wallet has enough ADA to cover the transaction fee and the minimum ADA requirement for the output (approx. 2-3 ADA).

## Usage

Run the application using the .NET CLI:

```bash
dotnet run
```

### What happens when you run it?

1.  The script loads your wallet from the mnemonic.
2.  It derives the necessary keys (Payment, Stake, and Policy keys).
3.  It connects to Blockfrost to fetch the latest protocol parameters and your wallet's UTXOs.
4.  It constructs a transaction to mint the specified amount of tokens.
5.  It signs the transaction and submits it to the Cardano network.
6.  If successful, it outputs the **Transaction ID** and a link to the explorer.

## Project Structure

*   `Program.cs`: Main logic for wallet restoration, transaction building, and submission.
*   `AdaHelper.cs`: Helper methods for parsing Blockfrost responses and handling ADA amounts.
*   `AmountItem.cs`: Data model for JSON deserialization of amounts.

## Dependencies

*   `CardanoSharp.Wallet`: For key derivation, transaction building, and signing.
*   `Blockfrost.Api`: For interacting with the Cardano blockchain.
*   `DotNetEnv`: For loading environment variables.

## License

[MIT](LICENSE)
