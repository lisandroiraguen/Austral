using System;
using System.Collections.Generic;
using System.Linq;
using System.Numerics;
using System.Text.Json;
using System.Threading.Tasks;
using Blockfrost.Api.Services;
using Blockfrost.Api; // For ESortOrder
using CardanoSharp.Wallet.Enums;
using CardanoSharp.Wallet.Extensions;
using CardanoSharp.Wallet.Extensions.Models;
using CardanoSharp.Wallet.Models.Addresses;
using CardanoSharp.Wallet.Models.Keys;
using CardanoSharp.Wallet.Models.Transactions;
using CardanoSharp.Wallet.Models.Transactions.TransactionWitness.PlutusScripts;
using CardanoSharp.Wallet.TransactionBuilding;
using CardanoSharp.Wallet.Utilities;

namespace StakingContractDeploy.Services
{
    public class StakingService : IStakingService
    {
        private readonly IAddressesService _addressService;
        private readonly IBlocksService _blockService;
        private readonly ITransactionsService _txService;
        private readonly IEpochsService _epochService;

        public StakingService(
            IAddressesService addressService,
            IBlocksService blockService,
            ITransactionsService txService,
            IEpochsService epochService)
        {
            _addressService = addressService;
            _blockService = blockService;
            _txService = txService;
            _epochService = epochService;
        }

        public async Task<string> LockFunds(string userAddress, string scriptAddress, PrivateKey paymentPrv, PublicKey paymentPub, PlutusV2Script script)
        {
            var utxos = await _addressService.GetUtxosAsync(userAddress, 100, 1, ESortOrder.Asc);

            var toSpend = utxos.First(u => GetLovelace(u.Amount) > 100_000_000);

            var nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var pkh = HashUtility.Blake2b224(paymentPub.Key);

            var datumData = BuildDatum(pkh, nowMs, 1);

            var latestBlock = await _blockService.GetLatestAsync();
            var protocolParams = await _epochService.GetParametersAsync((int)latestBlock.Epoch);

            var txBody = TransactionBodyBuilder.Create
                .AddInput(toSpend.TxHash, (uint)toSpend.OutputIndex)
                .AddOutput(new Address(scriptAddress), 50_000_000, datumOption: new DatumOption { Data = datumData })
                .SetTtl((uint)latestBlock.Slot + 10000)
                .SetFee(0);

            ulong inputAmt = (ulong)GetLovelace(toSpend.Amount);
            ulong outputAmt = 50_000_000;
            ulong fee = 200_000;
            ulong change = inputAmt - outputAmt - fee;

            txBody.AddOutput(new Address(userAddress), change);

            var witnesses = TransactionWitnessSetBuilder.Create
                .AddVKeyWitness(paymentPub, paymentPrv);

            var tx = TransactionBuilder.Create
                .SetBody(txBody)
                .SetWitnesses(witnesses)
                .Build();

            fee = CardanoSharp.Wallet.Extensions.Models.Transactions.TransactionExtensions.CalculateFee(tx, (uint)protocolParams.MinFeeA, (uint)protocolParams.MinFeeB);

            change = inputAmt - outputAmt - fee;
            var finalTxBody = TransactionBodyBuilder.Create
                .AddInput(toSpend.TxHash, (uint)toSpend.OutputIndex)
                .AddOutput(new Address(scriptAddress), 50_000_000, datumOption: new DatumOption { Data = datumData })
                .AddOutput(new Address(userAddress), change)
                .SetTtl((uint)latestBlock.Slot + 10000)
                .SetFee(fee);

            tx = TransactionBuilder.Create
                .SetBody(finalTxBody)
                .SetWitnesses(witnesses)
                .Build();

            var signedTx = CardanoSharp.Wallet.Extensions.Models.Transactions.TransactionExtensions.Serialize(tx);
            using var stream = new MemoryStream(signedTx);
            var txHash = await _txService.PostTxSubmitAsync(stream);
            Console.WriteLine($"LOCK TX: {txHash}");
            return txHash;
        }

        public async Task UnlockFunds(string userAddress, string scriptAddress, PrivateKey paymentPrv, PlutusV2Script script)
        {
            await Task.CompletedTask;
            Console.WriteLine("Unlock stub... (Use similar IPlutusData logic for Redeeming)");
        }

        // HELPERS
        private IPlutusData BuildDatum(byte[] ownerPkh, long startTime, int months)
        {
            var dictionary = new Dictionary<IPlutusData, IPlutusData>
            {
                { new PlutusDataInt { Value = 0 }, new PlutusDataBytes { Value = ownerPkh } },
                { new PlutusDataInt { Value = 1 }, new PlutusDataInt { Value = 0 } }, // Placeholder for timestamp long
                { new PlutusDataInt { Value = 2 }, new PlutusDataInt { Value = months } }
            };

            return new PlutusDataMap { Value = dictionary };
        }

        private class AmountItem { public string? unit { get; set; } public string? quantity { get; set; } }
        private long GetLovelace(object amountObj)
        {
            var json = JsonSerializer.Serialize(amountObj);
            var list = JsonSerializer.Deserialize<List<AmountItem>>(json) ?? new List<AmountItem>();
            return long.Parse(list.FirstOrDefault(a => a.unit == "lovelace")?.quantity ?? "0");
        }
    }
}
