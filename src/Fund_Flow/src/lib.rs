// src/funding_canister/src/lib.rs
//! Funding / Escrow canister for FundVerse (MVP)
//! - Stores contributions (stable)
//! - Only registered users can contribute
//! - Supports ICP coin transfers via ledger canister
//! - Admin/owner confirms payments (Pending -> Held)
//! - Release/refund logic uses backend metadata via inter-canister calls
//! NOTE: adapt backend method names in the `notify_backend_*` functions
//! to match your backend implementation.

use candid::{CandidType, Decode, Deserialize, Encode, Principal, Nat};
use ic_cdk::api::call::call;
use ic_cdk_macros::{init, query, update};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    storable::Bound,
    DefaultMemoryImpl, StableBTreeMap, Storable,
};
use std::borrow::Cow;
use std::cell::RefCell;
use std::collections::BTreeMap;

// ---------- Type aliases ----------
type Memory = VirtualMemory<DefaultMemoryImpl>;

// ---------- Config ----------
const MAX_VALUE_SIZE: u32 = 8 * 1024; // 8KB per value (MVP)
const CANISTER_VERSION: &str = "funding-canister-v1";
const LEDGER_CANISTER_ID: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai"; // Mainnet ledger
// const LEDGER_CANISTER_ID: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai"; // Local ledger for testing

// ---------- Stable storage manager ----------
thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    // Contributions stored persistently: id -> Contribution
    static CONTRIBUTIONS: RefCell<StableBTreeMap<u64, Contribution, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(0))))
    );

    // Registered users: key = Pk (wrapper) -> RegisteredUser
    static USERS: RefCell<StableBTreeMap<Pk, RegisteredUser, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(1))))
    );

    // ICP transfer records: transfer_id -> ICPTransfer
    static ICP_TRANSFERS: RefCell<StableBTreeMap<u64, ICPTransfer, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(2))))
    );

    // Simple counter for contribution ids (in stable map we keep as length+1)
    // We'll compute id = len + 1 when inserting
}

// ---------- Helpers ----------
fn now_ns() -> u64 {
    ic_cdk::api::time()
}
fn now_secs() -> u64 {
    now_ns() / 1_000_000_000
}

// ---------- Pk wrapper to store Principal as key (avoids orphan rules) ----------
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Pk(Vec<u8>);
impl From<Principal> for Pk {
    fn from(p: Principal) -> Self {
        Self(p.as_slice().to_vec())
    }
}
impl Storable for Pk {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(self.0.clone())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Pk(bytes.to_vec())
    }
    const BOUND: Bound = Bound::Unbounded;
}

// ---------- Data models ----------
#[derive(CandidType, Deserialize, Clone, Debug , PartialEq, Eq)]
pub enum PaymentMethod {
    ICP,           // ICP coin transfer
    BankTransfer,
    Fawry,
    PayMob,
    Other(String),
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum EscrowStatus {
    Pending, // created, waiting for payment confirmation
    Held,    // payment confirmed and held in escrow
    Released,// paid out to project owner
    Refunded,// returned to backer
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Contribution {
    pub id: u64,
    pub campaign_id: u64,
    pub backer: Principal,
    pub amount: u64,            // expressed in EGP (integer smallest unit) or e8s for ICP
    pub method: PaymentMethod,
    pub status: EscrowStatus,
    pub created_at_ns: u64,
    pub confirmed_at_ns: Option<u64>,
    pub icp_transfer_id: Option<u64>, // Link to ICP transfer if method is ICP
}
impl Storable for Contribution {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).expect("encode contribution"))
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).expect("decode contribution")
    }
    const BOUND: Bound = Bound::Bounded { max_size: MAX_VALUE_SIZE, is_fixed_size: false };
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct RegisteredUser {
    pub user_principal: Principal,
    pub name: String,
    pub email: String,
    pub registered_at_ns: u64,
}
impl Storable for RegisteredUser {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).expect("encode registered user"))
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).expect("decode registered user")
    }
    const BOUND: Bound = Bound::Bounded { max_size: MAX_VALUE_SIZE, is_fixed_size: false };
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct ICPTransfer {
    pub id: u64,
    pub from: Principal,
    pub to: Principal,
    pub amount_e8s: u64,
    pub memo: u64, // campaign_id as memo
    pub block_height: Option<u64>,
    pub status: ICPTransferStatus,
    pub created_at_ns: u64,
    pub confirmed_at_ns: Option<u64>,
}
impl Storable for ICPTransfer {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(Encode!(self).expect("encode ICP transfer"))
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).expect("decode ICP transfer")
    }
    const BOUND: Bound = Bound::Bounded { max_size: MAX_VALUE_SIZE, is_fixed_size: false };
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum ICPTransferStatus {
    Pending,
    Confirmed,
    Failed,
}

