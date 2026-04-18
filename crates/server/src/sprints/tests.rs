use super::model::{CreateSprintRequest, PatchSprintRequest};

#[test]
fn create_sprint_parses() {
    let raw = r#"{"name":"S1","start_date":"2026-04-18","end_date":"2026-05-01"}"#;
    let req: CreateSprintRequest = serde_json::from_str(raw).unwrap();
    assert_eq!(req.name, "S1");
    assert_eq!(req.start_date.to_string(), "2026-04-18");
}

#[test]
fn patch_sprint_fields_all_optional() {
    let req: PatchSprintRequest = serde_json::from_str(r#"{}"#).unwrap();
    assert!(req.name.is_none() && req.start_date.is_none() && req.end_date.is_none());
}

#[test]
fn patch_sprint_partial_name_only() {
    let req: PatchSprintRequest = serde_json::from_str(r#"{"name":"Sprint 2"}"#).unwrap();
    assert_eq!(req.name.as_deref(), Some("Sprint 2"));
    assert!(req.start_date.is_none() && req.end_date.is_none());
}
