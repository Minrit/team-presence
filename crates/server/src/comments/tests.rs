use super::model::{CreateCommentRequest, PatchCommentRequest};

#[test]
fn create_parses_body() {
    let req: CreateCommentRequest =
        serde_json::from_str(r#"{"body":"hello story"}"#).unwrap();
    assert_eq!(req.body, "hello story");
}

#[test]
fn create_rejects_wrong_shape() {
    let err = serde_json::from_str::<CreateCommentRequest>(r#"{"text":"no body"}"#);
    assert!(err.is_err());
}

#[test]
fn patch_parses_body() {
    let req: PatchCommentRequest =
        serde_json::from_str(r#"{"body":"edited"}"#).unwrap();
    assert_eq!(req.body, "edited");
}

#[test]
fn patch_rejects_missing_body() {
    let err = serde_json::from_str::<PatchCommentRequest>(r#"{}"#);
    assert!(err.is_err());
}
