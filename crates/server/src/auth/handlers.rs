use super::{
    jwt,
    model::{
        AddUserRequest, BootstrapRequest, Identity, LoginRequest, LoginResponse, UserPublic,
        REFRESH_COOKIE_NAME,
    },
    password,
};
use crate::{auth::sha256_hex, error::AppError, state::AppState};
use axum::{extract::State, Extension, Json};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use chrono::{DateTime, Utc};
use rand::RngCore;
use uuid::Uuid;

/// First-user bootstrap. Succeeds only when `users` is empty; subsequent calls return 403.
/// Closes the "anyone on the network can register as admin" gap flagged in review.
pub async fn bootstrap(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<BootstrapRequest>,
) -> Result<(CookieJar, Json<LoginResponse>), AppError> {
    validate_registration(&req.email, &req.password, &req.display_name)?;

    let (count,): (i64,) = sqlx::query_as("SELECT count(*) FROM users")
        .fetch_one(&state.db)
        .await?;
    if count > 0 {
        return Err(AppError::BootstrapAlreadyDone);
    }

    let user = insert_user(&state, &req.email, &req.password, &req.display_name).await?;
    issue_session(&state, jar, user).await
}

/// Subsequent user creation. Requires an authenticated caller (any existing user — everyone admin).
pub async fn add_user_authenticated(
    State(state): State<AppState>,
    Extension(_caller): Extension<Identity>,
    Json(req): Json<AddUserRequest>,
) -> Result<Json<UserPublic>, AppError> {
    validate_registration(&req.email, &req.password, &req.display_name)?;
    let user = insert_user(&state, &req.email, &req.password, &req.display_name).await?;
    Ok(Json(user))
}

pub async fn login(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(req): Json<LoginRequest>,
) -> Result<(CookieJar, Json<LoginResponse>), AppError> {
    let row: Option<(Uuid, String, String, String, DateTime<Utc>)> = sqlx::query_as(
        "SELECT id, email, display_name, password_hash, created_at FROM users WHERE email = $1",
    )
    .bind(req.email.to_lowercase())
    .fetch_optional(&state.db)
    .await?;

    // Timing-parity: run argon2 verify on both branches so response time does not
    // leak user existence.
    let (ok, user_opt) = match row {
        Some((id, email, display_name, hash, created_at)) => {
            let ok = password::verify(&req.password, &hash);
            (
                ok,
                Some(UserPublic {
                    id,
                    email,
                    display_name,
                    created_at,
                }),
            )
        }
        None => {
            let _ = password::verify(&req.password, password::DUMMY_HASH);
            (false, None)
        }
    };

    if !ok {
        return Err(AppError::Unauthorized);
    }

    issue_session(&state, jar, user_opt.unwrap()).await
}