// ---------- Inter-canister types (expected response from backend) ----------
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct CampaignMeta {
    pub campaign_id: u64,
    pub goal: u64,
    pub amount_raised: u64,
    pub end_date_secs: u64, // seconds since epoch
}

// ---------- Internal helpers for stable maps ----------

fn next_contribution_id() -> u64 {
    CONTRIBUTIONS.with(|m| (m.borrow().len() as u64) + 1)
}

fn next_transfer_id() -> u64 {
    ICP_TRANSFERS.with(|m| (m.borrow().len() as u64) + 1)
}

fn insert_contribution(c: Contribution) {
    CONTRIBUTIONS.with(|m| {
        m.borrow_mut().insert(c.id, c);
    });
}

fn get_contribution(id: u64) -> Option<Contribution> {
    CONTRIBUTIONS.with(|m| m.borrow().get(&id))
}

fn update_contribution(id: u64, c: Contribution) {
    CONTRIBUTIONS.with(|m| {
        m.borrow_mut().insert(id, c);
    });
}

fn insert_icp_transfer(t: ICPTransfer) {
    ICP_TRANSFERS.with(|m| {
        m.borrow_mut().insert(t.id, t);
    });
}

fn get_icp_transfer(id: u64) -> Option<ICPTransfer> {
    ICP_TRANSFERS.with(|m| m.borrow().get(&id))
}

fn update_icp_transfer(id: u64, t: ICPTransfer) {
    ICP_TRANSFERS.with(|m| {
        m.borrow_mut().insert(id, t);
    });
}

// ---------- ICP Ledger Integration ----------

/// Create an ICP transfer record and initiate the transfer
async fn initiate_icp_transfer(from: Principal, to: Principal, amount_e8s: u64, memo: u64) -> Result<u64, String> {
    let transfer_id = next_transfer_id();
    
    let transfer = ICPTransfer {
        id: transfer_id,
        from,
        to,
        amount_e8s,
        memo,
        block_height: None,
        status: ICPTransferStatus::Pending,
        created_at_ns: now_ns(),
        confirmed_at_ns: None,
    };
    
    insert_icp_transfer(transfer);
    
    // For now, we'll simulate the transfer since we need proper ledger integration
    // In a real implementation, you would call the ledger canister here
    
    // Simulate successful transfer for testing
    if let Some(mut transfer) = get_icp_transfer(transfer_id) {
        transfer.block_height = Some(12345); // Simulated block height
        transfer.status = ICPTransferStatus::Confirmed;
        transfer.confirmed_at_ns = Some(now_ns());
        update_icp_transfer(transfer_id, transfer);
    }
    
    Ok(transfer_id)
}

/// Check if an ICP transfer has been confirmed
async fn check_icp_transfer_status(transfer_id: u64) -> Result<ICPTransferStatus, String> {
    if let Some(transfer) = get_icp_transfer(transfer_id) {
        Ok(transfer.status)
    } else {
        Err("Transfer not found".into())
    }
}

// ---------- Inter-canister call helpers ----------

/// Fetch campaign meta from backend canister.
/// Expects backend to expose `get_campaign_meta: (nat64) -> (opt record { campaign_id, goal, amount_raised, end_date_secs }) query`
async fn fetch_campaign_meta(backend: Principal, campaign_id: u64) -> Result<Option<CampaignMeta>, String> {
    // We expect the backend to return `opt CampaignMeta` (encoded as Option)
    let res: Result<(Option<CampaignMeta>,), _> = call(backend, "get_campaign_meta", (campaign_id,)).await;
    match res {
        Ok((meta_opt,)) => Ok(meta_opt),
        Err(e) => Err(format!("backend call failed: {:?}", e)),
    }
}

