use cardano/address.{Address}
use cardano/assets.{AssetName, PolicyId}

pub type DepositDatum {
  beneficiary: Address,
  principal_lovelace: Int,
  reward_percent: Int,
  release_time: Int,
  reward_policy: PolicyId,
  reward_asset: AssetName,
}
