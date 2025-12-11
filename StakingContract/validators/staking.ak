use aiken/collection/list
use aiken/interval.{Finite}
use cardano/address.{Address, VerificationKey}
use cardano/assets.{AssetName, PolicyId}
use cardano/transaction.{NoDatum, OutputReference, Transaction}
use types.{DepositDatum}

pub type Redeemer {
  Claim
}


validator staking {
  spend(
    datum: Option<DepositDatum>,
    _redeemer: Redeemer,
    _oref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(d) = datum
    let Transaction { validity_range, extra_signatories, outputs, .. } = tx

    // 1. Verify Time Lock
    let is_released =
      when validity_range.lower_bound.bound_type is {
        Finite(now) -> now >= d.release_time
        _ -> False
      }

    // 2. Verify Signature
    expect VerificationKey(vkh) = d.beneficiary.payment_credential
    let is_beneficiary = list.has(extra_signatories, vkh)

    // 3. Verify Payout (Principal + Reward)
    // Calculate expected reward: (Principal * Percent) / 100
    let expected_reward = d.principal_lovelace * d.reward_percent / 100

    // Find the output going to the beneficiary
    expect Some(payout) =
      list.find(outputs, fn(output) { output.address == d.beneficiary })

    let payout_lovelace = assets.lovelace_of(payout.value)
    let payout_reward =
      assets.quantity_of(payout.value, d.reward_policy, d.reward_asset)

    let is_paid =
      payout_lovelace >= d.principal_lovelace && payout_reward >= expected_reward

    is_released && is_beneficiary && is_paid
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
    reward_percent: 10,
    release_time: release_time,
    reward_policy: #"11", // Mock Policy
    reward_asset: #"22", // Mock Name
  }

  // Value containing Principal ADA + Reward Token
  let payout_value = 
    assets.from_lovelace(principal)
      |> assets.add(#"11", #"22", reward_amount)

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
    ]
  }

  let oref = OutputReference { transaction_id: #"", output_index: 0 }
  staking.spend(Some(datum), Claim, oref, tx)
}

test fail_early_claim() {
  let owner_pkh = #"01010101010101010101010101010101010101010101010101010101"
  let release_time = 1000
  let principal = 1000000
  let reward_amount = 100000 // 10%
  
  let beneficiary = Address { 
    payment_credential: VerificationKey(owner_pkh), 
    stake_credential: None 
  }
  
  // Minimal setup for early claim fail (should fail before checking output values technically, but let's be safe)
  let datum = DepositDatum {
    beneficiary: beneficiary,
    principal_lovelace: principal,
    reward_percent: 10,
    release_time: release_time,
    reward_policy: #"00",
    reward_asset: #"00",
  }

  // Value containing Principal ADA + Reward Token
  let payout_value = 
    assets.from_lovelace(principal)
      |> assets.add(#"00", #"00", reward_amount)

  // Transaction happened BEFORE release time
  let tx = Transaction { 
    ..transaction.placeholder, 
    validity_range: interval.after(release_time - 1), 
    extra_signatories: [owner_pkh],
    outputs: [
      transaction.Output { 
        address: beneficiary, 
        value: payout_value, 
        datum: NoDatum, 
        reference_script: None 
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
  let principal = 1000000
  let reward_amount = 100000 // 10%
  
  let beneficiary = Address { 
    payment_credential: VerificationKey(owner_pkh), 
    stake_credential: None 
  }
  
  let datum = DepositDatum {
    beneficiary: Address { payment_credential: VerificationKey(owner_pkh), stake_credential: None },
    principal_lovelace: 1000000,
    reward_percent: 10,
    release_time: release_time,
    reward_policy: #"00",
    reward_asset: #"00",
  }

  // Value containing Principal ADA + Reward Token
  let payout_value = 
    assets.from_lovelace(principal)
      |> assets.add(#"00", #"00", reward_amount)

  let tx = Transaction { 
    ..transaction.placeholder, 
    validity_range: interval.after(release_time + 1),
    extra_signatories: [thief_pkh],
    outputs: [
      transaction.Output { 
        address: beneficiary, 
        value: payout_value, 
        datum: NoDatum, 
        reference_script: None 
      }
    ]
  }

  let oref = OutputReference { transaction_id: #"", output_index: 0 }
  !staking.spend(Some(datum), Claim, oref, tx)
}
