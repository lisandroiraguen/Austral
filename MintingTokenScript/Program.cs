using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Blockfrost.Api;
using Blockfrost.Api.Extensions;
using Blockfrost.Api.Services;
using CardanoSharp.Wallet;
using CardanoSharp.Wallet.Enums;
using CardanoSharp.Wallet.Extensions;
using CardanoSharp.Wallet.Models.Transactions;
using CardanoSharp.Wallet.TransactionBuilding;
using CardanoSharp.Wallet.Utilities;
using CardanoSharp.Wallet.Models.Keys;
using CardanoSharp.Wallet.Models;
using DotNetEnv;
using Microsoft.Extensions.DependencyInjection;
using System.IO;
using CardanoSharp.Wallet.Extensions.Models;

namespace MintingScript
{
    class Program
    {
        static async Task Main(string[] args)
        {
            // Load .env
            Env.Load();

            string projectId = Environment.GetEnvironmentVariable("BLOCKFROST_PROJECT_ID");
            string mnemonicWords = Environment.GetEnvironmentVariable("MNEMONIC");
            string networkEnv = Environment.GetEnvironmentVariable("NETWORK") ?? "Preprod";
            string tokenNameStr = Environment.GetEnvironmentVariable("TOKEN_NAME") ?? "Australes";
            long tokenAmount = long.Parse(Environment.GetEnvironmentVariable("TOKEN_AMOUNT") ?? "1000000");

            if (string.IsNullOrEmpty(projectId) || string.IsNullOrEmpty(mnemonicWords))
            {
                Console.WriteLine("Missing env vars.");
                return;
            }

            string blockfrostNetwork = networkEnv.ToLower() switch
            {
                "mainnet" => "mainnet",
                "preview" => "preview",
                _ => "preprod"
            };

            var networkType = networkEnv.ToLower() == "mainnet"
                ? NetworkType.Mainnet
                : NetworkType.Testnet;

            // Blockfrost
            var services = new ServiceCollection();
            services.AddBlockfrost(blockfrostNetwork, projectId);
            var provider = services.BuildServiceProvider();

            var txService = provider.GetRequiredService<ITransactionsService>();
            var addressService = provider.GetRequiredService<IAddressesService>();
            var epochService = provider.GetRequiredService<IEpochsService>();
            var blockService = provider.GetRequiredService<IBlocksService>();

            try
            {
                // Restore wallet
                var mnemonic = new MnemonicService().Restore(mnemonicWords);
                var rootKey = mnemonic.GetRootKey();

                // Payment keys m/1852'/1815'/0'/0/0
                var accountKey = rootKey.Derive("m/1852'/1815'/0'");
                var paymentKey = accountKey.Derive("0/0");
                var paymentPrv = paymentKey;
                var paymentPub = paymentKey.GetPublicKey(false);

                // Stake m/1852'/1815'/0'/2/0
                var stakeKey = accountKey.Derive("2/0");
                var stakePub = stakeKey.GetPublicKey(false);

                // Address
                var baseAddr = AddressUtility.GetBaseAddress(paymentPub, stakePub, networkType);
                string address = baseAddr.ToString();
                Console.WriteLine($"Wallet: {address}");

                // Minting policy key m/1852'/1815'/0'/3/0
                var policyKey = accountKey.Derive("3/0");
                var policyPrv = policyKey;
                var policyPub = policyKey.GetPublicKey(false);

                // Simple native script (no timelock)
                var scriptBuilder = NativeScriptBuilder.Create.SetKeyHash(
                    HashUtility.Blake2b224(policyPub.Key)
                );
                var nativeScript = scriptBuilder.Build();
                var policyId = nativeScript.GetPolicyId();

                Console.WriteLine($"Policy ID: {policyId.ToStringHex()}");

                // Protocol params
                var latestEpoch = await epochService.GetLatestAsync();
                var protocolParams = await epochService.GetParametersAsync((int)latestEpoch.Epoch);

                // UTXOs
                var utxos = await addressService.GetUtxosAsync(address, 100, 1, ESortOrder.Asc);
                if (utxos.Count == 0)
                {
                    Console.WriteLine("No UTXOs in wallet.");
                    return;
                }

                // Pick the biggest UTXO that is Pure ADA (to avoid burning other tokens)
                var biggest = utxos
                    .Where(u => AdaHelper.IsPureAda(u))
                    .OrderByDescending(u => AdaHelper.GetLovelaceFromUtxo(u))
                    .FirstOrDefault();

                if (biggest == null)
                {
                    Console.WriteLine("Warning: No Pure ADA UTXO found. Using biggest UTXO (risk of burning tokens).");
                    biggest = utxos
                        .OrderByDescending(u => AdaHelper.GetLovelaceFromUtxo(u))
                        .First();
                }

                long inputLovelace = AdaHelper.GetLovelaceFromUtxo(biggest);
                Console.WriteLine($"Using UTXO with: {inputLovelace} lovelace");

                // Build tx
                var latestBlock = await blockService.GetLatestAsync();
                uint ttl = (uint)latestBlock.Slot + 1000;

                var tokenName = tokenNameStr.ToBytes();
                var tokenBundle = TokenBundleBuilder.Create
                    .AddToken(policyId, tokenName, tokenAmount);

                var txBody = TransactionBodyBuilder.Create
                    .AddInput(biggest.TxHash, (uint)biggest.OutputIndex)
                    .AddOutput(baseAddr, 2_000_000, tokenBundle)
                    .SetTtl(ttl)
                    .SetFee(0)
                    .SetMint(tokenBundle);

                // Witness set
                var witnesses = TransactionWitnessSetBuilder.Create
                    .AddVKeyWitness(paymentPub, paymentPrv)
                    .AddVKeyWitness(policyPub, policyPrv)
                    .AddNativeScript(scriptBuilder);

                // Build tx for fee calc
                // Add dummy change output for accurate fee calculation
                txBody.AddOutput(baseAddr, 0);

                var tx = TransactionBuilder.Create
                    .SetBody(txBody)
                    .SetWitnesses(witnesses)
                    .Build();

                // Fee + Buffer (to be safe)
                var fee = CardanoSharp.Wallet.Extensions.Models.Transactions
                    .TransactionExtensions.CalculateFee(
                        tx,
                        (uint)protocolParams.MinFeeA,
                        (uint)protocolParams.MinFeeB,
                        null, null
                    );

                fee += 1000; // Add 1000 lovelace buffer

                long change = inputLovelace - 2_000_000 - fee;

                if (change < 1_000_000) // Min ADA check for change
                {
                    Console.WriteLine($"Insufficient funds or change too small (Change: {change}).");
                    return;
                }

                // Final tx build with correct fee and change
                var finalTxBody = TransactionBodyBuilder.Create
                    .AddInput(biggest.TxHash, (uint)biggest.OutputIndex)
                    .AddOutput(baseAddr, 2_000_000, tokenBundle)
                    .AddOutput(baseAddr, (ulong)change)
                    .SetTtl(ttl)
                    .SetFee(fee)
                    .SetMint(tokenBundle);

                witnesses = TransactionWitnessSetBuilder.Create
                    .AddVKeyWitness(paymentPub, paymentPrv)
                    .AddVKeyWitness(policyPub, policyPrv)
                    .AddNativeScript(scriptBuilder);

                tx = TransactionBuilder.Create
                    .SetBody(finalTxBody)
                    .SetWitnesses(witnesses)
                    .Build();

                Console.WriteLine("Tx ready. Serializing...");

                var signedTx = CardanoSharp.Wallet.Extensions.Models.Transactions.TransactionExtensions.Serialize(tx);

                Console.WriteLine("Submitting to Blockfrost...");

                File.WriteAllBytes("tx.cbor", signedTx);
                Console.WriteLine("TX CBOR saved as tx.cbor");
                Console.WriteLine(BitConverter.ToString(signedTx));

                using var stream = new MemoryStream(signedTx);
                var txId = await txService.PostTxSubmitAsync(stream);

                Console.WriteLine($"SUCCESS! Tx ID: {txId}");
                Console.WriteLine($"Explorer: https://{blockfrostNetwork}.cardanoscan.io/transaction/{txId}");
            }
            catch (Exception ex)
            {
                Console.WriteLine("ERROR:");
                Console.WriteLine(ex.Message);
                Console.WriteLine(ex.ToString()); // Print full stack trace and inner exceptions
            }
        }
    }
}
