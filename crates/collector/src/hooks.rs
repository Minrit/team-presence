//! Install / uninstall claude-code hook scripts.
//!
//! Claude Code invokes hook scripts via stdin+env when a `SessionStart` or
//! `Stop` event fires; the collector reads the hook's JSON payload, finds
//! `transcript_path` on SessionStart, and pushes a lifecycle frame onto the
//! collector's local unix socket.
//!
//! This module writes the shell scripts AND registers them in
//! `~/.claude/settings.json`, which is what actually wires Claude Code's
//! event dispatcher to the scripts. Missing the settings registration was
//! the cause of silent onboarding failures where the scripts existed on
//! disk but never fired.

use std::path::{Path, PathBuf};

use crate::config::{hook_socket_path, set_mode};

pub const SESSION_START_HOOK_NAME: &str = "team-presence-session-start.sh";
pub const STOP_HOOK_NAME: &str = "team-presence-stop.sh";
pub const SESSION_START_EVENT: &str = "SessionStart";
pub const STOP_EVENT: &str = "Stop";

pub fn default_hooks_dir() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".claude").join("hooks"))
}

pub fn default_settings_path() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".claude").join("settings.json"))
}

pub fn session_start_script(socket: &Path) -> String {
    format!(
        "#!/usr/bin/env bash\n\
         # team-presence SessionStart hook — installed by `team-presence install-hooks`.\n\
         # Forwards Claude Code's stdin JSON (includes transcript_path + session_id)\n\
         # to the local collector socket. Does nothing if the collector is not running.\n\
         set -eu\n\
         SOCK=\"{sock}\"\n\
         if command -v nc >/dev/null 2>&1; then\n\
         \tpayload=\"$(cat)\"\n\
         \tprintf '%s\\n' \"{{\\\"kind\\\":\\\"session_start\\\",\\\"payload\\\":$payload}}\" \\\n\
         \t\t| nc -U -w 1 \"$SOCK\" 2>/dev/null || true\n\
         fi\n\
         exit 0\n",
        sock = socket.display()
    )
}

pub fn stop_script(socket: &Path) -> String {
    format!(
        "#!/usr/bin/env bash\n\
         # team-presence Stop hook — installed by `team-presence install-hooks`.\n\
         set -eu\n\
         SOCK=\"{sock}\"\n\
         if command -v nc >/dev/null 2>&1; then\n\
         \tpayload=\"$(cat)\"\n\
         \tprintf '%s\\n' \"{{\\\"kind\\\":\\\"stop\\\",\\\"payload\\\":$payload}}\" \\\n\
         \t\t| nc -U -w 1 \"$SOCK\" 2>/dev/null || true\n\
         fi\n\
         exit 0\n",
        sock = socket.display()
    )
}

#[derive(Debug, Default)]
pub struct InstallReport {
    pub dir: PathBuf,
    pub installed: Vec<PathBuf>,
    pub skipped: Vec<PathBuf>,
    pub settings_path: Option<PathBuf>,
    pub settings_updated: bool,
}

#[derive(Debug, Default)]
pub struct UninstallReport {
    pub removed_scripts: Vec<PathBuf>,
    pub settings_path: Option<PathBuf>,
    pub settings_updated: bool,
}

pub fn install(dir: Option<PathBuf>, force: bool) -> anyhow::Result<InstallReport> {
    install_with(dir, default_settings_path(), force)
}

pub fn uninstall(dir: Option<PathBuf>) -> anyhow::Result<UninstallReport> {
    uninstall_with(dir, default_settings_path())
}

/// Like `install` but takes an explicit settings.json path (for tests).
pub fn install_with(
    dir: Option<PathBuf>,
    settings_path: Option<PathBuf>,
    force: bool,
) -> anyhow::Result<InstallReport> {
    let dir = dir
        .or_else(default_hooks_dir)
        .ok_or_else(|| anyhow::anyhow!("HOME not set; pass --dir to choose a hooks directory"))?;
    std::fs::create_dir_all(&dir)?;

    let socket = hook_socket_path();
    let mut report = InstallReport {
        dir: dir.clone(),
        ..Default::default()
    };

    for (name, body) in [
        (SESSION_START_HOOK_NAME, session_start_script(&socket)),
        (STOP_HOOK_NAME, stop_script(&socket)),
    ] {
        let path = dir.join(name);
        if path.exists() && !force {
            report.skipped.push(path);
            continue;
        }
        std::fs::write(&path, body)?;
        let _ = set_mode(&path, 0o755);
        report.installed.push(path);
    }

    // Wire the SessionStart script into settings.json. We deliberately do
    // NOT register the Stop script: the daemon treats Stop as a no-op now
    // (Claude Code fires it every turn, not at session end), so registering
    // it would just pile up noise events without any effect.
    let session_start_path = dir.join(SESSION_START_HOOK_NAME);
    if let Some(settings) = settings_path {
        let updated = register_in_settings(&settings, SESSION_START_EVENT, &session_start_path)?;
        report.settings_path = Some(settings);
        report.settings_updated = updated;
    }

    Ok(report)
}

