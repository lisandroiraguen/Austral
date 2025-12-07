using System;
using CardanoSharp.Wallet.Models.Keys;
using CardanoSharp.Wallet.Models.Transactions.TransactionWitness.PlutusScripts;
using Microsoft.Extensions.DependencyInjection;

namespace StakingContractDeploy.Setup
{
    public class StakingAppContext
    {
        public IServiceProvider Services { get; }
        public string UserAddress { get; }
        public string ScriptAddress { get; }
        public PrivateKey PaymentPrv { get; }
        public PublicKey PaymentPub { get; }
        public PlutusV2Script PlutusScript { get; }

        public StakingAppContext(
            IServiceProvider services,
            string userAddress,
            string scriptAddress,
            PrivateKey paymentPrv,
            PublicKey paymentPub,
            PlutusV2Script plutusScript)
        {
            Services = services;
            UserAddress = userAddress;
            ScriptAddress = scriptAddress;
            PaymentPrv = paymentPrv;
            PaymentPub = paymentPub;
            PlutusScript = plutusScript;
        }
    }
}
