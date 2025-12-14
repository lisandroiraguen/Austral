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
  staking_hash: ByteArray,
}

pub type TreasuryRedeemer {
  WithdrawReward
}

validator treasury {
  spend(
    datum_opt: Option<TreasuryDatum>,
    _redeemer: TreasuryRedeemer,
    oref: transaction.OutputReference,
    tx: Transaction,
  ) {
    // Validate Owner Signature
    expect Some(datum) = datum_opt
    let is_owner = list.has(tx.extra_signatories, datum.owner)

    // Check if Staking Contract is present in inputs
    let is_staking_present = 
      list.any(tx.inputs, fn(input) {
         when input.output.address.payment_credential is {
           Script(hash) -> hash == datum.staking_hash
           _ -> False
         }
      })

    // Find own input to check ADA conservation
    expect Some(own_input) =
      list.find(tx.inputs, fn(input) { input.output_reference == oref })
    let input_ada = assets.lovelace_of(own_input.output.value)

    // Calculate total ADA returning to the same script address
    let script_address = own_input.output.address
    let output_ada =
      list.foldl(
        tx.outputs,
        0,
        fn(out, total) {
          if out.address == script_address {
            total + assets.lovelace_of(out.value)
          } else {
            total
          }
        },
      )

    // Enforce: Output ADA must be >= Input ADA (Treasury doesn't pay fees)
    (input_ada <= output_ada) && (is_owner || is_staking_present)
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
    staking_hash: #"00",
  }

  let tx = Transaction { ..transaction.placeholder, extra_signatories: [owner_pkh] }
  
  // Minimal validator always succeeds
  treasury.spend(Some(treasury_datum), WithdrawReward, OutputReference { transaction_id: #"", output_index: 0 }, tx)
}

