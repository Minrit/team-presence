//! MCP server glue + all tool methods.
//!
//! Tool surface groups (plan 009 Units 3-6):
//!   tp_whoami / tp_story_* / tp_ac_* / tp_comment_* / tp_relation_* /
//!   tp_activity_* / tp_sprint_* / tp_epic_* / tp_collector_*
//!
//! Every write method flows through `self.api_or_err()` which returns a
//! clear "run `team-presence login` first" error when credentials are
//! missing. Every write also carries the `X-Actor-Kind: agent` header
//! (see api.rs) so `story_activity.actor_type='agent'` falls out
//! automatically at the server side.

use rmcp::{
    handler::server::{tool::ToolRouter, wrapper::Parameters},
    model::{
        CallToolResult, Content, Implementation, ProtocolVersion, ServerCapabilities, ServerInfo,
    },
    schemars::JsonSchema,
    tool, tool_handler, tool_router, ErrorData, ServerHandler,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::api::ApiClient;
use crate::error::{McpError, McpResult};

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

    pub(crate) fn api_or_err(&self) -> McpResult<&ApiClient> {
        self.api.as_ref().ok_or(McpError::NotLoggedIn)
    }
}

/// Helper: wrap anything JSON-serializable in a plain-text CallToolResult.
fn ok_text(label: &str, v: &Value) -> Result<CallToolResult, ErrorData> {
    let pretty = serde_json::to_string_pretty(v).unwrap_or_else(|_| v.to_string());
    Ok(CallToolResult::success(vec![Content::text(format!(
        "{label}\n{pretty}"
    ))]))
}

fn ok_msg(msg: String) -> Result<CallToolResult, ErrorData> {
    Ok(CallToolResult::success(vec![Content::text(msg)]))
}

// ---------------- args ------------------------------------------------------