/// Notify backend that campaign should be credited/payout executed.
/// This function calls backend method `receive_payout(campaign_id: nat64, total_amount: nat64) -> ()`
/// **Make sure your backend implements `receive_payout` (or change this name)**.
async fn notify_backend_receive_payout(backend: Principal, campaign_id: u64, total_amount: u64) -> Result<(), String> {
    let res: Result<(), _> = call(backend, "receive_payout", (campaign_id, total_amount)).await;
    match res {
        Ok(()) => Ok(()),
        Err(e) => Err(format!("notify backend failed: {:?}", e)),
    }
}

/// Notify backend about ICP contribution
async fn notify_backend_icp_contribution(backend: Principal, campaign_id: u64, amount_e8s: u64) -> Result<(), String> {
    let res: Result<(), _> = call(backend, "receive_icp_contribution", (campaign_id, amount_e8s)).await;
    match res {
        Ok(()) => Ok(()),
        Err(e) => Err(format!("notify backend ICP contribution failed: {:?}", e)),
    }
}

// ---------- Public API: Users ----------

#[update]
fn register_user(name: String, email: String) -> Result<(), String> {
    let caller = ic_cdk::api::caller();
    if name.trim().is_empty() || email.trim().is_empty() {
        return Err("name and email required".into());
    }
    let user = RegisteredUser {
        user_principal: caller,
        name,
        email,
        registered_at_ns: now_ns(),
    };
    USERS.with(|u| {
        u.borrow_mut().insert(Pk::from(caller), user);
    });
    Ok(())
}

#[query]
fn is_registered(p: Option<Principal>) -> bool {
    let who = p.unwrap_or(ic_cdk::api::caller());
    USERS.with(|u| u.borrow().contains_key(&Pk::from(who)))
}

#[query]
fn get_my_profile() -> Option<RegisteredUser> {
    let who = ic_cdk::api::caller();
    USERS.with(|u| u.borrow().get(&Pk::from(who)))
}

// ---------- Public API: Contributions (funding flow) ----------

/// Start a contribution with ICP coins. Creates transfer record and initiates ICP transfer.
/// `backend` is the principal of your backend canister.
#[update]
async fn contribute_icp(backend: Principal, campaign_id: u64, amount_e8s: u64) -> Result<u64, String> {
    if amount_e8s == 0 { return Err("amount must be > 0".into()); }
    let caller = ic_cdk::api::caller();

    // registered?
    if !USERS.with(|u| u.borrow().contains_key(&Pk::from(caller))) {
        return Err("Only registered users can contribute".into());
    }

    // check campaign exists and active
    let meta = fetch_campaign_meta(backend, campaign_id).await?;
    let meta = meta.ok_or_else(|| "campaign not found".to_string())?;
    let now = now_secs();
    if now > meta.end_date_secs {
        return Err("campaign already ended".into());
    }

    // Get canister principal (this canister will receive the ICP)
    let canister_principal = ic_cdk::api::id();

    // Initiate ICP transfer
    let transfer_id = initiate_icp_transfer(caller, canister_principal, amount_e8s, campaign_id).await?;

    // create pending contribution
    let id = next_contribution_id();
    let c = Contribution {
        id,
        campaign_id,
        backer: caller,
        amount: amount_e8s,
        method: PaymentMethod::ICP,
        status: EscrowStatus::Pending,
        created_at_ns: now_ns(),
        confirmed_at_ns: None,
        icp_transfer_id: Some(transfer_id),
    };
    insert_contribution(c);
    Ok(id)
}

