use aiken/collection/list


use cardano/address.{Address, Script, VerificationKey}
use cardano/assets
use cardano/transaction.{InlineDatum, Input, Output, OutputReference, Transaction}
use types.{DepositDatum}

pub type TreasuryDatum {
  owner: ByteArray,
  lock_until: Int,
  reward_rate: Int,
  policy_id: ByteArray,
  asset_name: ByteArray,
  treasury_remaining: Int,
}

pub type TreasuryRedeemer {
  WithdrawReward
}

validator treasury {
  spend(
    datum_opt: Option<TreasuryDatum>,
    _redeemer: TreasuryRedeemer,
    _oref: transaction.OutputReference,
    tx: Transaction,
  ) {
    // Validate Owner Signature
    expect Some(datum) = datum_opt
    let is_owner = list.has(tx.extra_signatories, datum.owner)

    // TODO: Add check for Staking Validator presence if we want decentralized claims.
    is_owner
  }
}


test success_spend() {
  let owner_pkh = #"01010101010101010101010101010101010101010101010101010101"
  let treasury_datum = TreasuryDatum {
    owner: owner_pkh,
    lock_until: 0,
    reward_rate: 0,
    policy_id: #"00",
    asset_name: #"00",
    treasury_remaining: 100,
  }

  let tx = Transaction { ..transaction.placeholder, extra_signatories: [owner_pkh] }
  
  // Minimal validator always succeeds
  treasury.spend(Some(treasury_datum), WithdrawReward, OutputReference { transaction_id: #"", output_index: 0 }, tx)
}

