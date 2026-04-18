//! HTTP client for server-side endpoints the collector needs at login time.
//!
//! Flow:
//!   1. POST /api/v1/auth/login  {email, password} → {access_token, user}
//!   2. POST /api/v1/collectors  (Bearer access_token) {name} → {id, token}
//!
//! After this, the access_token is thrown away — only the opaque collector
//! token (which has no expiry) is stored.

use reqwest::Client;
use serde::{Deserialize, Serialize};
use url::Url;
use uuid::Uuid;

pub struct ApiClient {
    base: Url,
    http: Client,
}

#[derive(Debug, Serialize)]
struct LoginReq<'a> {
    email: &'a str,
    password: &'a str,
}

#[derive(Debug, Deserialize)]
pub struct LoginResp {
    pub access_token: String,
    #[allow(dead_code)]
    pub access_ttl_secs: u64,
    pub user: UserPublic,
}

#[derive(Debug, Deserialize)]
pub struct UserPublic {
    pub id: Uuid,
    pub email: String,
    pub display_name: String,
}

#[derive(Debug, Serialize)]
struct MintReq<'a> {
    name: &'a str,
}

#[derive(Debug, Deserialize)]
pub struct MintResp {
    pub id: Uuid,
    pub name: String,
    pub token: String,
}

#[derive(Debug, thiserror::Error)]
pub enum ClientError {
    #[error("http: {0}")]
    Http(#[from] reqwest::Error),
    #[error("invalid server url: {0}")]
    Url(#[from] url::ParseError),
    #[error("server returned {status}: {body}")]
    Status { status: u16, body: String },
}

impl ApiClient {
    pub fn new(server: &str) -> Result<Self, ClientError> {
        let base = Url::parse(server.trim_end_matches('/'))?;
        let http = Client::builder()
            .user_agent(format!(
                "team-presence-collector/{}",
                env!("CARGO_PKG_VERSION")
            ))
            .build()?;
        Ok(Self { base, http })
    }

    fn url(&self, path: &str) -> Result<Url, ClientError> {
        Ok(self.base.join(path)?)
    }

    pub async fn login(&self, email: &str, password: &str) -> Result<LoginResp, ClientError> {
        let url = self.url("/api/v1/auth/login")?;
        let resp = self
            .http
            .post(url)
            .json(&LoginReq { email, password })
            .send()
            .await?;
        decode(resp).await
    }

    pub async fn mint_collector_token(
        &self,
        access_token: &str,
        name: &str,
    ) -> Result<MintResp, ClientError> {
        let url = self.url("/api/v1/collectors")?;
        let resp = self
            .http
            .post(url)
            .bearer_auth(access_token)
            .json(&MintReq { name })
            .send()
            .await?;
        decode(resp).await
    }
}

async fn decode<T: for<'de> Deserialize<'de>>(resp: reqwest::Response) -> Result<T, ClientError> {
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(ClientError::Status {
            status: status.as_u16(),
            body,
        });
    }
    Ok(resp.json::<T>().await?)
}
