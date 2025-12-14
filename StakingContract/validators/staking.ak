use aiken/collection/list
use aiken/interval.{Finite}
use cardano/address.{Address, VerificationKey}
use cardano/assets.{AssetName, PolicyId}
use cardano/transaction.{InlineDatum, NoDatum, OutputReference, Transaction}
use types.{DepositDatum}

pub type Redeemer {
  Claim
  Refund
}


// Helper to calculate reward
  fn get_reward(principal: Int, tier: Int, start: Int, end: Int) -> Int {
    // 31536000000 = 365 * 24 * 60 * 60 * 1000 (Milliseconds per Year)
    let year_ms = 31536000000
    
    // Rates (scaled by 10): 35=3.5%, 47=4.7%, 64=6.4%, 89=8.9%, 135=13.5%
    let rate = 
      if tier == 0 { 35 }      // Flexible
      else if tier == 1 { 47 } // 1 Month
      else if tier == 2 { 64 } // 3 Months
      else if tier == 3 { 89 } // 6 Months
      else if tier == 4 { 135 } // 12 Months
      else { 0 }
    
    // Duration in milliseconds
    let duration = end - start
    
    if duration <= 0 { 0 }
    else {
      // Formula: (Principal * Rate * Duration) / (YEAR_MS * 1000)
      // Rate is scaled by 10, so divide by 1000 total (100 * 10)
      // Actually: APY is per year.
      // Interest = Principal * (Rate/1000) * (Duration/Year)
      // Interest = (Principal * Rate * Duration) / (1000 * Year)
      (principal * rate * duration) / (1000 * year_ms)
    }
  }

  validator staking {
  spend(
    datum: Option<DepositDatum>,
    redeemer: Redeemer,
    oref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(d) = datum
    let Transaction { validity_range, extra_signatories, outputs, inputs, .. } = tx

    // 1. Verify Time Lock & Start Time validity
    // Current time must be accessible
    expect Finite(now) = validity_range.lower_bound.bound_type
    
    let is_released = now >= d.release_time

    // 2. Verify Signature
    expect VerificationKey(vkh) = d.beneficiary.payment_credential
    let is_beneficiary = list.has(extra_signatories, vkh)

    // 3. Verify Logic depending on Redeemer
    when redeemer is {
        Claim -> {
             // A. Filter all Staking Inputs belonging to THIS Beneficiary
             // Identify Own Address to filter relevant inputs
             expect Some(own_input) = list.find(inputs, fn(i) { i.output_reference == oref })
             let own_address = own_input.output.address

             let (total_principal, total_reward) =
                list.foldl(inputs, (0, 0), fn(input, totals) {
                    if input.output.address == own_address {
                        let (acc_p, acc_r) = totals
                        when input.output.datum is {
                            InlineDatum(data) -> {
                                 // Now safe(r) to expect DepositDatum
                                 expect typed_datum: DepositDatum = data
                                 if typed_datum.beneficiary == d.beneficiary {
                                     // Determine proper end time for calculation
                                     // Flexible (Tier 0) uses NOW. Fixed uses RELEASE_TIME.
                                     let calc_end_time = if typed_datum.tier == 0 { now } else { typed_datum.release_time }
                                     
                                     // For Fixed tiers, we must be past release time to Claim
                                     let can_claim = if typed_datum.tier == 0 { True } else { now >= typed_datum.release_time }
                                     
                                     if can_claim {
                                         let reward = get_reward(typed_datum.principal_lovelace, typed_datum.tier, typed_datum.start_time, calc_end_time)
                                         (acc_p + typed_datum.principal_lovelace, acc_r + reward)
                                     } else {
                                         // If one input is not ready, the whole transaction fails logic if we sum up expected values
                                         // But technically, loop continues. We just expect 0 reward and 0 principal from this?
                                         // No, if we don't include it in 'total_principal', and it IS consumed, checks fail.
                                         // So we fail hard here? Or just let the loop run?
                                         // Creating an invalid state helps fail the tx.
                                         (acc_p + 999999999999, acc_r + 999999999999) 
                                     }
                                 } else {
                                     totals
                                 }
                            }
                            _ -> totals
                        }
                    } else {
                        totals
                    }
                })

             // B. Sum all Outputs going to this Beneficiary
             let (paid_p, paid_r) = 
                list.foldl(outputs, (0,0), fn(output, totals) {
                    let (acc_p, acc_r) = totals
                    if output.address == d.beneficiary {
                        let val_p = assets.lovelace_of(output.value)
                        let val_r = assets.quantity_of(output.value, d.reward_policy, d.reward_asset)
                        (acc_p + val_p, acc_r + val_r)
                    } else {
                        totals
                    }
                })

            is_beneficiary && paid_p >= total_principal && paid_r >= total_reward
        }
        Refund -> {
            // Refund allowed ONLY for Fixed Tiers (Tier > 0) AND BEFORE Release Time.
            // Flexible (Tier 0) cannot Refund (Redundant, use Claim).
            // Fixed (Tier > 0) cannot Refund AFTER Release Time (Use Claim).
            
             // Identify Own Address to filter relevant inputs
             expect Some(own_input) = list.find(inputs, fn(i) { i.output_reference == oref })
             let own_address = own_input.output.address
             
             let (total_principal, valid_refund) =
                list.foldl(inputs, (0, True), fn(input, acc) {
                    let (sum, is_valid) = acc
                    if input.output.address == own_address {
                        when input.output.datum is {
                            InlineDatum(data) -> {
                                 expect typed_datum: DepositDatum = data
                                 if typed_datum.beneficiary == d.beneficiary {
                                    // Check Refund Conditions
                                    let allowed = 
                                        if typed_datum.tier == 0 { False } // Flex cannot refund
                                        else { now < typed_datum.release_time } // Fixed must be early
                                    
                                    if allowed {
                                        (sum + typed_datum.principal_lovelace, is_valid)
                                    } else {
                                        (sum, False)
                                    }
                                 } else {
                                    acc
                                 }
                            }
                            _ -> acc
                        }
                    } else {
                        acc
                    }
                })

             let paid_p = 
                list.foldl(outputs, 0, fn(output, acc) {
                    if output.address == d.beneficiary {
                        acc + assets.lovelace_of(output.value)
                    } else {
                        acc
                    }
                })
            
            is_beneficiary && valid_refund && paid_p >= total_principal
        }
      }
  }
}

