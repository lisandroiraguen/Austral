using System;
using System.IO;
using System.Text.Json;
using System.Linq; // Added for HexToByteArray usage if moved or we add logic here
using Microsoft.Extensions.DependencyInjection;
using Blockfrost.Api;
using Blockfrost.Api.Extensions;
using CardanoSharp.Wallet;
using CardanoSharp.Wallet.Enums;
using CardanoSharp.Wallet.Extensions;
using CardanoSharp.Wallet.Extensions.Models;
using CardanoSharp.Wallet.Models.Keys;
using CardanoSharp.Wallet.Models.Transactions.TransactionWitness.PlutusScripts;
using CardanoSharp.Wallet.Utilities;
using CardanoSharp.Wallet.Models.Addresses;
using StakingContractDeploy.Services;

namespace StakingContractDeploy.Setup
{
    public class StakingAppBuilder
    {
        private string _network = "preprod";
        private string? _projectId;
        private string? _mnemonicWords;
        private string? _scriptPath;
        private IServiceCollection _services;

        public static StakingAppBuilder Create()
        {
            return new StakingAppBuilder();
        }

        public StakingAppBuilder()
        {
            _services = new ServiceCollection();
        }

        public StakingAppBuilder WithBlockfrost(string network, string projectId)
        {
            _network = network;
            _projectId = projectId;
            return this;
        }

        public StakingAppBuilder WithWallet(string mnemonic)
        {
            _mnemonicWords = mnemonic;
            return this;
        }

        public StakingAppBuilder WithScript(string filePath)
        {
            _scriptPath = filePath;
            return this;
        }

        public StakingAppContext Build()
        {
            if (string.IsNullOrEmpty(_projectId)) throw new Exception("Blockfrost Project ID is required.");
            if (string.IsNullOrEmpty(_mnemonicWords)) throw new Exception("Mnemonic is required.");
            if (string.IsNullOrEmpty(_scriptPath)) throw new Exception("Script path is required.");

            // 1. Services
            _services.AddBlockfrost(_network, _projectId);
            _services.AddSingleton<IStakingService, StakingService>();
            var provider = _services.BuildServiceProvider();

            // 2. Wallet
            var mnemonic = new MnemonicService().Restore(_mnemonicWords);
            var rootKey = mnemonic.GetRootKey();
            var paymentPrv = rootKey.Derive("m/1852'/1815'/0'/0/0");
            var paymentPub = paymentPrv.GetPublicKey(false);

            // NetworkType parsing or explicit
            var netType = _network == "mainnet" ? NetworkType.Mainnet : NetworkType.Testnet; // Simplification

            var baseAddr = AddressUtility.GetEnterpriseAddress(paymentPub, netType);
            var userAddress = baseAddr.ToString();

            // 3. Script
            var plutusScript = LoadPlutusScript(_scriptPath);
            var scriptAddress = CalculateScriptAddress(plutusScript, netType);

            return new StakingAppContext(provider, userAddress, scriptAddress, paymentPrv, paymentPub, plutusScript);
        }

        private PlutusV2Script LoadPlutusScript(string path)
        {
            var plutusJson = File.ReadAllText(path);
            var jsonDoc = JsonDocument.Parse(plutusJson);
            var validators = jsonDoc.RootElement.GetProperty("validators");
            var firstValidator = validators[0];
            var cborHex = firstValidator.GetProperty("compiledCode").GetString()!;
            return new PlutusV2Script { script = HexToByteArray(cborHex) };
        }

        private string CalculateScriptAddress(PlutusV2Script script, NetworkType network)
        {
            var scriptHash = HashUtility.Blake2b224(script.script);
            // Header: 0x70 for Testnet Enterprise Script, 0x71 for Mainnet?
            // Actually: 
            // Enterprise Script Credential = 0011 (3) ? No, Enterprise Key is 6.
            // Script Credential = 0111 (7) for Enterprise Script.
            // Network: Testnet=0, Mainnet=1.
            // Byte = (HeaderType << 4) | Network.
            // 0x70 = 7<<4 | 0 = 112 | 0 = 112 (0x70). Correct for Testnet.
            // 0x71 = 7<<4 | 1 = 113 (0x71). Correct for Mainnet.

            byte header = (byte)(0x70);
            if (network == NetworkType.Mainnet) header = 0x71;

            var addressBytes = new byte[1 + scriptHash.Length];
            addressBytes[0] = header;
            Array.Copy(scriptHash, 0, addressBytes, 1, scriptHash.Length);
            return new Address(addressBytes).ToString();
        }

        private byte[] HexToByteArray(string hex)
        {
            return Enumerable.Range(0, hex.Length)
                             .Where(x => x % 2 == 0)
                             .Select(x => Convert.ToByte(hex.Substring(x, 2), 16))
                             .ToArray();
        }
    }
}
