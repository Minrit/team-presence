//! Integration test for Unit 7: emit → XRANGE replay round trip.
//!
//! Requires a real Redis. Set `TP_TEST_REDIS_URL` to enable. Skipped otherwise.
//! Uses a per-run namespace (uuid-suffixed key) so it's safe against shared Redis.

use chrono::Utc;
use team_presence_server::session::emit::{
    emit_frame, fanout_channel, room_key, ROOM_MAXLEN, ROOM_TTL_SECS,
};
use team_presence_shared_types::{Content, ContentRole, Frame};
use uuid::Uuid;

fn test_redis_url() -> Option<String> {
    std::env::var("TP_TEST_REDIS_URL").ok()
}

#[tokio::test]
async fn emit_and_replay_via_xrange() {
    let Some(url) = test_redis_url() else {
        eprintln!("skipping: TP_TEST_REDIS_URL not set");
        return;
    };
    let client = redis::Client::open(url).expect("open redis");
    let sid = Uuid::new_v4();

    // Sanity: key space is empty.
    let mut conn = client
        .get_multiplexed_async_connection()
        .await
        .expect("conn");
    let _: () = redis::cmd("DEL")
        .arg(room_key(sid))
        .query_async(&mut conn)
        .await
        .unwrap_or(());

    let f = Frame::SessionContent {
        session_id: sid,
        role: ContentRole::Assistant,
        text: Content("round-trip payload".into()),
        ts: Utc::now(),
    };
    emit_frame(&client, sid, &f, None).await;

    let entries: Vec<(String, Vec<(String, String)>)> = redis::cmd("XRANGE")
        .arg(room_key(sid))
        .arg("-")
        .arg("+")
        .query_async(&mut conn)
        .await
        .expect("xrange");
    assert_eq!(entries.len(), 1);
    let (_id, fields) = &entries[0];
    let data = fields
        .iter()
        .find(|(k, _)| k == "data")
        .map(|(_, v)| v.clone())
        .expect("data field");
    let back: Frame = serde_json::from_str(&data).unwrap();
    assert!(matches!(back, Frame::SessionContent { .. }));

    // TTL should be close to 24h (>= 23h; allow one-minute slack for test latency).
    let ttl: i64 = redis::cmd("TTL")
        .arg(room_key(sid))
        .query_async(&mut conn)
        .await
        .expect("ttl");
    assert!(
        ttl > (ROOM_TTL_SECS as i64 - 60) && ttl <= ROOM_TTL_SECS as i64,
        "TTL {} out of expected band near {}",
        ttl,
        ROOM_TTL_SECS
    );

    // Cleanup.
    let _: () = redis::cmd("DEL")
        .arg(room_key(sid))
        .query_async(&mut conn)
        .await
        .unwrap_or(());
}

#[tokio::test]
async fn fanout_publish_reaches_subscriber() {
    let Some(url) = test_redis_url() else {
        eprintln!("skipping: TP_TEST_REDIS_URL not set");
        return;
    };
    let client = redis::Client::open(url).expect("open redis");
    let sid = Uuid::new_v4();

    let sub_client = client.clone();
    let channel = fanout_channel(sid);
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(8);
    let channel_for_sub = channel.clone();
    tokio::spawn(async move {
        let Ok(mut pubsub) = sub_client.get_async_pubsub().await else {
            return;
        };
        if pubsub.subscribe(&channel_for_sub).await.is_err() {
            return;
        }
        let mut stream = pubsub.on_message();
        if let Some(msg) = futures_util::StreamExt::next(&mut stream).await {
            if let Ok(p) = msg.get_payload::<String>() {
                let _ = tx.send(p).await;
            }
        }
    });
    // Tiny delay for subscriber registration.
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    let f = Frame::SessionContent {
        session_id: sid,
        role: ContentRole::User,
        text: Content("hi".into()),
        ts: Utc::now(),
    };
    emit_frame(&client, sid, &f, None).await;

    let got =
        tokio::time::timeout(std::time::Duration::from_secs(2), rx.recv()).await;
    assert!(got.is_ok() && got.unwrap().is_some(), "subscriber got no message");

    // Cleanup.
    let mut conn = client
        .get_multiplexed_async_connection()
        .await
        .expect("conn");
    let _: () = redis::cmd("DEL")
        .arg(room_key(sid))
        .query_async(&mut conn)
        .await
        .unwrap_or(());
}

#[test]
fn maxlen_constant_is_sane() {
    // Plan §Key Technical Decisions pins this at ~100k for ~12h of busy content.
    assert_eq!(ROOM_MAXLEN, 100_000);
}
