//! Dev-only helper: reset a user's password.
//!
//! Usage:
//!   cargo run --bin reset-pw -- <email> <new-password>
//!
//! Not wired into release builds — lives here for local smoke tests.

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut args = std::env::args().skip(1);
    let email = args.next().ok_or_else(|| anyhow::anyhow!("email required"))?;
    let pw = args.next().ok_or_else(|| anyhow::anyhow!("password required"))?;

    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://tp:tp@localhost:5433/team_presence".into());
    let pool = sqlx::PgPool::connect(&database_url).await?;

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(pw.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!(e.to_string()))?
        .to_string();

    let res = sqlx::query("UPDATE users SET password_hash = $1 WHERE email = $2")
        .bind(&hash)
        .bind(&email)
        .execute(&pool)
        .await?;
    println!("rows_affected={} email={}", res.rows_affected(), email);
    Ok(())
}
