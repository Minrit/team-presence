//! Filesystem layout for the collector.
//!
//!   ~/.config/team-presence/credentials.json    (0600, dir 0700)
//!   ~/.config/team-presence/muted                (empty file; presence == muted)
//!   /tmp/team-presence-<uid>.sock                (hook socket, 0600, peer-uid verified)
//!
//! The XDG-style config dir is resolved via `directories` so Linux honors
//! XDG_CONFIG_HOME. On macOS this lands in `~/Library/Application Support/team-presence`
//! which is fine — users don't normally touch it.

use std::path::PathBuf;

use directories::ProjectDirs;

pub const APP_QUALIFIER: &str = "io";
pub const APP_ORG: &str = "team-presence";
pub const APP_NAME: &str = "team-presence";

/// Resolve the config dir, creating it with mode 0700 if missing.
pub fn config_dir() -> anyhow::Result<PathBuf> {
    let pd = ProjectDirs::from(APP_QUALIFIER, APP_ORG, APP_NAME)
        .ok_or_else(|| anyhow::anyhow!("no home directory"))?;
    let dir = pd.config_dir().to_path_buf();
    ensure_private_dir(&dir)?;
    Ok(dir)
}

pub fn credentials_path() -> anyhow::Result<PathBuf> {
    Ok(config_dir()?.join("credentials.json"))
}

pub fn mute_flag_path() -> anyhow::Result<PathBuf> {
    Ok(config_dir()?.join("muted"))
}

/// Hook socket path. Contains the uid so two users on the same host don't
/// collide, and lives in /tmp (cleared on reboot) so a stale socket from a
/// crashed collector won't block the next start.
pub fn hook_socket_path() -> PathBuf {
    let uid = unsafe { libc::getuid() };
    PathBuf::from(format!("/tmp/team-presence-{uid}.sock"))
}

/// mkdir -p with mode 0700. If the dir already exists with wider perms, we
/// refuse — the user has their own private files in there and we don't want
/// to silently mask a permission drift.
fn ensure_private_dir(p: &std::path::Path) -> anyhow::Result<()> {
    if p.exists() {
        if !p.is_dir() {
            anyhow::bail!("{} exists but is not a directory", p.display());
        }
        check_mode(p, 0o700, "config dir")?;
        return Ok(());
    }
    std::fs::create_dir_all(p)?;
    set_mode(p, 0o700)?;
    Ok(())
}

#[cfg(unix)]
pub fn check_mode(p: &std::path::Path, expected_mode: u32, label: &str) -> anyhow::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let md = std::fs::metadata(p)?;
    let actual = md.permissions().mode() & 0o777;
    if actual != expected_mode {
        anyhow::bail!(
            "{label} {} has mode {:o}, expected {:o} — chmod {:o} {} and re-run",
            p.display(),
            actual,
            expected_mode,
            expected_mode,
            p.display()
        );
    }
    Ok(())
}

#[cfg(not(unix))]
pub fn check_mode(_p: &std::path::Path, _expected_mode: u32, _label: &str) -> anyhow::Result<()> {
    Ok(())
}

#[cfg(unix)]
pub fn set_mode(p: &std::path::Path, mode: u32) -> anyhow::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let perms = std::fs::Permissions::from_mode(mode);
    std::fs::set_permissions(p, perms)?;
    Ok(())
}

#[cfg(not(unix))]
pub fn set_mode(_p: &std::path::Path, _mode: u32) -> anyhow::Result<()> {
    Ok(())
}