/// Like `uninstall` but takes an explicit settings.json path (for tests).
pub fn uninstall_with(
    dir: Option<PathBuf>,
    settings_path: Option<PathBuf>,
) -> anyhow::Result<UninstallReport> {
    let dir = dir
        .or_else(default_hooks_dir)
        .ok_or_else(|| anyhow::anyhow!("HOME not set; pass --dir to choose a hooks directory"))?;
    let mut report = UninstallReport::default();
    for name in [SESSION_START_HOOK_NAME, STOP_HOOK_NAME] {
        let path = dir.join(name);
        if path.exists() {
            std::fs::remove_file(&path)?;
            report.removed_scripts.push(path);
        }
    }

    // Clean both events — Stop may still be registered from older installs.
    if let Some(settings) = settings_path {
        let session_start_path = dir.join(SESSION_START_HOOK_NAME);
        let stop_path = dir.join(STOP_HOOK_NAME);
        let mut any = false;
        any |= unregister_from_settings(&settings, SESSION_START_EVENT, &session_start_path)?;
        any |= unregister_from_settings(&settings, STOP_EVENT, &stop_path)?;
        report.settings_path = Some(settings);
        report.settings_updated = any;
    }

    Ok(report)
}

/// Merge a hook entry pointing at `command_path` into the given event array
/// inside `~/.claude/settings.json`. Idempotent: returns false if the entry
/// already exists or the settings file is missing / unreadable.
fn register_in_settings(
    settings_path: &Path,
    event: &str,
    command_path: &Path,
) -> anyhow::Result<bool> {
    let Some(mut json) = read_settings(settings_path)? else {
        return Ok(false);
    };
    let cmd = command_path.display().to_string();

    let hooks = json
        .as_object_mut()
        .ok_or_else(|| anyhow::anyhow!("settings.json root is not an object"))?
        .entry("hooks".to_string())
        .or_insert_with(|| serde_json::json!({}));
    let hooks_obj = hooks
        .as_object_mut()
        .ok_or_else(|| anyhow::anyhow!("settings.json 'hooks' is not an object"))?;
    let arr = hooks_obj
        .entry(event.to_string())
        .or_insert_with(|| serde_json::json!([]))
        .as_array_mut()
        .ok_or_else(|| anyhow::anyhow!("settings.json 'hooks.{event}' is not an array"))?;

    for entry in arr.iter() {
        if let Some(list) = entry.get("hooks").and_then(|v| v.as_array()) {
            for h in list {
                if h.get("command").and_then(|c| c.as_str()) == Some(cmd.as_str()) {
                    return Ok(false);
                }
            }
        }
    }
    arr.push(serde_json::json!({
        "hooks": [{ "command": cmd, "type": "command" }]
    }));

    write_settings(settings_path, &json)?;
    Ok(true)
}

/// Remove any hook entry with `command` == `command_path` from the given event.
/// Drops empty groups and empty events. Idempotent.
fn unregister_from_settings(
    settings_path: &Path,
    event: &str,
    command_path: &Path,
) -> anyhow::Result<bool> {
    let Some(mut json) = read_settings(settings_path)? else {
        return Ok(false);
    };
    let cmd = command_path.display().to_string();

    let Some(hooks_obj) = json
        .get_mut("hooks")
        .and_then(|v| v.as_object_mut())
    else {
        return Ok(false);
    };
    let Some(arr) = hooks_obj.get_mut(event).and_then(|v| v.as_array_mut()) else {
        return Ok(false);
    };

    let mut changed = false;
    let mut new_arr: Vec<serde_json::Value> = Vec::with_capacity(arr.len());
    for entry in arr.drain(..) {
        let mut entry = entry;
        if let Some(list) = entry.get_mut("hooks").and_then(|v| v.as_array_mut()) {
            let before = list.len();
            list.retain(|h| h.get("command").and_then(|c| c.as_str()) != Some(cmd.as_str()));
            if list.len() != before {
                changed = true;
            }
            if list.is_empty() {
                continue;
            }
        }
        new_arr.push(entry);
    }

    if !changed {
        return Ok(false);
    }

    if new_arr.is_empty() {
        hooks_obj.remove(event);
    } else {
        hooks_obj.insert(event.to_string(), serde_json::Value::Array(new_arr));
    }

    write_settings(settings_path, &json)?;
    Ok(true)
}