// TESTS

test success_claim() {
  let owner_pkh = #"01010101010101010101010101010101010101010101010101010101"
  let release_time = 1000
  let principal = 1000000
  let reward_amount = 100000 // 10%
  
  let beneficiary = Address { 
    payment_credential: VerificationKey(owner_pkh), 
    stake_credential: None 
  }

  let datum = DepositDatum {
    beneficiary: beneficiary,
    principal_lovelace: principal,
    tier: 1, // 1 Month
    start_time: 0,
    release_time: release_time,
    reward_policy: #"11", // Mock Policy
    reward_asset: #"22", // Mock Name
  }

  // Value containing Principal ADA + Reward Token
  // Calculation: 1000000 * 47 * duration (1000) / (1000 * 31536000000) ~= tiny
  // Let's use simple numbers or just ignore exact reward check in test data construction if checking logic.
  // The test checks 'staking.spend(...)'.
  // If I want the test to pass, I must provide enough reward in output.
  // Previous test: reward_amount = 100000.
  // New logic: get_reward(...) result.
  // If I set start=0, release=1000. Duration=1000ms.
  // Reward = (1M * 47 * 1000) / (1000 * 31536M) = 47M / 31T ~= 0.
  // This fails 'paid_r >= total_reward' if expectation > 0.
  // To keep test simple, I can increase duration or rate, OR just ensure output matches what get_reward returns (0).
  
  let payout_value = 
    assets.from_lovelace(principal)
      |> assets.add(#"11", #"22", 0) // Expect 0 reward for short duration

  let oref = OutputReference { transaction_id: #"", output_index: 0 }

  let tx = Transaction { 
    ..transaction.placeholder, 
    validity_range: interval.after(release_time + 1),
    extra_signatories: [owner_pkh],
    outputs: [
      transaction.Output { 
        address: beneficiary, 
        value: payout_value, 
        datum: NoDatum, 
        reference_script: None 
      }
    ],
    inputs: [
        // Mock Input to match 'own_input' lookup
        transaction.Input {
            output_reference: oref,
            output: transaction.Output {
                address: Address { payment_credential: VerificationKey(#"99"), stake_credential: None }, // Dummy Own Address
                value: assets.from_lovelace(principal),
                datum: InlineDatum(datum),
                reference_script: None
            }
        }
    ]
  }

  // We need to pass the right oref and context.
  // My update logic relies on 'inputs' and 'own_input'.
  // Standard test scaffold in Aiken might not set up 'inputs' containing the script unless I do it manually.
  // In the updated validator:
  // expect Some(own_input) = list.find(inputs, fn(i) { i.output_reference == oref })
  // So I MUST add the input to the tx.
  
  staking.spend(Some(datum), Claim, oref, tx)
}

test fail_early_claim() {
  let owner_pkh = #"01010101010101010101010101010101010101010101010101010101"
  let release_time = 1000
  let principal = 1000000
  
  let beneficiary = Address { 
    payment_credential: VerificationKey(owner_pkh), 
    stake_credential: None 
  }
  
  let datum = DepositDatum {
    beneficiary: beneficiary,
    principal_lovelace: principal,
    tier: 1,
    start_time: 0,
    release_time: release_time,
    reward_policy: #"00",
    reward_asset: #"00",
  }

  let oref = OutputReference { transaction_id: #"", output_index: 0 }

  let tx = Transaction { 
    ..transaction.placeholder, 
    validity_range: interval.after(release_time - 1), 
    extra_signatories: [owner_pkh],
    // Add input
    inputs: [
        transaction.Input {
            output_reference: OutputReference { transaction_id: #"", output_index: 0 },
            output: transaction.Output {
                address: Address { payment_credential: VerificationKey(#"99"), stake_credential: None },
                value: assets.from_lovelace(principal),
                datum: InlineDatum(datum),
                reference_script: None
            }
        }
    ]
  }

  let oref = OutputReference { transaction_id: #"", output_index: 0 }
  !staking.spend(Some(datum), Claim, oref, tx)
}

test fail_wrong_signer() {
  let owner_pkh = #"01010101010101010101010101010101010101010101010101010101"
  let thief_pkh = #"02020202020202020202020202020202020202020202020202020202"
  let release_time = 1000
  
  let datum = DepositDatum {
    beneficiary: Address { payment_credential: VerificationKey(owner_pkh), stake_credential: None },
    principal_lovelace: 1000000,
    tier: 1,
    start_time: 0,
    release_time: release_time,
    reward_policy: #"00",
    reward_asset: #"00",
  }

  let tx = Transaction { 
    ..transaction.placeholder, 
    validity_range: interval.after(release_time + 1),
    extra_signatories: [thief_pkh],
  }

  let oref = OutputReference { transaction_id: #"", output_index: 0 }
  !staking.spend(Some(datum), Claim, oref, tx)
}

test success_refund() {
  let owner_pkh = #"01010101010101010101010101010101010101010101010101010101"
  let release_time = 1000
  let principal = 1000000
  
  let beneficiary = Address { 
    payment_credential: VerificationKey(owner_pkh), 
    stake_credential: None 
  }

  let datum = DepositDatum {
    beneficiary: beneficiary,
    principal_lovelace: principal,
    tier: 1, // Fixed Tier
    start_time: 0,
    release_time: release_time,
    reward_policy: #"11",
    reward_asset: #"22",
  }

  // Value containing ONLY Principal ADA, NO Reward Token
  let payout_value = assets.from_lovelace(principal)

  // Must be BEFORE release time to refund fixed tier
  let oref = OutputReference { transaction_id: #"", output_index: 0 }

  let tx = Transaction { 
    ..transaction.placeholder, 
    validity_range: interval.before(release_time - 1),
    extra_signatories: [owner_pkh],
    outputs: [
      transaction.Output { 
        address: beneficiary, 
        value: payout_value, 
        datum: NoDatum, 
        reference_script: None 
      }
    ],
    inputs: [
        transaction.Input {
            output_reference: OutputReference { transaction_id: #"", output_index: 0 },
            output: transaction.Output {
                address: Address { payment_credential: VerificationKey(#"99"), stake_credential: None },
                value: assets.from_lovelace(principal),
                datum: InlineDatum(datum),
                reference_script: None
            }
        }
    ]
  }

  staking.spend(Some(datum), Refund, oref, tx)
}
