using System.Threading.Tasks;
using CardanoSharp.Wallet.Models.Keys;
using CardanoSharp.Wallet.Models.Transactions.TransactionWitness.PlutusScripts;

namespace StakingContractDeploy.Services
{
    public interface IStakingService
    {
        // Task<string> LockFunds(string userAddress, string scriptAddress, PrivateKey paymentPrv, PublicKey paymentPub); // Removed unused overload
        // Actually, matching Program.cs:
        Task<string> LockFunds(string userAddress, string scriptAddress, PrivateKey paymentPrv, PublicKey paymentPub, PlutusV2Script script);
        Task UnlockFunds(string userAddress, string scriptAddress, PrivateKey paymentPrv, PlutusV2Script script);
    }
}