#[derive(Debug, Deserialize, JsonSchema)]
pub struct StoryListArgs {
    /// Optional sprint UUID filter (accepts "latest" to auto-pick the most
    /// recently started sprint).
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
    /// Story UUID.
    pub id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct StoryCreateArgs {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// P1 | P2 | P3 | P4
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub points: Option<i32>,
    /// Epic name (MCP resolves to UUID) or raw UUID.
    #[serde(default)]
    pub epic: Option<String>,
    /// Sprint name OR raw UUID OR "latest".
    #[serde(default)]
    pub sprint: Option<String>,
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
    pub epic: Option<String>,
    #[serde(default)]
    pub sprint: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub pr_ref: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct StoryMoveArgs {
    pub id: String,
    /// todo | in_progress | blocked | review | done
    pub status: String,
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
    /// The story that does the blocking.
    pub from_id: String,
    /// The story being blocked.
    pub to_id: String,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ActivityListArgs {
    pub story_id: String,
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct SprintCreateArgs {
    pub name: String,
    /// YYYY-MM-DD
    pub start_date: String,
    /// YYYY-MM-DD
    pub end_date: String,
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

#[derive(Debug, Deserialize, JsonSchema, Default)]
pub struct EmptyArgs {}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct InstallHooksArgs {
    #[serde(default)]
    pub force: bool,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct CollectorLoginArgs {
    /// Server URL, e.g. `http://localhost:8080` or the team's
    /// team-presence deployment. Trailing slash optional.
    pub server: String,
    /// Email of your team-presence account.
    pub email: String,
    /// Password. Stored only in-memory long enough to mint a long-lived
    /// collector token; the password itself is not persisted.
    pub password: String,
    /// Optional friendly name for this collector in the admin UI.
    /// Defaults to the hostname.
    #[serde(default)]
    pub collector_name: Option<String>,
}

// ---------------- tool implementations -------------------------------------

#[tool_router]
impl TpMcp {
    // ==== smoke / identity =================================================

    #[tool(
        description = "Returns the authenticated team-presence user (email, UUID, display name). Use this to confirm the MCP server is reachable and credentials are loaded."
    )]
    pub async fn tp_whoami(&self) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let me = api.me().await.map_err(ErrorData::from)?;
        ok_msg(format!(
            "email={} id={} display_name={}",
            me.email, me.id, me.display_name
        ))
    }

    // ==== Story ============================================================

    #[tool(
        description = "List stories, optionally filtered by sprint (UUID or 'latest'), status, owner UUID, epic name/UUID, or priority (P1-P4)."
    )]
    pub async fn tp_story_list(
        &self,
        Parameters(args): Parameters<StoryListArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let sprint_id = match args.sprint {
            Some(ref s) if !s.is_empty() => Some(resolve_sprint(api, s).await.map_err(ErrorData::from)?),
            _ => None,
        };
        let epic_id = match args.epic {
            Some(ref s) if !s.is_empty() => Some(resolve_epic(api, s).await.map_err(ErrorData::from)?),
            _ => None,
        };
        let mut q = Vec::<(String, String)>::new();
        if let Some(id) = sprint_id {
            q.push(("sprint".into(), id.clone()));
        }
        if let Some(id) = epic_id {
            q.push(("epic".into(), id.clone()));
        }
        if let Some(s) = args.status {
            q.push(("status".into(), s));
        }
        if let Some(o) = args.owner {
            q.push(("owner".into(), o));
        }
        if let Some(p) = args.priority {
            q.push(("priority".into(), p));
        }
        let path = if q.is_empty() {
            "/api/v1/stories".to_string()
        } else {
            let qs: Vec<String> = q.into_iter().map(|(k, v)| format!("{k}={v}")).collect();
            format!("/api/v1/stories?{}", qs.join("&"))
        };
        let v: Value = api.get(&path).await.map_err(ErrorData::from)?;
        ok_text(&format!("stories: {}", v.as_array().map(|a| a.len()).unwrap_or(0)), &v)
    }

    #[tool(
        description = "Get a single story with its fields; for the full bundle (relations, activity, sessions) call tp_story_list then navigate in the browser."
    )]
    pub async fn tp_story_get(
        &self,
        Parameters(args): Parameters<StoryIdArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let v: Value = api
            .get(&format!("/api/v1/stories/{}", args.id))
            .await
            .map_err(ErrorData::from)?;
        ok_text("story:", &v)
    }

    #[tool(
        description = "Create a new story. `epic` and `sprint` accept either a UUID or a human-readable name (or 'latest' for sprint). Emits story_activity actor='agent'."
    )]
    pub async fn tp_story_create(
        &self,
        Parameters(args): Parameters<StoryCreateArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let epic_id = match args.epic {
            Some(ref s) if !s.is_empty() => Some(resolve_epic(api, s).await.map_err(ErrorData::from)?),
            _ => None,
        };
        let sprint_id = match args.sprint {
            Some(ref s) if !s.is_empty() => Some(resolve_sprint(api, s).await.map_err(ErrorData::from)?),
            _ => None,
        };
        let mut body = json!({
            "name": args.name,
        });
        if let Some(d) = args.description {
            body["description"] = Value::String(d);
        }
        if let Some(p) = args.priority {
            body["priority"] = Value::String(p);
        }
        if let Some(p) = args.points {
            body["points"] = Value::from(p);
        }
        if let Some(id) = epic_id {
            body["epic_id"] = Value::String(id);
        }
        if let Some(id) = sprint_id {
            body["sprint_id"] = Value::String(id);
        }
        if let Some(b) = args.branch {
            body["branch"] = Value::String(b);
        }
        if let Some(p) = args.pr_ref {
            body["pr_ref"] = Value::String(p);
        }
        let v: Value = api.post("/api/v1/stories", &body).await.map_err(ErrorData::from)?;
        ok_text("created:", &v)
    }

    #[tool(
        description = "Edit any subset of story fields (name, description, priority, points, epic, sprint, branch, pr_ref). Omit a field to leave it unchanged."
    )]
    pub async fn tp_story_edit(
        &self,
        Parameters(args): Parameters<StoryEditArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let epic_id = match args.epic {
            Some(ref s) if !s.is_empty() => Some(resolve_epic(api, s).await.map_err(ErrorData::from)?),
            _ => None,
        };
        let sprint_id = match args.sprint {
            Some(ref s) if !s.is_empty() => Some(resolve_sprint(api, s).await.map_err(ErrorData::from)?),
            _ => None,
        };
        let mut body = json!({});
        if let Some(n) = args.name {
            body["name"] = Value::String(n);
        }
        if let Some(d) = args.description {
            body["description"] = Value::String(d);
        }
        if let Some(p) = args.priority {
            body["priority"] = Value::String(p);
        }
        if let Some(p) = args.points {
            body["points"] = Value::from(p);
        }
        if let Some(id) = epic_id {
            body["epic_id"] = Value::String(id);
        }
        if let Some(id) = sprint_id {
            body["sprint_id"] = Value::String(id);
        }
        if let Some(b) = args.branch {
            body["branch"] = Value::String(b);
        }
        if let Some(p) = args.pr_ref {
            body["pr_ref"] = Value::String(p);
        }
        let v: Value = api
            .patch(&format!("/api/v1/stories/{}", args.id), &body)
            .await
            .map_err(ErrorData::from)?;
        ok_text("updated:", &v)
    }

    #[tool(
        description = "Move a story between statuses: todo | in_progress | blocked | review | done. Emits story_activity kind='status_change' actor='agent'."
    )]
    pub async fn tp_story_move_status(
        &self,
        Parameters(args): Parameters<StoryMoveArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let v: Value = api
            .patch(
                &format!("/api/v1/stories/{}", args.id),
                &json!({ "status": args.status }),
            )
            .await
            .map_err(ErrorData::from)?;
        ok_text(
            &format!("moved {} → {}:", args.id, args.status),
            &v,
        )
    }

    #[tool(
        description = "Claim a story for the authenticated user: sets owner_id=me and status=in_progress. Writes story_activity kind='claim' actor='agent'."
    )]
    pub async fn tp_story_claim(
        &self,
        Parameters(args): Parameters<StoryIdArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let me = api.me().await.map_err(ErrorData::from)?;
        let v: Value = api
            .patch(
                &format!("/api/v1/stories/{}", args.id),
                &json!({ "owner_id": me.id, "status": "in_progress" }),
            )
            .await
            .map_err(ErrorData::from)?;
        ok_text(&format!("claimed by {}:", me.email), &v)
    }

    #[tool(
        description = "Delete a story. Cascades to its comments, activity, and relations via FK rules."
    )]
    pub async fn tp_story_delete(
        &self,
        Parameters(args): Parameters<StoryIdArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        api.delete(&format!("/api/v1/stories/{}", args.id))
            .await
            .map_err(ErrorData::from)?;
        ok_msg(format!("deleted {}", args.id))
    }

    // ==== AC ==============================================================

    #[tool(description = "Append a new acceptance-criteria item (done=false).")]
    pub async fn tp_ac_add(
        &self,
        Parameters(args): Parameters<AcAddArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let story: Value = api
            .get(&format!("/api/v1/stories/{}", args.story_id))
            .await
            .map_err(ErrorData::from)?;
        let mut ac = story
            .get("acceptance_criteria")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        ac.push(json!({ "text": args.text, "done": false }));
        let updated: Value = api
            .patch(
                &format!("/api/v1/stories/{}", args.story_id),
                &json!({ "acceptance_criteria": ac }),
            )
            .await
            .map_err(ErrorData::from)?;
        ok_text("ac added:", &updated)
    }

    #[tool(description = "Mark acceptance-criteria item (0-based index) as done.")]
    pub async fn tp_ac_check(
        &self,
        Parameters(args): Parameters<AcIndexArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        set_ac_done(self, &args.story_id, args.index, true).await
    }

    #[tool(description = "Mark acceptance-criteria item as not yet done.")]
    pub async fn tp_ac_uncheck(
        &self,
        Parameters(args): Parameters<AcIndexArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        set_ac_done(self, &args.story_id, args.index, false).await
    }

    #[tool(description = "Replace the text of an acceptance-criteria item.")]
    pub async fn tp_ac_edit(
        &self,
        Parameters(args): Parameters<AcEditArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let mut ac = load_ac(api, &args.story_id).await.map_err(ErrorData::from)?;
        if args.index >= ac.len() {
            return Err(McpError::BadInput(format!(
                "invalid_index {} (story has {} items)",
                args.index,
                ac.len()
            ))
            .into());
        }
        ac[args.index]["text"] = Value::String(args.text);
        let updated: Value = api
            .patch(
                &format!("/api/v1/stories/{}", args.story_id),
                &json!({ "acceptance_criteria": ac }),
            )
            .await
            .map_err(ErrorData::from)?;
        ok_text("ac edited:", &updated)
    }

    #[tool(description = "Remove an acceptance-criteria item by index.")]
    pub async fn tp_ac_remove(
        &self,
        Parameters(args): Parameters<AcIndexArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let mut ac = load_ac(api, &args.story_id).await.map_err(ErrorData::from)?;
        if args.index >= ac.len() {
            return Err(McpError::BadInput(format!(
                "invalid_index {} (story has {} items)",
                args.index,
                ac.len()
            ))
            .into());
        }
        ac.remove(args.index);
        let updated: Value = api
            .patch(
                &format!("/api/v1/stories/{}", args.story_id),
                &json!({ "acceptance_criteria": ac }),
            )
            .await
            .map_err(ErrorData::from)?;
        ok_text("ac removed:", &updated)
    }

    // ==== Comments ========================================================

    #[tool(description = "Post a comment on a story. Emits story_activity kind='comment'.")]
    pub async fn tp_comment_create(
        &self,
        Parameters(args): Parameters<CommentCreateArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let v: Value = api
            .post(
                &format!("/api/v1/stories/{}/comments", args.story_id),
                &json!({ "body": args.body }),
            )
            .await
            .map_err(ErrorData::from)?;
        ok_text("comment:", &v)
    }

    #[tool(description = "List comments on a story oldest-first.")]
    pub async fn tp_comment_list(
        &self,
        Parameters(args): Parameters<StoryIdArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let v: Value = api
            .get(&format!("/api/v1/stories/{}/comments", args.id))
            .await
            .map_err(ErrorData::from)?;
        ok_text(
            &format!("comments: {}", v.as_array().map(|a| a.len()).unwrap_or(0)),
            &v,
        )
    }

    // ==== Relations =======================================================

    #[tool(description = "Create a 'blocks' relation: from_id blocks to_id.")]
    pub async fn tp_relation_block(
        &self,
        Parameters(args): Parameters<RelationArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let v: Value = api
            .post(
                &format!("/api/v1/stories/{}/relations", args.from_id),
                &json!({ "kind": "blocks", "to": args.to_id }),
            )
            .await
            .map_err(ErrorData::from)?;
        ok_text("blocked:", &v)
    }

    #[tool(description = "Remove a 'blocks' relation.")]
    pub async fn tp_relation_unblock(
        &self,
        Parameters(args): Parameters<RelationArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        api.delete(&format!(
            "/api/v1/stories/{}/relations/{}?kind=blocks",
            args.from_id, args.to_id
        ))
        .await
        .map_err(ErrorData::from)?;
        ok_msg(format!("unblocked {} → {}", args.from_id, args.to_id))
    }

    #[tool(description = "List a story's relations: { blocks: [...], blocked_by: [...] }.")]
    pub async fn tp_relation_list(
        &self,
        Parameters(args): Parameters<StoryIdArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let v: Value = api
            .get(&format!("/api/v1/stories/{}/relations", args.id))
            .await
            .map_err(ErrorData::from)?;
        ok_text("relations:", &v)
    }

    // ==== Activity ========================================================

    #[tool(description = "List recent story_activity rows, newest first. Default limit 50.")]
    pub async fn tp_activity_list(
        &self,
        Parameters(args): Parameters<ActivityListArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let path = match args.limit {
            Some(n) => format!("/api/v1/stories/{}/activity?limit={}", args.story_id, n),
            None => format!("/api/v1/stories/{}/activity", args.story_id),
        };
        let v: Value = api.get(&path).await.map_err(ErrorData::from)?;
        ok_text(
            &format!("activity: {}", v.as_array().map(|a| a.len()).unwrap_or(0)),
            &v,
        )
    }

    // ==== Sprint ==========================================================

    #[tool(description = "List all sprints with their {total_pts, done_pts, story_count} summary.")]
    pub async fn tp_sprint_list(
        &self,
        Parameters(_): Parameters<EmptyArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let sprints: Value = api.get("/api/v1/sprints").await.map_err(ErrorData::from)?;
        let stories: Value = api.get("/api/v1/stories").await.map_err(ErrorData::from)?;
        // Aggregate.
        let mut summary = Vec::new();
        for sp in sprints.as_array().cloned().unwrap_or_default() {
            let sid = sp.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let mut total = 0i64;
            let mut done = 0i64;
            let mut count = 0usize;
            for s in stories.as_array().cloned().unwrap_or_default() {
                if s.get("sprint_id").and_then(|v| v.as_str()) == Some(&sid) {
                    count += 1;
                    let pts = s.get("points").and_then(|v| v.as_i64()).unwrap_or(0);
                    total += pts;
                    if s.get("status").and_then(|v| v.as_str()) == Some("done") {
                        done += pts;
                    }
                }
            }
            let mut obj = sp.clone();
            obj["story_count"] = Value::from(count);
            obj["total_pts"] = Value::from(total);
            obj["done_pts"] = Value::from(done);
            summary.push(obj);
        }
        ok_text("sprints:", &Value::Array(summary))
    }

    #[tool(description = "Create a new sprint. start_date/end_date are ISO YYYY-MM-DD.")]
    pub async fn tp_sprint_create(
        &self,
        Parameters(args): Parameters<SprintCreateArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let v: Value = api
            .post(
                "/api/v1/sprints",
                &json!({
                    "name": args.name,
                    "start_date": args.start_date,
                    "end_date": args.end_date,
                }),
            )
            .await
            .map_err(ErrorData::from)?;
        ok_text("sprint created:", &v)
    }

    #[tool(description = "Edit sprint fields.")]
    pub async fn tp_sprint_edit(
        &self,
        Parameters(args): Parameters<SprintEditArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let mut body = json!({});
        if let Some(n) = args.name {
            body["name"] = Value::String(n);
        }
        if let Some(s) = args.start_date {
            body["start_date"] = Value::String(s);
        }
        if let Some(e) = args.end_date {
            body["end_date"] = Value::String(e);
        }
        let v: Value = api
            .patch(&format!("/api/v1/sprints/{}", args.id), &body)
            .await
            .map_err(ErrorData::from)?;
        ok_text("sprint updated:", &v)
    }

    // ==== Epic ============================================================

    #[tool(description = "List all epics with their color + description.")]
    pub async fn tp_epic_list(
        &self,
        Parameters(_): Parameters<EmptyArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let v: Value = api.get("/api/v1/epics").await.map_err(ErrorData::from)?;
        ok_text("epics:", &v)
    }

    #[tool(description = "Create a new epic. color is '#rrggbb' (default #64748b).")]
    pub async fn tp_epic_create(
        &self,
        Parameters(args): Parameters<EpicCreateArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let mut body = json!({ "name": args.name });
        if let Some(c) = args.color {
            body["color"] = Value::String(c);
        }
        if let Some(d) = args.description {
            body["description"] = Value::String(d);
        }
        let v: Value = api
            .post("/api/v1/epics", &body)
            .await
            .map_err(ErrorData::from)?;
        ok_text("epic created:", &v)
    }

    #[tool(description = "Edit epic name / color / description.")]
    pub async fn tp_epic_edit(
        &self,
        Parameters(args): Parameters<EpicEditArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let api = self.api_or_err().map_err(ErrorData::from)?;
        let mut body = json!({});
        if let Some(n) = args.name {
            body["name"] = Value::String(n);
        }
        if let Some(c) = args.color {
            body["color"] = Value::String(c);
        }
        if let Some(d) = args.description {
            body["description"] = Value::String(d);
        }
        let v: Value = api
            .patch(&format!("/api/v1/epics/{}", args.id), &body)
            .await
            .map_err(ErrorData::from)?;
        ok_text("epic updated:", &v)
    }

    // ==== Collector =======================================================

    #[tool(
        description = "Log this laptop into team-presence: authenticates via email+password, mints a long-lived collector token, and writes credentials to the OS keyring (with a file fallback). After this succeeds, every other MCP tool on this server can be used. Call this once per laptop; the token is durable. Don't pass the password through shared transcripts — prefer calling the tool with redacted text in your own logs."
    )]
    pub async fn tp_collector_login(
        &self,
        Parameters(args): Parameters<CollectorLoginArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        use team_presence_collector::client::ApiClient as CollectorApi;
        use team_presence_collector::credentials::{save, Credentials};

        let api = CollectorApi::new(&args.server).map_err(|e| {
            McpError::BadInput(format!("invalid server url: {e}"))
        })?;
        let login = api
            .login(&args.email, &args.password)
            .await
            .map_err(|e| McpError::Other(format!("login failed: {e}")))?;

        let name = args.collector_name.clone().or_else(hostname).unwrap_or_else(|| {
            format!("{}-mcp", args.email.split('@').next().unwrap_or("agent"))
        });
        let mint = api
            .mint_collector_token(&login.access_token, &name)
            .await
            .map_err(|e| McpError::Other(format!("mint token failed: {e}")))?;

        let creds = Credentials::new(
            args.server.trim_end_matches('/').into(),
            login.user.email.clone(),
            mint.id,
            mint.name.clone(),
            mint.token,
        );
        // Write straight to the 0600 file fallback, not the OS keyring.
        // tp-mcp gets spawned by the MCP client on every workspace open;
        // hitting the keyring every time triggers a macOS Keychain dialog
        // which is intolerable as a dev-tool UX. The file is 0600 inside a
        // 0700 dir — same security posture as ~/.ssh/id_rsa.
        save(&creds, true).map_err(|e| McpError::Other(format!("save creds: {e}")))?;

        ok_msg(format!(
            "logged in as {} <{}>\ncollector_name={}\ncollector_id={}\ncredentials saved — restart your MCP client so tp-mcp picks them up.",
            login.user.display_name, login.user.email, mint.name, mint.id,
        ))
    }

    #[tool(
        description = "Report whether credentials are saved + whether muted. Does not require network access."
    )]
    pub async fn tp_collector_status(
        &self,
        Parameters(_): Parameters<EmptyArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let muted = team_presence_collector::mute::is_muted();
        let summary = match team_presence_collector::credentials::load() {
            Ok(Some(c)) => format!(
                "status=logged_in\nserver={}\nuser_email={}\ncollector_name={}\ncollector_id={}\nmuted={}",
                c.server, c.user_email, c.collector_name, c.collector_id, muted,
            ),
            Ok(None) => format!("status=logged_out\nmuted={}", muted),
            Err(e) => format!("status=error\nreason={e}\nmuted={}", muted),
        };
        ok_msg(summary)
    }

    #[tool(
        description = "Install the Claude Code SessionStart + Stop hooks into ~/.claude/hooks so the collector picks up new sessions. Pass force=true to overwrite."
    )]
    pub async fn tp_collector_install_hooks(
        &self,
        Parameters(args): Parameters<InstallHooksArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let report = team_presence_collector::hooks::install(None, args.force)
            .map_err(|e| McpError::Other(e.to_string()))?;
        let installed: Vec<String> = report
            .installed
            .iter()
            .map(|p| p.display().to_string())
            .collect();
        let skipped: Vec<String> = report
            .skipped
            .iter()
            .map(|p| p.display().to_string())
            .collect();
        ok_msg(format!(
            "dir={}\ninstalled=[{}]\nskipped=[{}]",
            report.dir.display(),
            installed.join(", "),
            skipped.join(", "),
        ))
    }

    #[tool(description = "Remove previously installed Claude Code hooks.")]
    pub async fn tp_collector_uninstall_hooks(
        &self,
        Parameters(_): Parameters<EmptyArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        let removed = team_presence_collector::hooks::uninstall(None)
            .map_err(|e| McpError::Other(e.to_string()))?;
        let list: Vec<String> = removed.iter().map(|p| p.display().to_string()).collect();
        ok_msg(if list.is_empty() {
            "no hooks removed".into()
        } else {
            format!("removed:\n  {}", list.join("\n  "))
        })
    }

    #[tool(
        description = "Pause content streaming. Heartbeats + session metadata still flow; only session_content frames are suppressed."
    )]
    pub async fn tp_collector_mute(
        &self,
        Parameters(_): Parameters<EmptyArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        team_presence_collector::mute::mute().map_err(|e| McpError::Other(e.to_string()))?;
        ok_msg("muted".into())
    }

    #[tool(description = "Resume content streaming.")]
    pub async fn tp_collector_unmute(
        &self,
        Parameters(_): Parameters<EmptyArgs>,
    ) -> Result<CallToolResult, ErrorData> {
        team_presence_collector::mute::unmute().map_err(|e| McpError::Other(e.to_string()))?;
        ok_msg("unmuted".into())
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

// ---------------- helpers ---------------------------------------------------

async fn resolve_sprint(api: &ApiClient, hint: &str) -> McpResult<String> {
    // If it already parses as a UUID, pass through.
    if uuid::Uuid::parse_str(hint).is_ok() {
        return Ok(hint.to_string());
    }
    let sprints: Value = api.get("/api/v1/sprints").await?;
    let arr = sprints.as_array().cloned().unwrap_or_default();
    if hint.eq_ignore_ascii_case("latest") {
        // Newest start_date wins.
        let mut items: Vec<Value> = arr;
        items.sort_by(|a, b| {
            b.get("start_date")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .cmp(
                    a.get("start_date").and_then(|v| v.as_str()).unwrap_or(""),
                )
        });
        let latest = items
            .first()
            .and_then(|v| v.get("id").and_then(|i| i.as_str()))
            .ok_or_else(|| McpError::NotFound("no sprints exist".into()))?;
        return Ok(latest.to_string());
    }
    for s in arr {
        if s.get("name").and_then(|v| v.as_str()) == Some(hint) {
            return Ok(s
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string());
        }
    }
    Err(McpError::BadInput(format!(
        "sprint '{hint}' not found — try tp_sprint_list"
    )))
}

async fn resolve_epic(api: &ApiClient, hint: &str) -> McpResult<String> {
    if uuid::Uuid::parse_str(hint).is_ok() {
        return Ok(hint.to_string());
    }
    let epics: Value = api.get("/api/v1/epics").await?;
    for e in epics.as_array().cloned().unwrap_or_default() {
        if e.get("name").and_then(|v| v.as_str()) == Some(hint) {
            return Ok(e
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string());
        }
    }
    Err(McpError::BadInput(format!(
        "epic '{hint}' not found — try tp_epic_list"
    )))
}

async fn load_ac(api: &ApiClient, story_id: &str) -> McpResult<Vec<Value>> {
    let story: Value = api.get(&format!("/api/v1/stories/{story_id}")).await?;
    Ok(story
        .get("acceptance_criteria")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default())
}

async fn set_ac_done(
    this: &TpMcp,
    story_id: &str,
    index: usize,
    done: bool,
) -> Result<CallToolResult, ErrorData> {
    let api = this.api_or_err().map_err(ErrorData::from)?;
    let mut ac = load_ac(api, story_id).await.map_err(ErrorData::from)?;
    if index >= ac.len() {
        return Err(McpError::BadInput(format!(
            "invalid_index {index} (story has {} items)",
            ac.len()
        ))
        .into());
    }
    ac[index]["done"] = Value::Bool(done);
    let updated: Value = api
        .patch(
            &format!("/api/v1/stories/{story_id}"),
            &json!({ "acceptance_criteria": ac }),
        )
        .await
        .map_err(ErrorData::from)?;
    ok_text(
        &format!(
            "ac[{index}].done={} updated:",
            if done { "true" } else { "false" }
        ),
        &updated,
    )
}

// Silence unused-warning for the ref-only Serialize/Deserialize derive path.
#[allow(dead_code)]
fn _assert_types() -> Option<impl Serialize> {
    Some(json!({}))
}

/// Best-effort hostname for collector_name default. Mirrors the collector
/// CLI's fallback logic in crates/collector/src/main.rs.
fn hostname() -> Option<String> {
    std::env::var("HOSTNAME")
        .ok()
        .filter(|s| !s.is_empty())
        .or_else(|| {
            std::process::Command::new("hostname")
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        })
}
