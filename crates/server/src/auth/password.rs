use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

pub fn hash(password: &str) -> anyhow::Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow::anyhow!("argon2 hash failed: {e}"))?;
    Ok(hash.to_string())
}

pub fn verify(password: &str, hash: &str) -> bool {
    match PasswordHash::new(hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    }
}

/// Stable dummy argon2id hash used to make the no-such-user branch do the same
/// amount of CPU work as the valid-user branch (timing-parity against enumeration).
/// Safe to ship in code because it has no corresponding plaintext.
pub(crate) const DUMMY_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$k6Y1MuJn/WJS5kuf2/dVrkXl1nQMM1nB0JH9Z6Z7qa4";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_and_verify_match() {
        let h = hash("hunter2!").unwrap();
        assert!(verify("hunter2!", &h));
    }

    #[test]
    fn wrong_password_rejected() {
        let h = hash("hunter2!").unwrap();
        assert!(!verify("hunter3", &h));
    }

    #[test]
    fn different_hashes_for_same_password() {
        let a = hash("same").unwrap();
        let b = hash("same").unwrap();
        assert_ne!(a, b, "argon2 salt must randomize");
    }

    #[test]
    fn verify_against_garbage_hash_is_false_not_panic() {
        assert!(!verify("anything", "not a valid hash"));
    }
}
