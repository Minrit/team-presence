use super::model::{CreateEpicRequest, PatchEpicRequest};

#[test]
fn create_accepts_color_optional() {
    let req: CreateEpicRequest = serde_json::from_str(r#"{"name":"Platform"}"#).unwrap();
    assert_eq!(req.name, "Platform");
    assert!(req.color.is_none());
}

#[test]
fn create_with_color_and_description() {
    let raw = r##"{"name":"Docs","color":"#14b8a6","description":"Docs epic"}"##;
    let req: CreateEpicRequest = serde_json::from_str(raw).unwrap();
    assert_eq!(req.color.as_deref(), Some("#14b8a6"));
    assert_eq!(req.description.as_deref(), Some("Docs epic"));
}

#[test]
fn patch_all_optional() {
    let req: PatchEpicRequest = serde_json::from_str(r#"{}"#).unwrap();
    assert!(req.name.is_none() && req.color.is_none() && req.description.is_none());
}
