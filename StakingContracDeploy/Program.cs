using System;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using StakingContractDeploy.Setup;
using StakingContractDeploy.Services;

using DotNetEnv; // Added for reading .env

namespace StakingContractDeploy
{
    class Program
    {
        static async Task Main(string[] args)
        {
            Console.WriteLine("=== STAKING TIME-LOCK TEST (Builder Pattern + Env) ===");

            // 0. Load Env
            Env.Load();

            string projectId = Environment.GetEnvironmentVariable("BLOCKFROST_PROJECT_ID")
                ?? throw new Exception("Missing BLOCKFROST_PROJECT_ID in .env");

            string mnemonic = Environment.GetEnvironmentVariable("MNEMONIC")
                ?? throw new Exception("Missing MNEMONIC in .env");

            string scriptPath = Environment.GetEnvironmentVariable("SCRIPT_PATH")
                 ?? "validators/staking.plutus.json";

            string network = Environment.GetEnvironmentVariable("NETWORK") ?? "preprod";

            try
            {
                // 1. BUILD APP CONTEXT
                var appContext = StakingAppBuilder.Create()
                    .WithBlockfrost(network, projectId)
                    .WithWallet(mnemonic)
                    .WithScript(scriptPath)
                    .Build();

                Console.WriteLine($"Wallet Address: {appContext.UserAddress}");
                Console.WriteLine($"Script Address: {appContext.ScriptAddress}");

                // 2. EXECUTE
                var stakingService = appContext.Services.GetRequiredService<IStakingService>();

                // Using Context data
                await stakingService.LockFunds(
                    appContext.UserAddress,
                    appContext.ScriptAddress,
                    appContext.PaymentPrv,
                    appContext.PaymentPub,
                    appContext.PlutusScript
                );

                await stakingService.UnlockFunds(
                    appContext.UserAddress,
                    appContext.ScriptAddress,
                    appContext.PaymentPrv,
                    appContext.PlutusScript
                );
            }
            catch (Exception ex)
            {
                Console.WriteLine($"ERROR: {ex.Message}");
                Console.WriteLine(ex.StackTrace);
            }

            Console.WriteLine("Done.");
        }
    }
}