pub async fn refresh(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<(CookieJar, Json<LoginResponse>), AppError> {
    let cookie = jar.get(REFRESH_COOKIE_NAME).ok_or(AppError::Unauthorized)?;
    let sha = sha256_hex(cookie.value());

    let row: Option<(Uuid, Uuid, String, String, DateTime<Utc>)> = sqlx::query_as(
        r#"SELECT s.id, u.id, u.email, u.display_name, u.created_at
           FROM user_sessions s
           JOIN users u ON u.id = s.user_id
           WHERE s.refresh_token_sha256 = $1
             AND s.revoked_at IS NULL
             AND s.expires_at > now()"#,
    )
    .bind(&sha)
    .fetch_optional(&state.db)
    .await?;

    let (_session_id, user_id, email, display_name, created_at) =
        row.ok_or(AppError::Unauthorized)?;

    // Rotate refresh: revoke the old session row, issue a new one via issue_session.
    let _ = sqlx::query("UPDATE user_sessions SET revoked_at = now() WHERE refresh_token_sha256 = $1")
        .bind(&sha)
        .execute(&state.db)
        .await;

    issue_session(
        &state,
        jar,
        UserPublic {
            id: user_id,
            email,
            display_name,
            created_at,
        },
    )
    .await
}

pub async fn logout(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<CookieJar, AppError> {
    if let Some(cookie) = jar.get(REFRESH_COOKIE_NAME) {
        let sha = sha256_hex(cookie.value());
        let _ = sqlx::query(
            "UPDATE user_sessions SET revoked_at = now() WHERE refresh_token_sha256 = $1",
        )
        .bind(&sha)
        .execute(&state.db)
        .await;
    }
    let removed = Cookie::build(REFRESH_COOKIE_NAME)
        .path("/api/v1/auth")
        .build();
    Ok(jar.remove(removed))
}

pub async fn me(
    State(state): State<AppState>,
    Extension(identity): Extension<Identity>,
) -> Result<Json<UserPublic>, AppError> {
    let row: Option<UserPublic> = sqlx::query_as(
        "SELECT id, email, display_name, created_at FROM users WHERE id = $1",
    )
    .bind(identity.user_id)
    .fetch_optional(&state.db)
    .await?;
    row.map(Json).ok_or(AppError::NotFound)
}

/// Everyone-admin workspace: any authenticated user can list teammates.
/// Used by the browser to label owner avatars / owner-filter chips.
pub async fn list_users(
    State(state): State<AppState>,
    Extension(_identity): Extension<Identity>,
) -> Result<Json<Vec<UserPublic>>, AppError> {
    let rows: Vec<UserPublic> = sqlx::query_as(
        "SELECT id, email, display_name, created_at FROM users ORDER BY created_at ASC",
    )
    .fetch_all(&state.db)
    .await?;
    Ok(Json(rows))
}

// ---- helpers ---------------------------------------------------------------

fn validate_registration(email: &str, password: &str, display_name: &str) -> Result<(), AppError> {
    if !email.contains('@') {
        return Err(AppError::BadRequest("email must contain @".into()));
    }
    if password.len() < 8 {
        return Err(AppError::BadRequest("password must be >= 8 chars".into()));
    }
    if display_name.trim().is_empty() {
        return Err(AppError::BadRequest("display_name required".into()));
    }
    Ok(())
}

async fn insert_user(
    state: &AppState,
    email: &str,
    password: &str,
    display_name: &str,
) -> Result<UserPublic, AppError> {
    let hash = password::hash(password).map_err(AppError::Internal)?;

    let row: Result<(Uuid, String, String, DateTime<Utc>), sqlx::Error> = sqlx::query_as(
        r#"INSERT INTO users (email, password_hash, display_name)
           VALUES ($1, $2, $3)
           RETURNING id, email, display_name, created_at"#,
    )
    .bind(email.to_lowercase())
    .bind(&hash)
    .bind(display_name)
    .fetch_one(&state.db)
    .await;

    match row {
        Ok((id, email, display_name, created_at)) => Ok(UserPublic {
            id,
            email,
            display_name,
            created_at,
        }),
        Err(sqlx::Error::Database(db)) if db.is_unique_violation() => Err(AppError::Conflict),
        Err(e) => Err(e.into()),
    }
}

async fn issue_session(
    state: &AppState,
    jar: CookieJar,
    user: UserPublic,
) -> Result<(CookieJar, Json<LoginResponse>), AppError> {
    let access_token = jwt::encode_access(&state.jwt.secret, user.id, state.jwt.access_ttl_secs)
        .map_err(AppError::Internal)?;

    let mut buf = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut buf);
    let refresh_raw = hex::encode(buf);
    let refresh_sha = sha256_hex(&refresh_raw);

    sqlx::query(
        r#"INSERT INTO user_sessions (user_id, refresh_token_sha256, expires_at)
           VALUES ($1, $2, now() + ($3 || ' seconds')::interval)"#,
    )
    .bind(user.id)
    .bind(&refresh_sha)
    .bind(state.jwt.refresh_ttl_secs.to_string())
    .execute(&state.db)
    .await?;

    let cookie = Cookie::build((REFRESH_COOKIE_NAME, refresh_raw))
        .http_only(true)
        .same_site(SameSite::Strict)
        .secure(cookie_secure())
        .path("/api/v1/auth")
        .max_age(time::Duration::seconds(state.jwt.refresh_ttl_secs as i64))
        .build();

    Ok((
        jar.add(cookie),
        Json(LoginResponse {
            access_token,
            access_ttl_secs: state.jwt.access_ttl_secs,
            user,
        }),
    ))
}

/// When deployed behind TLS (expected default) cookies get Secure=true.
/// Setting `ALLOW_INSECURE_TRANSPORT=true` drops the flag so localhost / VPN
/// demos work without HTTPS. Default refuses to drop it.
fn cookie_secure() -> bool {
    !matches!(
        std::env::var("ALLOW_INSECURE_TRANSPORT").as_deref(),
        Ok("true")
    )
}
