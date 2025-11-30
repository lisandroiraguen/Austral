using Blockfrost.Api;

namespace MintingScript
{
    public class AdaHelper
    {
        public static long GetLovelaceFromUtxo(Blockfrost.Api.Models.AddressUtxoContentResponse utxo)
        {
            var amountJson = System.Text.Json.JsonSerializer.Serialize(utxo.Amount);
            var amounts = System.Text.Json.JsonSerializer.Deserialize<List<AmountItem>>(amountJson);
            return long.Parse(amounts.First(a => a.unit == "lovelace").quantity);
        }

        public static bool IsPureAda(Blockfrost.Api.Models.AddressUtxoContentResponse utxo)
        {
            var amountJson = System.Text.Json.JsonSerializer.Serialize(utxo.Amount);
            var amounts = System.Text.Json.JsonSerializer.Deserialize<List<AmountItem>>(amountJson);
            return amounts.Count == 1 && amounts.First().unit == "lovelace";
        }
    }
}