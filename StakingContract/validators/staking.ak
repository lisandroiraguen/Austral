use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval
use cardano/assets.{PolicyId, AssetName}
use cardano/transaction

pub type POSIXTime = Int

pub type StakingDatum {
  owner: VerificationKeyHash,
  start_time: POSIXTime,
  lock_period_months: Int, // 1, 3, 6, 12
}

pub type StakingRedeemer {
  Withdraw
}

// ⚠️ PLACEHOLDERS: Replace these with your actual Token Policy ID and Asset Name
const test_token_policy: PolicyId = "00000000000000000000000000000000000000000000000000000000"
const test_token_name: AssetName = "TEST"

// Helper to calculate milliseconds for months (approximate: 30 days)
fn months_to_millis(months: Int) -> Int {
  months * 30 * 24 * 60 * 60 * 1000
}

validator staking {
  spend(
    datum: Option<StakingDatum>,
    _redeemer: StakingRedeemer,
    _ref: transaction.OutputReference,
    self: transaction.Transaction,
  ) {
    expect Some(datum) = datum
    
    // 1. Signature Check: Must be signed by the owner
    let must_be_signed = list.has(self.extra_signatories, datum.owner)

    // 2. Time Lock Check
    // Calculate unlock time
    let lock_duration = months_to_millis(datum.lock_period_months)
    let unlock_time = datum.start_time + lock_duration
    
    // The transaction's validity range lower bound must be after the unlock time
    let is_after_lock_period = 
      when self.validity_range.lower_bound.bound_type is {
        interval.Finite(now) -> now >= unlock_time
        _ -> False
      }

    // 3. (Optional) Reward Check logic could go here. 
    // For now, we strictly ensure they waited the time and signed it.
    
    must_be_signed && is_after_lock_period
  }
}

test success_withdraw() {
  let owner = #"00000000000000000000000000000000000000000000000000000000"
  let start_time = 1000
  let months = 1
  let datum = StakingDatum { owner, start_time, lock_period_months: months }
  
  // Create a context where time is AFTER start + 1 month
  let one_month_millis = 2592000000 // 30 * 24 * 60 * 60 * 1000
  let unlock_time = start_time + one_month_millis
  let valid_time = unlock_time + 1 

  let tx = transaction.Transaction { 
    ..transaction.placeholder, 
    extra_signatories: [owner], 
    validity_range: interval.after(valid_time)
  }

  let mock_utxo_ref = transaction.OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000000",
    output_index: 0,
  }

  staking.spend(Some(datum), Withdraw, mock_utxo_ref, tx)
}

test fail_too_early() {
  let owner = #"00000000000000000000000000000000000000000000000000000000"
  let start_time = 1000
  let months = 1
  let datum = StakingDatum { owner, start_time, lock_period_months: months }
  
  // Create a context where time is BEFORE unlock
  let unlock_time = start_time + months_to_millis(months)
  let too_early_time = unlock_time - 1000 // Ensure it's definitely before

  let tx = transaction.Transaction { 
    ..transaction.placeholder, 
    extra_signatories: [owner], 
    validity_range: interval.between(start_time, too_early_time) 
    // Using a finite range that ends before the unlock time
  }
  
  let mock_utxo_ref = transaction.OutputReference {
    transaction_id: #"0000000000000000000000000000000000000000000000000000000000000000",
    output_index: 0,
  }

  !staking.spend(Some(datum), Withdraw, mock_utxo_ref, tx)
}
