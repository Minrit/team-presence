use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::stories::model::ActivityActor;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActorKind {
    User,
    Agent,
    System,
}

#[derive(Debug, Clone, Copy)]
pub struct Identity {
    pub user_id: Uuid,
    pub actor_kind: ActorKind,
}

impl Identity {
    pub fn activity_actor(&self) -> ActivityActor {
        match self.actor_kind {
            ActorKind::User => ActivityActor::User,
            ActorKind::Agent => ActivityActor::Agent,
            ActorKind::System => ActivityActor::System,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct BootstrapRequest {
    pub email: String,
    pub password: String,
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct AddUserRequest {
    pub email: String,
    pub password: String,
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub access_ttl_secs: u64,
    pub user: UserPublic,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserPublic {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
    pub created_at: DateTime<Utc>,
}

pub(crate) const REFRESH_COOKIE_NAME: &str = "tp_refresh";
