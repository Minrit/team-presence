use super::model::CreateCommentRequest;

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
