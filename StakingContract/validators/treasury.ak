use aiken/collection/list
use aiken/interval.{Finite}
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

// Helper to calculate reward (MUST MATCH STAKING VALIDATOR)
fn get_reward(principal: Int, tier: Int, start: Int, end: Int) -> Int {
  let year_ms = 31536000000
  let rate = 
    if tier == 0 { 35 } 
    else if tier == 1 { 47 }
    else if tier == 2 { 64 }
    else if tier == 3 { 89 }
    else if tier == 4 { 135 }
    else { 0 }
  
  let duration = end - start
  if duration <= 0 { 0 }
  else {
    (principal * rate * duration) / (1000 * year_ms)
  }
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
    
    // Get Time for Flexible Calculation
    // We expect a valid time range for calculation
    let now = 
        when tx.validity_range.lower_bound.bound_type is {
            Finite(t) -> t
            _ -> 0 // If invalid time range, flexible rewards will be 0.
        }

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
    // Calcluate Allowed Reward Outflow by looking at Staking Inputs
    let allowed_outflow = 
        list.foldl(tx.inputs, 0, fn(input, total) {
            when input.output.address.payment_credential is {
                Script(hash) -> {
                    if hash == datum.staking_hash {
                        when input.output.datum is {
                            InlineDatum(d) -> {
                                 // We assume if it comes from the Staking Hash, it IS a DepositDatum.
                                 expect deposit: DepositDatum = d
                                 
                                 // Check if this deposit is claiming the SAME token as this Treasury holds
                                 if deposit.reward_policy == datum.policy_id && deposit.reward_asset == datum.asset_name {
                                     
                                     let calc_end = if deposit.tier == 0 { now } else { deposit.release_time }
                                     let reward = get_reward(deposit.principal_lovelace, deposit.tier, deposit.start_time, calc_end)
                                     
                                     total + reward
                                 } else {
                                     total
                                 }
                            }
                            _ -> total
                        }
                    } else {
                        total
                    }
                }
                _ -> total
            }
        })

    let input_tokens = assets.quantity_of(own_input.output.value, datum.policy_id, datum.asset_name)

    // Calculate total Tokens returning to the same script address
    let output_tokens =
      list.foldl(
        tx.outputs,
        0,
        fn(out, total) {
          if out.address == script_address {
            total + assets.quantity_of(out.value, datum.policy_id, datum.asset_name)
          } else {
            total
          }
        },
      )

    // Enforce: 
    // 1. Output ADA >= Input ADA (Treasury pays no fees)
    // 2. Token Outflow <= Allowed Outflow (Input - Output <= Allowed)
    let token_diff = input_tokens - output_tokens
    
    (input_ada <= output_ada) && (token_diff <= allowed_outflow) && (is_owner || is_staking_present)
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

