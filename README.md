# Austral Landing Page

A retro-futuristic landing page for the **Austral** token, built on the Cardano blockchain. This project features a distinctive 80s/90s aesthetic, real-time token statistics, and wallet integration.

[Austral Web](https://happy-glacier-0d9820b0f.3.azurestaticapps.net)

## 🌟 Features

- **Retro Aesthetic**: Custom-styled UI components using Tailwind CSS v4 with a neon/cyberpunk color palette.
- **Cardano Integration**: Seamless wallet connection using [MeshSDK](https://meshjs.dev/).
- **Live Token Stats**: Real-time display of token metrics.
- **Multi-language Support**: Built-in English and Spanish translation support.
- **Vintage Gallery**: A curated gallery component showcasing retro visuals.
- **Responsive Design**: Fully optimized for desktop and mobile devices.

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Blockchain SDK**: [MeshSDK](https://meshjs.dev/)
- **Smart Contracts**: [Aiken](https://aiken-lang.org/) (Plutus V3)

## 🏗️ Architecture Overview

1.  **Frontend (Web)**: React application that connects to the user's wallet (Nami, Eternl, etc.) using MeshSDK/Lucid.
2.  **Backend (API)**: Azure Functions (Node.js) acting as a secure intermediary.
    *   **Secure Transaction Building**: Handles complex transaction construction (Staking, Claiming) server-side to protect logic and secrets.
    *   **Production Logic**: configured for **30 Days** staking duration.
3.  **Smart Contracts**: Plutus V3 scripts (written in Aiken) deployed on Cardano Preview Testnet.
    *   **Staking Validator**: Manages deposits and time-locks.
    *   **Treasury Validator**: Securely holds reward tokens.

## 💰 Staking Rewards

| Duración | APY | Bonus |
|----------|-----|-------|
| Flexible | 3.5% | - |
| 1 Mes | 4.7% | +0.2%/mes |
| 3 Meses | 6.4% | +0.3%/mes |
| 6 Meses | 8.9% | +0.4%/mes |
| 12 Meses | 13.5% | +0.5%/mes |