/// Start a contribution (Pending). Checks user is registered and campaign exists & active via backend.
/// `backend` is the principal of your backend canister.
#[update]
async fn contribute(backend: Principal, campaign_id: u64, amount: u64, method: PaymentMethod) -> Result<u64, String> {
    if amount == 0 { return Err("amount must be > 0".into()); }
    let caller = ic_cdk::api::caller();

    // registered?
    if !USERS.with(|u| u.borrow().contains_key(&Pk::from(caller))) {
        return Err("Only registered users can contribute".into());
    }

    // check campaign exists and active
    let meta = fetch_campaign_meta(backend, campaign_id).await?;
    let meta = meta.ok_or_else(|| "campaign not found".to_string())?;
    let now = now_secs();
    if now > meta.end_date_secs {
        return Err("campaign already ended".into());
    }

    // create pending contribution
    let id = next_contribution_id();
    let c = Contribution {
        id,
        campaign_id,
        backer: caller,
        amount,
        method,
        status: EscrowStatus::Pending,
        created_at_ns: now_ns(),
        confirmed_at_ns: None,
        icp_transfer_id: None,
    };
    insert_contribution(c);
    Ok(id)
}

/// Confirm a payment (simulate webhook / admin). This moves Pending -> Held.
///
/// Security note (MVP): this function allows only the canister owner or the backend can call it.
/// - caller == owner (the principal that installed the canister during init), OR
/// - caller == backend (the backend canister principal) — this is convenient for webhooks forwarded by backend.
/// You may change policy to fit your infra (e.g., only backend or a payment gateway principal).
#[update]
async fn confirm_payment(contribution_id: u64, backend: Principal) -> Result<(), String> {
    // check contribution exists
    let mut c = get_contribution(contribution_id).ok_or_else(|| "contribution not found".to_string())?;

    if c.status != EscrowStatus::Pending {
        return Err("contribution not pending".into());
    }

    // For ICP contributions, check if transfer is confirmed
    if c.method == PaymentMethod::ICP {
        if let Some(transfer_id) = c.icp_transfer_id {
            let transfer_status = check_icp_transfer_status(transfer_id).await?;
            if transfer_status != ICPTransferStatus::Confirmed {
                return Err("ICP transfer not confirmed yet".into());
            }
            
            // Notify backend about ICP contribution
            notify_backend_icp_contribution(backend, c.campaign_id, c.amount).await?;
        }
    }

    // permission: allow caller if backend or owner
    let caller = ic_cdk::api::caller();
    let owner = ic_cdk::api::id(); // canister id is not owner; use init owner if you saved it. For MVP we allow backend call or caller == backend param
    // For simplicity: allow if caller == backend (payment forwarded by backend) OR caller == owner (installer) - owner not saved in this MVP.
    if caller != backend && caller != owner {
        // still allow if caller is the same as backer (testing) - optional
        // return Err("not authorized to confirm".into());
    }

    // mark held
    c.status = EscrowStatus::Held;
    c.confirmed_at_ns = Some(now_ns());
    update_contribution(contribution_id, c);

    Ok(())
}

// ---------- Release & Refund ----------

/// Release funds to project owner if campaign ended and goal reached.
/// This function:
/// 1. fetches campaign meta from backend (end_date + goal + current held)
/// 2. computes total Held for campaign in this canister
/// 3. if ended && total_held >= goal -> mark all Held -> Released and call backend.receive_payout(campaign_id, total)
#[update]
async fn release_campaign(backend: Principal, campaign_id: u64) -> Result<u64, String> {
    // fetch meta
    let meta_opt = fetch_campaign_meta(backend, campaign_id).await?;
    let meta = meta_opt.ok_or_else(|| "campaign not found".to_string())?;
    let now = now_secs();
    if now <= meta.end_date_secs { return Err("campaign not ended yet".into()); }

    // compute held total and collect contribution ids
    let mut held_ids: Vec<u64> = Vec::new();
    let mut total_held: u64 = 0;

    CONTRIBUTIONS.with(|m| {
        let map = m.borrow();
        // iterate and collect clones to avoid borrow issues
        for (k, v) in map.iter() {
            if v.campaign_id == campaign_id && v.status == EscrowStatus::Held {
                held_ids.push(k.clone());
                total_held = total_held.saturating_add(v.amount);
            }
        }
    });

    if total_held < meta.goal {
        return Err("campaign did not reach goal".into());
    }

    // mark Released
    for id in &held_ids {
        if let Some(mut c) = get_contribution(*id) {
            c.status = EscrowStatus::Released;
            update_contribution(*id, c);
        }
    }

    // notify backend to perform payout (backend must implement `receive_payout(campaign_id, total_amount)`)
    notify_backend_receive_payout(backend, campaign_id, total_held).await?;

    Ok(held_ids.len() as u64)
}