fn read_settings(path: &Path) -> anyhow::Result<Option<serde_json::Value>> {
    if !path.exists() {
        return Ok(None);
    }
    let body = std::fs::read_to_string(path)?;
    if body.trim().is_empty() {
        return Ok(Some(serde_json::json!({})));
    }
    Ok(Some(serde_json::from_str(&body)?))
}

fn write_settings(path: &Path, json: &serde_json::Value) -> anyhow::Result<()> {
    let pretty = serde_json::to_string_pretty(json)?;
    std::fs::write(path, format!("{pretty}\n"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::PermissionsExt;
    use tempfile::TempDir;

    fn write_settings_file(path: &Path, body: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, body).unwrap();
    }

    #[test]
    fn install_writes_both_scripts_executable() {
        let tmp = TempDir::new().unwrap();
        let report = install_with(Some(tmp.path().to_path_buf()), None, false).unwrap();
        assert_eq!(report.installed.len(), 2);
        for p in &report.installed {
            let mode = std::fs::metadata(p).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o755, "{} should be 0755", p.display());
            let body = std::fs::read_to_string(p).unwrap();
            assert!(body.starts_with("#!/usr/bin/env bash"));
        }
    }

    #[test]
    fn reinstall_without_force_skips() {
        let tmp = TempDir::new().unwrap();
        install_with(Some(tmp.path().to_path_buf()), None, false).unwrap();
        let second = install_with(Some(tmp.path().to_path_buf()), None, false).unwrap();
        assert!(second.installed.is_empty());
        assert_eq!(second.skipped.len(), 2);
    }

    #[test]
    fn force_overwrites_existing() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().to_path_buf();
        install_with(Some(dir.clone()), None, false).unwrap();
        std::fs::write(dir.join(SESSION_START_HOOK_NAME), "junk").unwrap();

        let again = install_with(Some(dir.clone()), None, true).unwrap();
        assert_eq!(again.installed.len(), 2);
        let body = std::fs::read_to_string(dir.join(SESSION_START_HOOK_NAME)).unwrap();
        assert!(body.contains("session_start"));
    }

    #[test]
    fn uninstall_removes_scripts() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().to_path_buf();
        install_with(Some(dir.clone()), None, false).unwrap();
        let report = uninstall_with(Some(dir.clone()), None).unwrap();
        assert_eq!(report.removed_scripts.len(), 2);
        assert!(!dir.join(SESSION_START_HOOK_NAME).exists());
    }

    #[test]
    fn uninstall_idempotent() {
        let tmp = TempDir::new().unwrap();
        let dir = tmp.path().to_path_buf();
        let report = uninstall_with(Some(dir.clone()), None).unwrap();
        assert!(report.removed_scripts.is_empty());
    }

    #[test]
    fn install_registers_session_start_in_settings() {
        let tmp = TempDir::new().unwrap();
        let hooks_dir = tmp.path().join("hooks");
        let settings = tmp.path().join("settings.json");
        write_settings_file(&settings, "{}");

        let report =
            install_with(Some(hooks_dir.clone()), Some(settings.clone()), false).unwrap();
        assert!(report.settings_updated);

        let body = std::fs::read_to_string(&settings).unwrap();
        let json: serde_json::Value = serde_json::from_str(&body).unwrap();
        let ss = &json["hooks"]["SessionStart"];
        assert!(ss.is_array(), "SessionStart should be an array: {body}");
        let arr = ss.as_array().unwrap();
        assert_eq!(arr.len(), 1);
        let cmd = arr[0]["hooks"][0]["command"].as_str().unwrap();
        assert_eq!(cmd, hooks_dir.join(SESSION_START_HOOK_NAME).to_string_lossy());
        // Stop should NOT be registered — Claude Code fires it every turn.
        assert!(json["hooks"].get("Stop").is_none());
    }

    #[test]
    fn install_preserves_existing_hooks() {
        let tmp = TempDir::new().unwrap();
        let hooks_dir = tmp.path().join("hooks");
        let settings = tmp.path().join("settings.json");
        write_settings_file(
            &settings,
            r#"{
  "hooks": {
    "PreToolUse": [{"matcher": "Bash", "hooks": [{"command": "/other/rtk.sh", "type": "command"}]}],
    "SessionStart": [{"hooks": [{"command": "/other/existing.sh", "type": "command"}]}]
  }
}"#,
        );

        install_with(Some(hooks_dir.clone()), Some(settings.clone()), false).unwrap();

        let json: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&settings).unwrap()).unwrap();
        let pretool = json["hooks"]["PreToolUse"].as_array().unwrap();
        assert_eq!(pretool.len(), 1, "PreToolUse must be preserved");
        let ss = json["hooks"]["SessionStart"].as_array().unwrap();
        assert_eq!(ss.len(), 2, "SessionStart should have existing + ours");
    }

    #[test]
    fn install_is_idempotent_against_settings() {
        let tmp = TempDir::new().unwrap();
        let hooks_dir = tmp.path().join("hooks");
        let settings = tmp.path().join("settings.json");
        write_settings_file(&settings, "{}");

        install_with(Some(hooks_dir.clone()), Some(settings.clone()), false).unwrap();
        let r2 =
            install_with(Some(hooks_dir.clone()), Some(settings.clone()), false).unwrap();
        assert!(!r2.settings_updated, "second install must not duplicate");

        let json: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&settings).unwrap()).unwrap();
        let ss = json["hooks"]["SessionStart"].as_array().unwrap();
        assert_eq!(ss.len(), 1);
    }

    #[test]
    fn uninstall_cleans_settings_including_legacy_stop() {
        let tmp = TempDir::new().unwrap();
        let hooks_dir = tmp.path().join("hooks");
        let ss_path = hooks_dir.join(SESSION_START_HOOK_NAME);
        let stop_path = hooks_dir.join(STOP_HOOK_NAME);
        let settings = tmp.path().join("settings.json");
        // Simulate a legacy install that registered both SessionStart AND Stop.
        let body = format!(
            r#"{{
  "hooks": {{
    "SessionStart": [{{"hooks": [{{"command": "{ss}", "type": "command"}}]}}],
    "Stop": [{{"hooks": [{{"command": "{stop}", "type": "command"}}]}}]
  }}
}}"#,
            ss = ss_path.display(),
            stop = stop_path.display()
        );
        write_settings_file(&settings, &body);
        std::fs::create_dir_all(&hooks_dir).unwrap();
        std::fs::write(&ss_path, "x").unwrap();
        std::fs::write(&stop_path, "x").unwrap();

        let report = uninstall_with(Some(hooks_dir), Some(settings.clone())).unwrap();
        assert!(report.settings_updated);

        let json: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&settings).unwrap()).unwrap();
        assert!(json["hooks"].get("SessionStart").is_none());
        assert!(json["hooks"].get("Stop").is_none());
    }

    #[test]
    fn uninstall_preserves_unrelated_hooks() {
        let tmp = TempDir::new().unwrap();
        let hooks_dir = tmp.path().join("hooks");
        let ss_path = hooks_dir.join(SESSION_START_HOOK_NAME);
        let settings = tmp.path().join("settings.json");
        let body = format!(
            r#"{{
  "hooks": {{
    "SessionStart": [
      {{"hooks": [{{"command": "/other/keep.sh", "type": "command"}}]}},
      {{"hooks": [{{"command": "{ss}", "type": "command"}}]}}
    ]
  }}
}}"#,
            ss = ss_path.display()
        );
        write_settings_file(&settings, &body);

        uninstall_with(Some(hooks_dir), Some(settings.clone())).unwrap();
        let json: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(&settings).unwrap()).unwrap();
        let ss = json["hooks"]["SessionStart"].as_array().unwrap();
        assert_eq!(ss.len(), 1);
        assert_eq!(
            ss[0]["hooks"][0]["command"].as_str().unwrap(),
            "/other/keep.sh"
        );
    }
}
