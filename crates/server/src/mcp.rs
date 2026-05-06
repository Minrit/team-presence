//! Remote MCP endpoint hosted by the team-presence server.
//!
//! The local collector remains responsible for laptop-only concerns
//! (hooks, OpenCode sqlite tailing, mute flag, diagnostics). This module only
//! exposes PM operations whose data and authorization already live on the
//! server.

use std::{sync::Arc, time::Duration};

use axum::http::request::Parts;
use chrono::NaiveDate;
use rmcp::schemars;
use rmcp::{
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{
        CallToolResult, Content, Implementation, ProtocolVersion, ServerCapabilities, ServerInfo,
    },
    schemars::JsonSchema,
    service::RequestContext,
    tool, tool_handler, tool_router, ErrorData, RoleServer, ServerHandler,
};
use serde::Deserialize;
use serde_json::{json, Value};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::{
    auth::model::{ActorKind, Identity},
    epics,
    error::AppError,
    sprints,
    state::AppState,
    stories::{
        activity,
        model::{
            ListActivityQuery, ListStoriesQuery, Priority, RelationKind, Story, StoryRelation,
            StoryStatus,
        },
        repo::{
            self as story_repo, BRANCH_MAX_BYTES, FIELD_MAX_BYTES, NAME_MAX_BYTES, PR_REF_MAX_BYTES,
        },
    },
};

type McpHttpService = rmcp::transport::streamable_http_server::StreamableHttpService<
    TeamPresenceMcp,
    rmcp::transport::streamable_http_server::session::local::LocalSessionManager,
>;

pub fn service(state: AppState) -> McpHttpService {
    use rmcp::transport::streamable_http_server::{
        session::local::LocalSessionManager, StreamableHttpServerConfig, StreamableHttpService,
    };

    let config = StreamableHttpServerConfig::default()
        .with_stateful_mode(false)
        .with_json_response(true)
        .with_sse_keep_alive(Some(Duration::from_secs(15)))
        .with_cancellation_token(CancellationToken::new());
    let config = match std::env::var("TP_MCP_ALLOWED_HOSTS") {
        Ok(raw) => {
            let hosts = raw
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect::<Vec<_>>();
            if hosts.is_empty() {
                config
            } else {
                config.with_allowed_hosts(hosts)
            }
        }
        Err(_) => config.disable_allowed_hosts(),
    };

    StreamableHttpService::new(
        move || Ok(TeamPresenceMcp::new(state.clone())),
        Arc::<LocalSessionManager>::default(),
        config,
    )
}

#[derive(Clone)]
pub struct TeamPresenceMcp {
    state: AppState,
    #[allow(dead_code)]
    tool_router: ToolRouter<Self>,
}

