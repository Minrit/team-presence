use super::model::{
    ActivityActor, CreateRelationRequest, CreateStoryRequest, PatchStoryRequest, Priority,
    RelationKind, StoryStatus,
};
use std::str::FromStr;

#[test]
fn story_status_round_trip_via_str() {
    for s in ["todo", "in_progress", "blocked", "review", "done"] {
        let parsed = StoryStatus::from_str(s).unwrap();
        let json = serde_json::to_string(&parsed).unwrap();
        assert_eq!(json, format!("\"{s}\""));
    }
}

#[test]
fn unknown_story_status_rejected() {
    assert!(StoryStatus::from_str("wip").is_err());
    let err = serde_json::from_str::<StoryStatus>("\"wip\"").unwrap_err();
    assert!(err.to_string().contains("unknown variant"));
}

#[test]
fn can_transition_is_permissive_for_mvp() {
    let all = [
        StoryStatus::Todo,
        StoryStatus::InProgress,
        StoryStatus::Blocked,
        StoryStatus::Review,
        StoryStatus::Done,
    ];
    for from in all {
        for to in all {
            assert!(from.can_transition_to(to));
        }
    }
}

#[test]
fn status_as_str_matches_serde() {
    for s in [
        StoryStatus::Todo,
        StoryStatus::InProgress,
        StoryStatus::Blocked,
        StoryStatus::Review,
        StoryStatus::Done,
    ] {
        let via_serde = serde_json::to_string(&s).unwrap();
        assert_eq!(via_serde, format!("\"{}\"", s.as_str()));
    }
}

#[test]
fn patch_owner_tristate_distinguishes_absent_null_and_value() {
    let req: PatchStoryRequest = serde_json::from_str(r#"{}"#).unwrap();
    assert!(req.owner_id.is_none());

    let req: PatchStoryRequest = serde_json::from_str(r#"{"owner_id": null}"#).unwrap();
    assert!(matches!(req.owner_id, Some(None)));

    let uid = "00000000-0000-0000-0000-000000000001";
    let req: PatchStoryRequest =
        serde_json::from_str(&format!(r#"{{"owner_id": "{uid}"}}"#)).unwrap();
    assert!(matches!(req.owner_id, Some(Some(_))));
}

#[test]
fn patch_priority_and_points_tristate() {
    let req: PatchStoryRequest = serde_json::from_str(r#"{"priority":"P1"}"#).unwrap();
    assert!(matches!(req.priority, Some(Some(Priority::P1))));

    let req: PatchStoryRequest = serde_json::from_str(r#"{"priority":null}"#).unwrap();
    assert!(matches!(req.priority, Some(None)));

    let req: PatchStoryRequest = serde_json::from_str(r#"{"points":5}"#).unwrap();
    assert!(matches!(req.points, Some(Some(5))));

    let req: PatchStoryRequest = serde_json::from_str(r#"{"points":null}"#).unwrap();
    assert!(matches!(req.points, Some(None)));
}

#[test]
fn patch_epic_branch_pr_tristate() {
    let uid = "00000000-0000-0000-0000-000000000abc";
    let req: PatchStoryRequest =
        serde_json::from_str(&format!(r#"{{"epic_id":"{uid}"}}"#)).unwrap();
    assert!(matches!(req.epic_id, Some(Some(_))));

    let req: PatchStoryRequest =
        serde_json::from_str(r#"{"branch":"feat/x","pr_ref":"pp#42"}"#).unwrap();
    assert!(matches!(req.branch, Some(Some(ref b)) if b == "feat/x"));
    assert!(matches!(req.pr_ref, Some(Some(ref p)) if p == "pp#42"));

    let req: PatchStoryRequest =
        serde_json::from_str(r#"{"branch":null,"pr_ref":null,"epic_id":null}"#).unwrap();
    assert!(matches!(req.branch, Some(None)));
    assert!(matches!(req.pr_ref, Some(None)));
    assert!(matches!(req.epic_id, Some(None)));
}

#[test]
fn create_accepts_title_alias_for_name() {
    let req: CreateStoryRequest =
        serde_json::from_str(r#"{"title":"legacy client"}"#).unwrap();
    assert_eq!(req.name.as_deref(), Some("legacy client"));
}

#[test]
fn create_accepts_ac_as_array_or_string() {
    let req: CreateStoryRequest = serde_json::from_str(
        r#"{"name":"s","acceptance_criteria":[{"text":"x","done":false}]}"#,
    )
    .unwrap();
    assert!(req.acceptance_criteria.as_ref().unwrap().is_array());

    let req: CreateStoryRequest =
        serde_json::from_str(r#"{"name":"s","acceptance_criteria":"legacy body"}"#).unwrap();
    assert!(req.acceptance_criteria.as_ref().unwrap().is_string());
}

#[test]
fn priority_serde() {
    for p in ["P1", "P2", "P3", "P4"] {
        let parsed: Priority = serde_json::from_str(&format!("\"{p}\"")).unwrap();
        let back = serde_json::to_string(&parsed).unwrap();
        assert_eq!(back, format!("\"{p}\""));
    }
}

#[test]
fn create_relation_request_parses() {
    let req: CreateRelationRequest = serde_json::from_str(
        r#"{"kind":"blocks","to":"00000000-0000-0000-0000-000000000099"}"#,
    )
    .unwrap();
    assert_eq!(req.kind, RelationKind::Blocks);
}

#[test]
fn activity_actor_serde_lowercase() {
    let s = serde_json::to_string(&ActivityActor::Agent).unwrap();
    assert_eq!(s, "\"agent\"");
    let parsed: ActivityActor = serde_json::from_str("\"system\"").unwrap();
    assert_eq!(parsed, ActivityActor::System);
}