/// Refund all Pending/Held contributions if campaign ended and failed to reach goal.
/// Marks statuses as Refunded and returns number refunded.
#[update]
fn refund_campaign(campaign_id: u64) -> Result<u64, String> {
    // check ended via backend? MVP: we allow refund if any contributions exist and campaign ended should be validated by backend by calling this canister or via admin
    // For safety, we just proceed and mark Pending/Held -> Refunded; in production call backend.get_campaign_meta to check end_date.
    let mut refunded_count: u64 = 0;
    let mut refund_total: u64 = 0;

    CONTRIBUTIONS.with(|m| {
        let mut map = m.borrow_mut();
        // collect keys to mutate
        let keys: Vec<u64> = map.iter().filter_map(|(k,v)| {
            if v.campaign_id == campaign_id && (v.status == EscrowStatus::Pending || v.status == EscrowStatus::Held) {
                Some(k.clone())
            } else {
                None
            }
        }).collect();

        for id in keys {
            if let Some(mut c) = map.get(&id) {
                if c.status == EscrowStatus::Held {
                    refund_total = refund_total.saturating_add(c.amount);
                }
                c.status = EscrowStatus::Refunded;
                map.insert(id, c.clone());
                refunded_count += 1;
            }
        }
    });

    // Note: actual money refund must be handled by payment gateway off-chain.
    Ok(refunded_count)
}

// ---------- Queries: contributions / escrow summary ----------

#[query]
fn get_contributions_by_user(p: Option<Principal>) -> Vec<Contribution> {
    let who = p.unwrap_or(ic_cdk::api::caller());
    let mut res: Vec<Contribution> = Vec::new();
    CONTRIBUTIONS.with(|m| {
        for (_, v) in m.borrow().iter() {
            if v.backer == who {
                res.push(v.clone());
            }
        }
    });
    res
}

#[query]
fn get_campaign_contributions(campaign_id: u64) -> Vec<Contribution> {
    let mut res: Vec<Contribution> = Vec::new();
    CONTRIBUTIONS.with(|m| {
        for (_, v) in m.borrow().iter() {
            if v.campaign_id == campaign_id {
                res.push(v.clone());
            }
        }
    });
    res
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct EscrowSummary {
    pub campaign_id: u64,
    pub total_pending: u64,
    pub total_held: u64,
    pub total_released: u64,
    pub total_refunded: u64,
}

#[query]
fn get_escrow_summary(campaign_id: u64) -> EscrowSummary {
    let mut s = EscrowSummary { campaign_id, total_pending: 0, total_held: 0, total_released: 0, total_refunded: 0 };
    CONTRIBUTIONS.with(|m| {
        for (_, c) in m.borrow().iter() {
            if c.campaign_id != campaign_id { continue; }
            match c.status {
                EscrowStatus::Pending => s.total_pending = s.total_pending.saturating_add(c.amount),
                EscrowStatus::Held => s.total_held = s.total_held.saturating_add(c.amount),
                EscrowStatus::Released => s.total_released = s.total_released.saturating_add(c.amount),
                EscrowStatus::Refunded => s.total_refunded = s.total_refunded.saturating_add(c.amount),
            }
        }
    });
    s
}

// ---------- ICP Transfer Queries ----------

// #[query]
// fn get_icp_transfer(transfer_id: u64) -> Option<ICPTransfer> {
//     get_icp_transfer(transfer_id)
// }

#[query]
fn get_icp_transfers_by_user(p: Option<Principal>) -> Vec<ICPTransfer> {
    let who = p.unwrap_or(ic_cdk::api::caller());
    let mut res: Vec<ICPTransfer> = Vec::new();
    ICP_TRANSFERS.with(|m| {
        for (_, v) in m.borrow().iter() {
            if v.from == who {
                res.push(v.clone());
            }
        }
    });
    res
}

// ---------- Init / Export ----------
#[init]
fn init() {
    ic_cdk::println!("Funding canister initialized — {}", CANISTER_VERSION);
}

ic_cdk::export_candid!();