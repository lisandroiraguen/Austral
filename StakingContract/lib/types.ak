use cardano/address.{Address}
use cardano/assets.{AssetName, PolicyId}

pub type DepositDatum {
  beneficiary: Address,
  principal_lovelace: Int,
  tier: Int, // 0=Flexible, 1=1mo, 2=3mo, 3=6mo, 4=12mo
  start_time: Int,
  release_time: Int,
  reward_policy: PolicyId,
  reward_asset: AssetName,
}
