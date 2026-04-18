use super::model::{PatchStoryRequest, StoryStatus};
use std::str::FromStr;

#[test]
fn story_status_round_trip_via_str() {
    for s in ["todo", "doing", "done"] {
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
    // Any-to-any per plan Key Decisions — Phase 2 may tighten.
    for from in [StoryStatus::Todo, StoryStatus::Doing, StoryStatus::Done] {
        for to in [StoryStatus::Todo, StoryStatus::Doing, StoryStatus::Done] {
            assert!(from.can_transition_to(to));
        }
    }
}

#[test]
fn patch_owner_tristate_distinguishes_absent_null_and_value() {
    // Absent → None (no change)
    let req: PatchStoryRequest = serde_json::from_str(r#"{}"#).unwrap();
    assert!(req.owner_id.is_none());

    // Explicit null → Some(None) — unset owner
    let req: PatchStoryRequest = serde_json::from_str(r#"{"owner_id": null}"#).unwrap();
    assert!(matches!(req.owner_id, Some(None)));

    // Value → Some(Some(uuid)) — set owner
    let uid = "00000000-0000-0000-0000-000000000001";
    let req: PatchStoryRequest =
        serde_json::from_str(&format!(r#"{{"owner_id": "{uid}"}}"#)).unwrap();
    assert!(matches!(req.owner_id, Some(Some(_))));
}

#[test]
fn patch_repo_tristate_same_shape() {
    let req: PatchStoryRequest = serde_json::from_str(r#"{"repo": null}"#).unwrap();
    assert!(matches!(req.repo, Some(None)));
    let req: PatchStoryRequest = serde_json::from_str(r#"{"repo": "foo/bar"}"#).unwrap();
    assert!(matches!(req.repo, Some(Some(ref s)) if s == "foo/bar"));
}

#[test]
fn patch_sprint_id_tristate() {
    let req: PatchStoryRequest = serde_json::from_str(r#"{}"#).unwrap();
    assert!(req.sprint_id.is_none());
    let req: PatchStoryRequest = serde_json::from_str(r#"{"sprint_id": null}"#).unwrap();
    assert!(matches!(req.sprint_id, Some(None)));
    let uid = "00000000-0000-0000-0000-000000000099";
    let req: PatchStoryRequest =
        serde_json::from_str(&format!(r#"{{"sprint_id": "{uid}"}}"#)).unwrap();
    assert!(matches!(req.sprint_id, Some(Some(_))));
}

#[test]
fn create_accepts_title_alias_for_name() {
    use super::model::CreateStoryRequest;
    let req: CreateStoryRequest =
        serde_json::from_str(r#"{"title":"legacy client"}"#).unwrap();
    assert_eq!(req.name.as_deref(), Some("legacy client"));
}
