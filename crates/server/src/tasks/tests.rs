use super::model::PatchTaskRequest;

#[test]
fn patch_task_done_tristate() {
    // Absent → None (no change)
    let req: PatchTaskRequest = serde_json::from_str(r#"{}"#).unwrap();
    assert!(req.done.is_none());

    // true / false distinguishable — controls done_at set-vs-clear.
    let req: PatchTaskRequest = serde_json::from_str(r#"{"done": true}"#).unwrap();
    assert_eq!(req.done, Some(true));
    let req: PatchTaskRequest = serde_json::from_str(r#"{"done": false}"#).unwrap();
    assert_eq!(req.done, Some(false));
}

#[test]
fn patch_task_title_and_position_parse() {
    let req: PatchTaskRequest =
        serde_json::from_str(r#"{"title": "rename me", "position": 3}"#).unwrap();
    assert_eq!(req.title.as_deref(), Some("rename me"));
    assert_eq!(req.position, Some(3));
}