impl TeamPresenceMcp {
    fn new(state: AppState) -> Self {
        Self {
            state,
            tool_router: Self::tool_router(),
        }
    }
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct StoryListArgs {
    #[serde(default)]
    pub sprint: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub owner: Option<String>,
    #[serde(default)]
    pub epic: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct StoryIdArgs {
    pub id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct StoryCreateArgs {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub points: Option<i32>,
    #[serde(default)]
    pub sprint_id: Option<String>,
    #[serde(default)]
    pub epic_id: Option<String>,
    #[serde(default)]
    pub sprint: Option<String>,
    #[serde(default)]
    pub epic: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub pr_ref: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct StoryEditArgs {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub points: Option<i32>,
    #[serde(default)]
    pub sprint_id: Option<String>,
    #[serde(default)]
    pub epic_id: Option<String>,
    #[serde(default)]
    pub sprint: Option<String>,
    #[serde(default)]
    pub epic: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub pr_ref: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct StoryMoveArgs {
    pub id: String,
    pub status: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct SprintCreateArgs {
    pub name: String,
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct AcAddArgs {
    pub story_id: String,
    pub text: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct AcIndexArgs {
    pub story_id: String,
    pub index: usize,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct AcEditArgs {
    pub story_id: String,
    pub index: usize,
    pub text: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct CommentCreateArgs {
    pub story_id: String,
    pub body: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct RelationArgs {
    pub from_id: String,
    pub to_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ActivityListArgs {
    pub story_id: String,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct SprintEditArgs {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct EpicCreateArgs {
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct EpicEditArgs {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

fn ok_json(label: &str, value: impl serde::Serialize) -> Result<CallToolResult, ErrorData> {
    let value = serde_json::to_value(value)
        .map_err(|e| ErrorData::internal_error(format!("serialize result: {e}"), None))?;
    let pretty = serde_json::to_string_pretty(&value).unwrap_or_else(|_| value.to_string());
    Ok(CallToolResult::success(vec![Content::text(format!(
        "{label}\n{pretty}"
    ))]))
}

fn err(error: AppError) -> ErrorData {
    match error {
        AppError::Unauthorized => ErrorData::invalid_request("unauthorized", None),
        AppError::Forbidden => ErrorData::invalid_request("forbidden", None),
        AppError::NotFound => ErrorData::resource_not_found("not found", None),
        AppError::BadRequest(message) => ErrorData::invalid_params(message, None),
        other => ErrorData::internal_error(other.to_string(), None),
    }
}

fn identity(ctx: &RequestContext<RoleServer>) -> Result<Identity, ErrorData> {
    let parts = ctx
        .extensions
        .get::<Parts>()
        .ok_or_else(|| ErrorData::internal_error("missing HTTP request context", None))?;
    let mut identity = parts
        .extensions
        .get::<Identity>()
        .copied()
        .ok_or_else(|| ErrorData::invalid_request("missing authenticated identity", None))?;
    // `/mcp` is the agent-facing service boundary. Clients do not all support
    // arbitrary per-request headers, so force server-hosted MCP writes to land
    // as agent activity instead of relying on `X-Actor-Kind`.
    identity.actor_kind = ActorKind::Agent;
    Ok(identity)
}

fn validate_name(name: &str) -> Result<(), AppError> {
    if name.trim().is_empty() {
        return Err(AppError::BadRequest("name required".into()));
    }
    if name.len() > NAME_MAX_BYTES {
        return Err(AppError::BadRequest("name too long".into()));
    }
    Ok(())
}

fn validate_body(body: &str, field: &'static str) -> Result<(), AppError> {
    if body.len() > FIELD_MAX_BYTES {
        return Err(AppError::BadRequest(format!("{field} too large")));
    }
    Ok(())
}

fn validate_branch(value: Option<&str>) -> Result<(), AppError> {
    if value.is_some_and(|v| v.len() > BRANCH_MAX_BYTES) {
        return Err(AppError::BadRequest("branch too long".into()));
    }
    Ok(())
}

fn validate_pr_ref(value: Option<&str>) -> Result<(), AppError> {
    if value.is_some_and(|v| v.len() > PR_REF_MAX_BYTES) {
        return Err(AppError::BadRequest("pr_ref too long".into()));
    }
    Ok(())
}

fn parse_uuid(value: &str, field: &'static str) -> Result<Uuid, ErrorData> {
    Uuid::parse_str(value)
        .map_err(|_| ErrorData::invalid_params(format!("{field} must be a UUID"), None))
}

fn parse_status(value: &str) -> Result<StoryStatus, ErrorData> {
    value
        .parse()
        .map_err(|e: String| ErrorData::invalid_params(e, None))
}

fn parse_priority(value: &str) -> Result<Priority, ErrorData> {
    value
        .parse()
        .map_err(|e: String| ErrorData::invalid_params(e, None))
}

fn parse_date(value: &str, field: &'static str) -> Result<NaiveDate, ErrorData> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| ErrorData::invalid_params(format!("{field} must be YYYY-MM-DD"), None))
}

fn validate_color(c: &str) -> Result<(), AppError> {
    let bytes = c.as_bytes();
    let ok =
        bytes.len() == 7 && bytes[0] == b'#' && bytes[1..].iter().all(|b| b.is_ascii_hexdigit());
    if ok {
        Ok(())
    } else {
        Err(AppError::BadRequest("color must be #RRGGBB hex".into()))
    }
}

fn preview(body: &str, max: usize) -> String {
    if body.chars().count() <= max {
        return body.to_string();
    }
    let mut out = String::with_capacity(max + 3);
    for (i, ch) in body.chars().enumerate() {
        if i >= max {
            break;
        }
        out.push(ch);
    }
    out.push_str("...");
    out
}

async fn resolve_sprint(
    state: &AppState,
    value: Option<String>,
) -> Result<Option<Uuid>, ErrorData> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let raw = raw.trim();
    if raw.is_empty() {
        return Ok(None);
    }
    if raw == "latest" {
        let row: Option<(Uuid,)> =
            sqlx::query_as("SELECT id FROM sprints ORDER BY start_date DESC LIMIT 1")
                .fetch_optional(&state.db)
                .await
                .map_err(AppError::from)
                .map_err(err)?;
        return row
            .map(|r| Some(r.0))
            .ok_or_else(|| ErrorData::resource_not_found("no sprint exists", None));
    }
    if let Ok(id) = Uuid::parse_str(raw) {
        return Ok(Some(id));
    }
    let row: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM sprints WHERE name = $1")
        .bind(raw)
        .fetch_optional(&state.db)
        .await
        .map_err(AppError::from)
        .map_err(err)?;
    row.map(|r| Some(r.0))
        .ok_or_else(|| ErrorData::resource_not_found("sprint not found", None))
}

async fn resolve_epic(state: &AppState, value: Option<String>) -> Result<Option<Uuid>, ErrorData> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let raw = raw.trim();
    if raw.is_empty() {
        return Ok(None);
    }
    if let Ok(id) = Uuid::parse_str(raw) {
        return Ok(Some(id));
    }
    let row: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM epics WHERE name = $1")
        .bind(raw)
        .fetch_optional(&state.db)
        .await
        .map_err(AppError::from)
        .map_err(err)?;
    row.map(|r| Some(r.0))
        .ok_or_else(|| ErrorData::resource_not_found("epic not found", None))
}

fn ac_array(story: &Story) -> Vec<Value> {
    story
        .acceptance_criteria
        .as_array()
        .cloned()
        .unwrap_or_default()
}

fn ac_index_error(index: usize, len: usize) -> ErrorData {
    ErrorData::invalid_params(
        format!("invalid_index {index} (story has {len} items)"),
        None,
    )
}

async fn patch_ac(
    state: &AppState,
    identity: Identity,
    story_id: Uuid,
    ac: Vec<Value>,
    label: &str,
) -> Result<CallToolResult, ErrorData> {
    let value = Value::Array(ac);
    let story = story_repo::patch(
        &state.db,
        story_id,
        identity.user_id,
        None,
        None,
        Some(&value),
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
    )
    .await
    .map_err(err)?
    .ok_or_else(|| ErrorData::resource_not_found("story not found", None))?;

    activity::emit(
        &state.db,
        Some(&state.redis),
        story.id,
        identity.activity_actor(),
        &identity.user_id.to_string(),
        activity::EDIT,
        label,
        None,
    )
    .await;

    ok_json(label, story)
}

#[tool_router]
impl TeamPresenceMcp {
    #[tool(description = "Return the authenticated team-presence user.")]
    pub async fn tp_whoami(
        &self,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let identity = identity(&ctx)?;
        let user: Option<crate::auth::model::UserPublic> =
            sqlx::query_as("SELECT id, email, display_name, created_at FROM users WHERE id = $1")
                .bind(identity.user_id)
                .fetch_optional(&self.state.db)
                .await
                .map_err(AppError::from)
                .map_err(err)?;
        let user = user.ok_or_else(|| ErrorData::resource_not_found("user not found", None))?;
        ok_json("whoami:", user)
    }

    #[tool(
        description = "List stories, optionally filtered by sprint, status, owner, epic, or priority."
    )]
    pub async fn tp_story_list(
        &self,
        Parameters(args): Parameters<StoryListArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let q = ListStoriesQuery {
            status: args.status.as_deref().map(parse_status).transpose()?,
            owner: args
                .owner
                .as_deref()
                .map(|v| parse_uuid(v, "owner"))
                .transpose()?,
            sprint: args
                .sprint
                .as_deref()
                .map(|v| parse_uuid(v, "sprint"))
                .transpose()?,
            epic: args
                .epic
                .as_deref()
                .map(|v| parse_uuid(v, "epic"))
                .transpose()?,
            priority: args.priority.as_deref().map(parse_priority).transpose()?,
        };
        let stories = story_repo::list(&self.state.db, &q).await.map_err(err)?;
        ok_json("stories:", stories)
    }

    #[tool(description = "Get one story by UUID.")]
    pub async fn tp_story_get(
        &self,
        Parameters(args): Parameters<StoryIdArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let id = parse_uuid(&args.id, "id")?;
        let story = story_repo::get(&self.state.db, id)
            .await
            .map_err(err)?
            .ok_or_else(|| ErrorData::resource_not_found("story not found", None))?;
        ok_json("story:", story)
    }

    #[tool(
        description = "Create a story. Optional fields: description, priority, points, sprint_id/sprint, epic_id/epic, branch, pr_ref."
    )]
    pub async fn tp_story_create(
        &self,
        Parameters(args): Parameters<StoryCreateArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let identity = identity(&ctx)?;
        let name = args.name.trim();
        validate_name(name).map_err(err)?;
        let description = args.description.unwrap_or_default();
        validate_body(&description, "description").map_err(err)?;
        validate_branch(args.branch.as_deref()).map_err(err)?;
        validate_pr_ref(args.pr_ref.as_deref()).map_err(err)?;
        let sprint_id = match args.sprint_id {
            Some(raw) => Some(parse_uuid(&raw, "sprint_id")?),
            None => resolve_sprint(&self.state, args.sprint).await?,
        };
        let epic_id = match args.epic_id {
            Some(raw) => Some(parse_uuid(&raw, "epic_id")?),
            None => resolve_epic(&self.state, args.epic).await?,
        };
        let priority = args.priority.as_deref().map(parse_priority).transpose()?;

        let story = story_repo::create(
            &self.state.db,
            identity.user_id,
            name,
            &description,
            &json!([]),
            StoryStatus::Todo,
            None,
            None,
            sprint_id,
            priority,
            args.points,
            epic_id,
            args.branch.as_deref(),
            args.pr_ref.as_deref(),
        )
        .await
        .map_err(err)?;

        activity::emit(
            &self.state.db,
            Some(&self.state.redis),
            story.id,
            identity.activity_actor(),
            &identity.user_id.to_string(),
            activity::CREATE,
            &format!("created story '{}'", story.name),
            None,
        )
        .await;

        ok_json("story created:", story)
    }

    #[tool(
        description = "Edit any subset of story fields: name, description, priority, points, sprint_id/sprint, epic_id/epic, branch, pr_ref."
    )]
    pub async fn tp_story_edit(
        &self,
        Parameters(args): Parameters<StoryEditArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let identity = identity(&ctx)?;
        let id = parse_uuid(&args.id, "id")?;
        if let Some(name) = args.name.as_deref() {
            validate_name(name.trim()).map_err(err)?;
        }
        if let Some(description) = args.description.as_deref() {
            validate_body(description, "description").map_err(err)?;
        }
        validate_branch(args.branch.as_deref()).map_err(err)?;
        validate_pr_ref(args.pr_ref.as_deref()).map_err(err)?;
        let priority = args.priority.as_deref().map(parse_priority).transpose()?;
        let sprint_id = match args.sprint_id {
            Some(raw) => Some(Some(parse_uuid(&raw, "sprint_id")?)),
            None => resolve_sprint(&self.state, args.sprint).await?.map(Some),
        };
        let epic_id = match args.epic_id {
            Some(raw) => Some(Some(parse_uuid(&raw, "epic_id")?)),
            None => resolve_epic(&self.state, args.epic).await?.map(Some),
        };
        let story = story_repo::patch(
            &self.state.db,
            id,
            identity.user_id,
            args.name.as_deref().map(str::trim),
            args.description.as_deref(),
            None,
            None,
            None,
            None,
            sprint_id,
            priority.map(Some),
            args.points.map(Some),
            epic_id,
            args.branch.as_deref().map(Some),
            args.pr_ref.as_deref().map(Some),
        )
        .await
        .map_err(err)?
        .ok_or_else(|| ErrorData::resource_not_found("story not found", None))?;

        activity::emit(
            &self.state.db,
            Some(&self.state.redis),
            story.id,
            identity.activity_actor(),
            &identity.user_id.to_string(),
            activity::EDIT,
            "updated story",
            None,
        )
        .await;

        ok_json("story updated:", story)
    }

    #[tool(
        description = "Move a story to a new status: todo, in_progress, blocked, review, or done."
    )]
    pub async fn tp_story_move_status(
        &self,
        Parameters(args): Parameters<StoryMoveArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let identity = identity(&ctx)?;
        let id = parse_uuid(&args.id, "id")?;
        let status = parse_status(&args.status)?;
        let previous = story_repo::get(&self.state.db, id)
            .await
            .map_err(err)?
            .ok_or_else(|| ErrorData::resource_not_found("story not found", None))?;
        let story = story_repo::patch(
            &self.state.db,
            id,
            identity.user_id,
            None,
            None,
            None,
            Some(status),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .map_err(err)?
        .ok_or_else(|| ErrorData::resource_not_found("story not found", None))?;

        if previous.status != status {
            activity::emit(
                &self.state.db,
                Some(&self.state.redis),
                story.id,
                identity.activity_actor(),
                &identity.user_id.to_string(),
                activity::STATUS_CHANGE,
                &format!(
                    "status changed {} -> {}",
                    previous.status.as_str(),
                    status.as_str()
                ),
                None,
            )
            .await;
        }
        ok_json("story moved:", story)
    }

    #[tool(description = "Claim a story for the authenticated user.")]
    pub async fn tp_story_claim(
        &self,
        Parameters(args): Parameters<StoryIdArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let identity = identity(&ctx)?;
        let id = parse_uuid(&args.id, "id")?;
        let story = story_repo::patch(
            &self.state.db,
            id,
            identity.user_id,
            None,
            None,
            None,
            None,
            Some(Some(identity.user_id)),
            None,
            None,
            None,
            None,
            None,
            None,
            None,
        )
        .await
        .map_err(err)?
        .ok_or_else(|| ErrorData::resource_not_found("story not found", None))?;

        activity::emit(
            &self.state.db,
            Some(&self.state.redis),
            story.id,
            identity.activity_actor(),
            &identity.user_id.to_string(),
            activity::CLAIM,
            "claimed story",
            None,
        )
        .await;
        ok_json("story claimed:", story)
    }

    #[tool(
        description = "Delete a story. Cascades to comments, activity, and relations via database rules."
    )]
    pub async fn tp_story_delete(
        &self,
        Parameters(args): Parameters<StoryIdArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let id = parse_uuid(&args.id, "id")?;
        let deleted = story_repo::delete(&self.state.db, id).await.map_err(err)?;
        if !deleted {
            return Err(ErrorData::resource_not_found("story not found", None));
        }
        Ok(CallToolResult::success(vec![Content::text(format!(
            "deleted {id}"
        ))]))
    }

    #[tool(description = "Append a new acceptance-criteria item (done=false).")]
    pub async fn tp_ac_add(
        &self,
        Parameters(args): Parameters<AcAddArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let identity = identity(&ctx)?;
        let story_id = parse_uuid(&args.story_id, "story_id")?;
        let text = args.text.trim();
        if text.is_empty() {
            return Err(ErrorData::invalid_params("text required", None));
        }
        let story = story_repo::get(&self.state.db, story_id)
            .await
            .map_err(err)?
            .ok_or_else(|| ErrorData::resource_not_found("story not found", None))?;
        let mut ac = ac_array(&story);
        ac.push(json!({ "text": text, "done": false }));
        patch_ac(&self.state, identity, story_id, ac, "ac added").await
    }

    #[tool(description = "Mark acceptance-criteria item (0-based index) as done.")]
    pub async fn tp_ac_check(
        &self,
        Parameters(args): Parameters<AcIndexArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        self.set_ac_done(args, ctx, true).await
    }

    #[tool(description = "Mark acceptance-criteria item (0-based index) as not done.")]
    pub async fn tp_ac_uncheck(
        &self,
        Parameters(args): Parameters<AcIndexArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        self.set_ac_done(args, ctx, false).await
    }

    async fn set_ac_done(
        &self,
        args: AcIndexArgs,
        ctx: RequestContext<RoleServer>,
        done: bool,
    ) -> Result<CallToolResult, ErrorData> {
        let identity = identity(&ctx)?;
        let story_id = parse_uuid(&args.story_id, "story_id")?;
        let story = story_repo::get(&self.state.db, story_id)
            .await
            .map_err(err)?
            .ok_or_else(|| ErrorData::resource_not_found("story not found", None))?;
        let mut ac = ac_array(&story);
        if args.index >= ac.len() {
            return Err(ac_index_error(args.index, ac.len()));
        }
        ac[args.index]["done"] = Value::Bool(done);
        let label = if done { "ac checked" } else { "ac unchecked" };
        patch_ac(&self.state, identity, story_id, ac, label).await
    }

    #[tool(description = "Replace the text of an acceptance-criteria item.")]
    pub async fn tp_ac_edit(
        &self,
        Parameters(args): Parameters<AcEditArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let identity = identity(&ctx)?;
        let story_id = parse_uuid(&args.story_id, "story_id")?;
        let text = args.text.trim();
        if text.is_empty() {
            return Err(ErrorData::invalid_params("text required", None));
        }
        let story = story_repo::get(&self.state.db, story_id)
            .await
            .map_err(err)?
            .ok_or_else(|| ErrorData::resource_not_found("story not found", None))?;
        let mut ac = ac_array(&story);
        if args.index >= ac.len() {
            return Err(ac_index_error(args.index, ac.len()));
        }
        ac[args.index]["text"] = Value::String(text.to_string());
        patch_ac(&self.state, identity, story_id, ac, "ac edited").await
    }

    #[tool(description = "Remove an acceptance-criteria item by index.")]
    pub async fn tp_ac_remove(
        &self,
        Parameters(args): Parameters<AcIndexArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let identity = identity(&ctx)?;
        let story_id = parse_uuid(&args.story_id, "story_id")?;
        let story = story_repo::get(&self.state.db, story_id)
            .await
            .map_err(err)?
            .ok_or_else(|| ErrorData::resource_not_found("story not found", None))?;
        let mut ac = ac_array(&story);
        if args.index >= ac.len() {
            return Err(ac_index_error(args.index, ac.len()));
        }
        ac.remove(args.index);
        patch_ac(&self.state, identity, story_id, ac, "ac removed").await
    }

    #[tool(description = "Post a comment on a story.")]
    pub async fn tp_comment_create(
        &self,
        Parameters(args): Parameters<CommentCreateArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let identity = identity(&ctx)?;
        let story_id = parse_uuid(&args.story_id, "story_id")?;
        let body = args.body.trim().to_string();
        if body.is_empty() {
            return Err(ErrorData::invalid_params("body required", None));
        }
        if body.len() > 10_000 {
            return Err(ErrorData::invalid_params("body too long", None));
        }
        let exists: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM stories WHERE id = $1")
            .bind(story_id)
            .fetch_optional(&self.state.db)
            .await
            .map_err(AppError::from)
            .map_err(err)?;
        if exists.is_none() {
            return Err(ErrorData::resource_not_found("story not found", None));
        }
        let row: crate::comments::model::Comment = sqlx::query_as(
            r#"INSERT INTO comments (story_id, author_id, body)
               VALUES ($1, $2, $3)
               RETURNING *"#,
        )
        .bind(story_id)
        .bind(identity.user_id)
        .bind(&body)
        .fetch_one(&self.state.db)
        .await
        .map_err(AppError::from)
        .map_err(err)?;

        activity::emit(
            &self.state.db,
            Some(&self.state.redis),
            story_id,
            identity.activity_actor(),
            &identity.user_id.to_string(),
            activity::COMMENT,
            preview(&body, 140).as_str(),
            Some(&row.id.to_string()),
        )
        .await;

        ok_json("comment:", row)
    }

    #[tool(description = "List comments on a story oldest-first.")]
    pub async fn tp_comment_list(
        &self,
        Parameters(args): Parameters<StoryIdArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let story_id = parse_uuid(&args.id, "id")?;
        let rows: Vec<crate::comments::model::Comment> = sqlx::query_as(
            r#"SELECT * FROM comments
               WHERE story_id = $1
               ORDER BY created_at ASC"#,
        )
        .bind(story_id)
        .fetch_all(&self.state.db)
        .await
        .map_err(AppError::from)
        .map_err(err)?;
        ok_json("comments:", rows)
    }

    #[tool(description = "Create a 'blocks' relation: from_id blocks to_id.")]
    pub async fn tp_relation_block(
        &self,
        Parameters(args): Parameters<RelationArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let from = parse_uuid(&args.from_id, "from_id")?;
        let to = parse_uuid(&args.to_id, "to_id")?;
        let relation = story_repo::create_relation(&self.state.db, from, to, RelationKind::Blocks)
            .await
            .map_err(err)?;
        ok_json("blocked:", relation)
    }

    #[tool(description = "Remove a 'blocks' relation.")]
    pub async fn tp_relation_unblock(
        &self,
        Parameters(args): Parameters<RelationArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let from = parse_uuid(&args.from_id, "from_id")?;
        let to = parse_uuid(&args.to_id, "to_id")?;
        let deleted = story_repo::delete_relation(&self.state.db, from, to, RelationKind::Blocks)
            .await
            .map_err(err)?;
        if !deleted {
            return Err(ErrorData::resource_not_found("relation not found", None));
        }
        Ok(CallToolResult::success(vec![Content::text(format!(
            "unblocked {from} -> {to}"
        ))]))
    }

    #[tool(description = "List a story's relations as { blocks: [...], blocked_by: [...] }.")]
    pub async fn tp_relation_list(
        &self,
        Parameters(args): Parameters<StoryIdArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let story_id = parse_uuid(&args.id, "id")?;
        let rows = story_repo::relations_for(&self.state.db, story_id)
            .await
            .map_err(err)?;
        let (blocks, blocked_by): (Vec<StoryRelation>, Vec<StoryRelation>) =
            rows.into_iter().partition(|r| r.from_story_id == story_id);
        ok_json(
            "relations:",
            json!({
                "blocks": blocks,
                "blocked_by": blocked_by,
            }),
        )
    }

    #[tool(description = "List recent story_activity rows, newest first. Default limit 50.")]
    pub async fn tp_activity_list(
        &self,
        Parameters(args): Parameters<ActivityListArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let story_id = parse_uuid(&args.story_id, "story_id")?;
        let rows = story_repo::list_activity(
            &self.state.db,
            story_id,
            &ListActivityQuery { limit: args.limit },
        )
        .await
        .map_err(err)?;
        ok_json("activity:", rows)
    }

    #[tool(description = "List sprints, newest first.")]
    pub async fn tp_sprint_list(
        &self,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let rows = sprints::repo::list(&self.state.db).await.map_err(err)?;
        ok_json("sprints:", rows)
    }

    #[tool(description = "Create a sprint with ISO YYYY-MM-DD start_date and end_date.")]
    pub async fn tp_sprint_create(
        &self,
        Parameters(args): Parameters<SprintCreateArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let name = args.name.trim();
        if name.is_empty() || name.len() > sprints::repo::NAME_MAX_BYTES {
            return Err(ErrorData::invalid_params("name required", None));
        }
        let start_date = parse_date(&args.start_date, "start_date")?;
        let end_date = parse_date(&args.end_date, "end_date")?;
        if end_date < start_date {
            return Err(ErrorData::invalid_params(
                "end_date before start_date",
                None,
            ));
        }
        let sprint = sprints::repo::create(&self.state.db, name, start_date, end_date)
            .await
            .map_err(err)?;
        ok_json("sprint created:", sprint)
    }

    #[tool(description = "Edit sprint fields: name, start_date, end_date.")]
    pub async fn tp_sprint_edit(
        &self,
        Parameters(args): Parameters<SprintEditArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let id = parse_uuid(&args.id, "id")?;
        let name = args.name.as_deref().map(str::trim);
        if name.is_some_and(|n| n.is_empty() || n.len() > sprints::repo::NAME_MAX_BYTES) {
            return Err(ErrorData::invalid_params("name invalid", None));
        }
        let start_date = args
            .start_date
            .as_deref()
            .map(|v| parse_date(v, "start_date"))
            .transpose()?;
        let end_date = args
            .end_date
            .as_deref()
            .map(|v| parse_date(v, "end_date"))
            .transpose()?;
        if let (Some(start), Some(end)) = (start_date, end_date) {
            if end < start {
                return Err(ErrorData::invalid_params(
                    "end_date before start_date",
                    None,
                ));
            }
        }
        let sprint = sprints::repo::patch(&self.state.db, id, name, start_date, end_date)
            .await
            .map_err(err)?
            .ok_or_else(|| ErrorData::resource_not_found("sprint not found", None))?;
        ok_json("sprint updated:", sprint)
    }

    #[tool(description = "List epics.")]
    pub async fn tp_epic_list(
        &self,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let rows: Vec<epics::model::Epic> = sqlx::query_as("SELECT * FROM epics ORDER BY name ASC")
            .fetch_all(&self.state.db)
            .await
            .map_err(AppError::from)
            .map_err(err)?;
        ok_json("epics:", rows)
    }

    #[tool(description = "Create a new epic. color is '#RRGGBB' and defaults to '#64748b'.")]
    pub async fn tp_epic_create(
        &self,
        Parameters(args): Parameters<EpicCreateArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let name = args.name.trim();
        if name.is_empty() || name.len() > 200 {
            return Err(ErrorData::invalid_params("name required", None));
        }
        let color = args.color.unwrap_or_else(|| "#64748b".into());
        validate_color(&color).map_err(err)?;
        let description = args.description.unwrap_or_default();
        if description.len() > 2000 {
            return Err(ErrorData::invalid_params("description too long", None));
        }

        let row: epics::model::Epic = sqlx::query_as(
            r#"INSERT INTO epics (name, color, description)
               VALUES ($1, $2, $3)
               RETURNING *"#,
        )
        .bind(name)
        .bind(&color)
        .bind(&description)
        .fetch_one(&self.state.db)
        .await
        .map_err(AppError::from)
        .map_err(err)?;
        ok_json("epic created:", row)
    }

    #[tool(description = "Edit epic name, color, or description.")]
    pub async fn tp_epic_edit(
        &self,
        Parameters(args): Parameters<EpicEditArgs>,
        ctx: RequestContext<RoleServer>,
    ) -> Result<CallToolResult, ErrorData> {
        let _ = identity(&ctx)?;
        let id = parse_uuid(&args.id, "id")?;
        let name = args.name.as_deref().map(str::trim);
        if name.is_some_and(|n| n.is_empty() || n.len() > 200) {
            return Err(ErrorData::invalid_params("name invalid", None));
        }
        if let Some(color) = args.color.as_deref() {
            validate_color(color).map_err(err)?;
        }
        if args.description.as_ref().is_some_and(|d| d.len() > 2000) {
            return Err(ErrorData::invalid_params("description too long", None));
        }

        let row: Option<epics::model::Epic> = sqlx::query_as(
            r#"UPDATE epics SET
                  name        = COALESCE($2, name),
                  color       = COALESCE($3, color),
                  description = COALESCE($4, description)
               WHERE id = $1
               RETURNING *"#,
        )
        .bind(id)
        .bind(name)
        .bind(args.color.as_deref())
        .bind(args.description.as_deref())
        .fetch_optional(&self.state.db)
        .await
        .map_err(AppError::from)
        .map_err(err)?;
        let row = row.ok_or_else(|| ErrorData::resource_not_found("epic not found", None))?;
        ok_json("epic updated:", row)
    }
}

#[tool_handler]
impl ServerHandler for TeamPresenceMcp {
    fn get_info(&self) -> ServerInfo {
        let mut info = ServerInfo::default();
        info.protocol_version = ProtocolVersion::V_2024_11_05;
        let mut implementation = Implementation::from_build_env();
        implementation.name = "team-presence".into();
        implementation.version = env!("CARGO_PKG_VERSION").into();
        info.server_info = implementation;
        info.capabilities = ServerCapabilities::builder().enable_tools().build();
        info.instructions = Some(
            "Remote team-presence MCP server. PM tools run on the hosted service; local session capture remains the team-presence collector CLI."
                .into(),
        );
        info
    }
}
