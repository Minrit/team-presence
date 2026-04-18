//! MCP server glue.
//!
//! Phase A (this unit) ships the skeleton: server boots, answers
//! `initialize`, returns an empty `tools/list`, and logs a diagnostic
//! when credentials haven't been captured. Tool implementations land
//! in Units 3-6.

use rmcp::{
    handler::server::tool::ToolRouter,
    model::{
        CallToolResult, Content, Implementation, ProtocolVersion, ServerCapabilities, ServerInfo,
    },
    tool, tool_handler, tool_router, ErrorData, ServerHandler,
};

use crate::api::ApiClient;

#[derive(Clone)]
pub struct TpMcp {
    pub api: Option<ApiClient>,
    tool_router: ToolRouter<Self>,
}

impl TpMcp {
    pub fn new(api: Option<ApiClient>) -> Self {
        Self {
            api,
            tool_router: Self::tool_router(),
        }
    }

    pub(crate) fn api_or_err(&self) -> Result<&ApiClient, crate::error::McpError> {
        self.api
            .as_ref()
            .ok_or(crate::error::McpError::NotLoggedIn)
    }
}

#[tool_router]
impl TpMcp {
    #[tool(
        description = "Smoke-test tool. Returns the authenticated user email when credentials are present, or a helpful error when not. Use this to confirm the MCP server is reachable."
    )]
    pub async fn tp_whoami(&self) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let me = api.me().await.map_err(ErrorData::from)?;
        let text = format!(
            "email={} id={} display_name={}",
            me.email, me.id, me.display_name
        );
        Ok(CallToolResult::success(vec![Content::text(text)]))
    }
}

#[tool_handler]
impl ServerHandler for TpMcp {
    fn get_info(&self) -> ServerInfo {
        let mut info = ServerInfo::default();
        info.protocol_version = ProtocolVersion::V_2024_11_05;
        let mut impl_info = Implementation::from_build_env();
        impl_info.name = "tp-mcp".into();
        impl_info.version = env!("CARGO_PKG_VERSION").into();
        info.server_info = impl_info;
        info.capabilities = ServerCapabilities::builder().enable_tools().build();
        info.instructions = Some(
            "team-presence MCP server. Wraps story / AC / sprint / collector \
             operations as MCP tools so Claude Code can drive PM end-to-end. \
             Run `team-presence login` once before use."
                .into(),
        );
        info
    }
}
