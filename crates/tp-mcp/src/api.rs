//! HTTP client that every MCP tool goes through.
//!
//! Reuses the collector's on-disk credentials (keyring + file fallback). The
//! collector token is a long-lived opaque Bearer that the server middleware
//! already accepts on `/api/v1/*`, so no extra login flow is needed at MCP
//! startup.

use reqwest::{Client, Method, StatusCode};
use serde::de::DeserializeOwned;
use serde_json::Value;
use team_presence_collector::credentials;
use url::Url;

use crate::error::{McpError, McpResult};

pub const ACTOR_KIND_AGENT: &str = "agent";

#[derive(Clone)]
pub struct ApiClient {
    http: Client,
    base: Url,
    bearer: String,
    pub(crate) user_email: String,
}

impl ApiClient {
    /// Load credentials saved by the collector (`team-presence login`).
    ///
    /// tp-mcp reads the **file fallback directly** (skipping the OS keyring)
    /// so spawning the binary does not trigger a macOS Keychain "allow
    /// tp-mcp to use your keychain" dialog every time. The secret itself
    /// is the same; we're just choosing where to read it from.
    pub fn from_credentials() -> McpResult<Self> {
        let file_path =
            credentials::fallback_path().map_err(|e| McpError::Credentials(e.to_string()))?;
        let creds = match credentials::load_file(&file_path) {
            Ok(Some(c)) => c,
            Ok(None) => {
                // File missing → fall back to the full (keyring-first) path.
                // This still works for users who logged in with the CLI on a
                // machine without a writable file fallback.
                credentials::load()
                    .map_err(|e| McpError::Credentials(e.to_string()))?
                    .ok_or(McpError::NotLoggedIn)?
            }
            Err(e) => return Err(McpError::Credentials(e.to_string())),
        };
        let base = Url::parse(&creds.server)
            .map_err(|e| McpError::Credentials(format!("server url: {e}")))?;
        let http = Client::builder()
            .user_agent(format!("tp-mcp/{}", env!("CARGO_PKG_VERSION")))
            .build()?;
        Ok(Self {
            http,
            base,
            bearer: creds.token,
            user_email: creds.user_email,
        })
    }

    pub fn user_email(&self) -> &str {
        &self.user_email
    }

    /// Look up the authenticated user's UUID via `/api/v1/auth/me`.
    pub async fn me(&self) -> McpResult<MeResponse> {
        self.request_json(Method::GET, "/api/v1/auth/me", None).await
    }

    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> McpResult<T> {
        self.request_json(Method::GET, path, None).await
    }

    pub async fn post<T: DeserializeOwned>(&self, path: &str, body: &Value) -> McpResult<T> {
        self.request_json(Method::POST, path, Some(body)).await
    }

    pub async fn patch<T: DeserializeOwned>(&self, path: &str, body: &Value) -> McpResult<T> {
        self.request_json(Method::PATCH, path, Some(body)).await
    }

    pub async fn delete(&self, path: &str) -> McpResult<()> {
        let url = self.url(path)?;
        let resp = self
            .http
            .request(Method::DELETE, url)
            .bearer_auth(&self.bearer)
            .header("X-Actor-Kind", ACTOR_KIND_AGENT)
            .send()
            .await?;
        check_status(resp).await?;
        Ok(())
    }

    async fn request_json<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: Option<&Value>,
    ) -> McpResult<T> {
        let url = self.url(path)?;
        let mut req = self
            .http
            .request(method, url)
            .bearer_auth(&self.bearer)
            .header("X-Actor-Kind", ACTOR_KIND_AGENT);
        if let Some(b) = body {
            req = req.json(b);
        }
        let resp = req.send().await?;
        let resp = check_status(resp).await?;
        Ok(resp.json::<T>().await?)
    }

    fn url(&self, path: &str) -> McpResult<Url> {
        self.base
            .join(path)
            .map_err(|e| McpError::Credentials(format!("url join {path}: {e}")))
    }
}

async fn check_status(resp: reqwest::Response) -> McpResult<reqwest::Response> {
    let status = resp.status();
    if status.is_success() {
        return Ok(resp);
    }
    let code = status.as_u16();
    let body = resp.text().await.unwrap_or_default();
    if status == StatusCode::NOT_FOUND {
        return Err(McpError::NotFound(body));
    }
    Err(McpError::Status { status: code, body })
}

#[derive(Debug, serde::Deserialize)]
pub struct MeResponse {
    pub id: uuid::Uuid,
    pub email: String,
    pub display_name: String,
}
