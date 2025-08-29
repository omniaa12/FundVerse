use candid::{CandidType, Deserialize, Principal};
use ic_cdk::api::time;
use ic_cdk::{caller, trap};
use ic_cdk_macros::{init, post_upgrade, pre_upgrade, query, update};
use std::cell::RefCell;
use std::collections::{BTreeMap, BTreeSet};

/// ====== Domain Types ======

#[derive(Clone, Debug, CandidType, Deserialize, PartialEq, Eq)]
pub enum Role {
    Admin,
    User,
}

#[derive(Clone, Debug, CandidType, Deserialize, PartialEq, Eq)]
pub enum IdeaStatus {
    Pending,
    Approved,
    Rejected,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct RegisteredUser {
    pub principal: Principal,
    pub name: String,
    pub email: String,
    pub role: Role,
    pub registered_at_ns: u64,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct Idea {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub submitted_by: Principal,
    pub submitted_at_ns: u64,
    pub status: IdeaStatus,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct ApproveRejectResult {
    pub id: u64,
    pub status: IdeaStatus,
}

#[derive(Clone, Debug, CandidType, Deserialize)]
pub enum AdminError {
    NotAuthorized,
    UserNotFound,
    IdeaNotFound,
    AlreadyExists,
    InvalidInput(String),
}

type Result<T> = std::result::Result<T, AdminError>;

/// ====== State ======

#[derive(Default, CandidType, Deserialize , Clone)]
struct State {
    users: BTreeMap<Principal, RegisteredUser>,
    ideas: BTreeMap<u64, Idea>,
    next_idea_id: u64,
    admins: BTreeSet<Principal>,
}

thread_local! {
    static STATE: RefCell<State> = RefCell::new(State::default());
}

/// Small helpers
fn is_admin(p: Principal) -> bool {
    STATE.with(|s| s.borrow().admins.contains(&p))
}

fn ensure_admin() -> Result<()> {
    if is_admin(caller()) {
        Ok(())
    } else {
        Err(AdminError::NotAuthorized)
    }
}

/// ====== Lifecycle ======

#[init]
fn init() {
    // The installer becomes the first admin
    let me = caller();
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        st.admins.insert(me);
        // optionally bootstrap a user record for the installer
        st.users.entry(me).or_insert(RegisteredUser {
            principal: me,
            name: "Deployer".to_string(),
            email: "".to_string(),
            role: Role::Admin,
            registered_at_ns: time(),
        });
    });
}

#[pre_upgrade]
fn pre_upgrade() {
    let state = STATE.with(|s| s.borrow().clone());
    ic_cdk::storage::stable_save((state,)).expect("stable_save failed");
}

#[post_upgrade]
fn post_upgrade() {
    let (state,): (State,) = ic_cdk::storage::stable_restore().unwrap_or_default();
    STATE.with(|s| *s.borrow_mut() = state);
}

/// ====== User Management ======

#[update]
fn register_user(name: String, email: String) -> RegisteredUser {
    let me = caller();
    let now = time();
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        let is_admin = st.admins.contains(&me);
        let entry = st.users.entry(me).or_insert(RegisteredUser {
            principal: me,
            name: name.clone(),
            email: email.clone(),
            role: if is_admin { Role::Admin } else { Role::User },
            registered_at_ns: now,
        });
        // allow update of name/email but keep original timestamp & role
        entry.name = name;
        entry.email = email;
        entry.clone()
    })
}

#[update]
fn add_admin(p: Principal) -> Result<()> {
    ensure_admin()?;
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        st.admins.insert(p);
        // ensure user exists and has role Admin
        let now = time();
        st.users
            .entry(p)
            .and_modify(|u| u.role = Role::Admin)
            .or_insert(RegisteredUser {
                principal: p,
                name: "Admin".into(),
                email: "".into(),
                role: Role::Admin,
                registered_at_ns: now,
            });
    });
    Ok(())
}

#[update]
fn remove_admin(p: Principal) -> Result<()> {
    ensure_admin()?;
    let caller_p = caller();
    // Prevent removing the last admin or self-locking
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        if !st.admins.contains(&p) {
            return;
        }
        if st.admins.len() == 1 && st.admins.contains(&p) {
            trap("Cannot remove the last admin");
        }
        // avoid removing yourself if you'd become non-admin and there's no other admin left
        if p == caller_p && st.admins.len() == 1 {
            trap("Cannot remove yourself as the only admin");
        }
        st.admins.remove(&p);
        if let Some(u) = st.users.get_mut(&p) {
            u.role = Role::User;
        }
    });
    Ok(())
}

#[update]
fn set_role(p: Principal, role: Role) -> Result<()> {
    ensure_admin()?;
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        let user = st.users.get_mut(&p).ok_or(AdminError::UserNotFound)?;
        user.role = role.clone();
        match role {
            Role::Admin => { st.admins.insert(p); }
            Role::User => { st.admins.remove(&p); }
        }
        Ok(())
    })
}

#[query]
fn get_users() -> Vec<RegisteredUser> {
    STATE.with(|s| s.borrow().users.values().cloned().collect())
}

#[query]
fn get_my_role() -> Role {
    STATE.with(|s| {
        if s.borrow().admins.contains(&caller()) {
            Role::Admin
        } else {
            s.borrow()
                .users
                .get(&caller())
                .map(|u| u.role.clone())
                .unwrap_or(Role::User)
        }
    })
}

/// ====== Idea Management ======

#[update]
fn submit_idea(title: String, description: String) -> Result<Idea> {
    if title.trim().is_empty() || description.trim().len() < 10 {
        return Err(AdminError::InvalidInput(
            "Title required and description >= 10 chars".into(),
        ));
    }
    let me = caller();
    let now = time();
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        let id = st.next_idea_id;
        st.next_idea_id = id.saturating_add(1);
        let idea = Idea {
            id,
            title,
            description,
            submitted_by: me,
            submitted_at_ns: now,
            status: IdeaStatus::Pending,
        };
        st.ideas.insert(id, idea.clone());
        Ok(idea)
    })
}

#[update]
fn approve_idea(id: u64) -> Result<ApproveRejectResult> {
    ensure_admin()?;
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        let idea = st.ideas.get_mut(&id).ok_or(AdminError::IdeaNotFound)?;
        idea.status = IdeaStatus::Approved;
        Ok(ApproveRejectResult {
            id,
            status: idea.status.clone(),
        })
    })
}

#[update]
fn reject_idea(id: u64) -> Result<ApproveRejectResult> {
    ensure_admin()?;
    STATE.with(|s| {
        let mut st = s.borrow_mut();
        let idea = st.ideas.get_mut(&id).ok_or(AdminError::IdeaNotFound)?;
        idea.status = IdeaStatus::Rejected;
        Ok(ApproveRejectResult {
            id,
            status: idea.status.clone(),
        })
    })
}

#[query]
fn get_ideas() -> Vec<Idea> {
    STATE.with(|s| s.borrow().ideas.values().cloned().collect())
}

#[query]
fn get_idea(id: u64) -> Option<Idea> {
    STATE.with(|s| s.borrow().ideas.get(&id).cloned())
}

ic_cdk::export_candid!();

