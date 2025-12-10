use aiken/collection/list
use cardano/transaction.{OutputReference, Transaction, Input, Output}
use cardano/assets.{lovelace_of, quantity_of}
use aiken/interval.{Finite}

// Types
pub type POSIXTime = Int

pub type StakingDatum {
  owner: ByteArray,
  start_time: POSIXTime,
  lock_period_months: Int,
}

pub type StakingRedeemer {
  Withdraw
}

// Constants
const reward_policy_id: ByteArray = #"9ea5cd066fda8431f52565159c426b1717c8ffc9d7a1fbcda62e3b5c"
const reward_asset_name: ByteArray = #"4175737472616c2d54657374"

// Helper functions
fn months_to_millis(months: Int) -> Int {
  months * 30 * 24 * 60 * 60 * 1000
}

// APY rates in basis points (multiply by 100 for percentage)
// Flexible: 3.5%, 1 mes: 4.7%, 3 meses: 6.4%, 6 meses: 8.9%, 12 meses: 13.5%
fn get_apy_bps(months: Int) -> Int {
  if months <= 0 {
    350  // 3.5% - Flexible
  } else if months == 1 {
    470  // 4.7%
  } else if months <= 3 {
    640  // 6.4%
  } else if months <= 6 {
    890  // 8.9%
  } else {
    1350  // 13.5% - 12 meses o más
  }
}

fn calculate_reward(months: Int, ada_lovelace: Int) -> Int {
  let apy_bps = get_apy_bps(months)
  // reward = (ada * apy_bps * months) / (10000 * 12)
  // Simplificado: (ada * apy_bps * months) / 120000
  ada_lovelace * apy_bps * months / 120000
}

// Validator
validator staking {
  spend(
    datum: Option<StakingDatum>,
    redeemer: StakingRedeemer,
    _own_ref: OutputReference,
    tx: Transaction,
  ) -> Bool {
    expect Some(d) = datum
    expect Withdraw = redeemer
    
    let StakingDatum { owner, start_time, lock_period_months } = d
    
    // 1. Check signature
    let signed = list.has(tx.extra_signatories, owner)
    
    // 2. Check time lock
    let unlock_time = start_time + months_to_millis(lock_period_months)
    let time_ok = when tx.validity_range.lower_bound.bound_type is {
      Finite(now) -> now >= unlock_time
      _ -> False
    }
    
    // Validation
    signed && time_ok
  }
}
