# Staking Contract Deploy Walkthrough

I have successfully initialized the `.NET` project and refactored the code to use **Dependency Injection**, a **Builder Pattern**, and **External Configuration (.env)**.

## Architecture

### 1. Configuration (DotNetEnv)
-   **[.env](.env)**: Stores sensitive variables.
    -   `BLOCKFROST_PROJECT_ID`
    -   `MNEMONIC`
    -   `SCRIPT_PATH`
    -   `NETWORK`

### 2. Setup (Builder Pattern)
-   **Setup/StakingAppBuilder.cs**: Fluent interface to configure the application.
-   **Setup/StakingAppContext.cs**: Holds the immutable application state.

### 3. Execution (Service Layer)
-   **Services/IStakingService.cs** & **StakingService.cs**: Business logic.
-   **Program.cs**: Entry point.

## How to Run
1.  **Configure `.env`**: Open the `.env` file and set your `BLOCKFROST_PROJECT_ID`, `MNEMONIC`, and paths.
2.  Run:
    ```bash
    dotnet run
    ```

## Verification
-   Automated Build: `dotnet build` **PASSED**.
