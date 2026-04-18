use crate::error::AppError;
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub exp: i64,
    pub nbf: i64,
    pub iat: i64,
    pub typ: String,
}

pub fn encode_access(secret: &str, user_id: Uuid, ttl_secs: u64) -> anyhow::Result<String> {
    let now = Utc::now().timestamp();
    let claims = Claims {
        sub: user_id,
        iat: now,
        nbf: now,
        exp: now + ttl_secs as i64,
        typ: "access".into(),
    };
    Ok(encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?)
}

pub fn decode_access(secret: &str, token: &str) -> Result<Claims, AppError> {
    let mut validation = Validation::default();
    validation.leeway = 0;
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|e| {
        tracing::debug!(error = %e, phase = "jwt_verify", "token rejected");
        AppError::Unauthorized
    })?;
    if data.claims.typ != "access" {
        return Err(AppError::Unauthorized);
    }
    Ok(data.claims)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_valid_token() {
        let uid = Uuid::new_v4();
        let tok = encode_access("testsecret", uid, 60).unwrap();
        let c = decode_access("testsecret", &tok).unwrap();
        assert_eq!(c.sub, uid);
        assert_eq!(c.typ, "access");
    }

    #[test]
    fn wrong_secret_rejected() {
        let uid = Uuid::new_v4();
        let tok = encode_access("s1", uid, 60).unwrap();
        assert!(decode_access("s2", &tok).is_err());
    }

    #[test]
    fn malformed_token_rejected() {
        assert!(decode_access("s", "not.a.jwt").is_err());
        assert!(decode_access("s", "").is_err());
    }
}
