//! First-run consent prompt. Text is deliberate: no redaction in MVP, so the
//! user must opt in eyes-open. `login --yes` skips the prompt for scripted
//! installs that captured consent out-of-band.

use std::io::{BufRead, Write};

pub const CONSENT_PROMPT: &str = "\
team-presence will stream the visible text of your claude-code sessions to:
  {server}

Your teammates will see:
  * session start/stop, cwd, git branch (always)
  * user prompts + assistant replies (unless you run `team-presence mute`)
  * tool calls & tool results

Content has a 24-hour TTL on the server. There is no redaction in MVP — if you
paste a secret, teammates will see it until the 24h window rolls off. You can
`team-presence mute` before sensitive work and `team-presence unmute` after.

Continue? [y/N]: ";

pub fn prompt_interactive(
    server: &str,
    stdin: &mut impl BufRead,
    stdout: &mut impl Write,
) -> std::io::Result<bool> {
    write!(stdout, "{}", CONSENT_PROMPT.replace("{server}", server))?;
    stdout.flush()?;
    let mut line = String::new();
    stdin.read_line(&mut line)?;
    Ok(matches!(line.trim(), "y" | "Y" | "yes" | "YES"))
}

pub fn prompt_from_tty(server: &str) -> anyhow::Result<bool> {
    let stdin = std::io::stdin();
    let mut locked = stdin.lock();
    let stdout = std::io::stdout();
    let mut out = stdout.lock();
    Ok(prompt_interactive(server, &mut locked, &mut out)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn yes_variants_accepted() {
        for input in ["y\n", "Y\n", "yes\n", "YES\n", "  y  \n"] {
            let mut out = Vec::new();
            let accepted =
                prompt_interactive("https://x", &mut input.as_bytes(), &mut out).unwrap();
            assert!(accepted, "failed for {input:?}");
        }
    }

    #[test]
    fn anything_else_rejected() {
        for input in ["\n", "n\n", "no\n", "maybe\n", "Yes please\n"] {
            let mut out = Vec::new();
            let accepted =
                prompt_interactive("https://x", &mut input.as_bytes(), &mut out).unwrap();
            assert!(!accepted, "wrongly accepted {input:?}");
        }
    }

    #[test]
    fn server_url_interpolated_into_prompt() {
        let mut out = Vec::new();
        let _ = prompt_interactive("https://team.example", &mut "n\n".as_bytes(), &mut out);
        let shown = String::from_utf8(out).unwrap();
        assert!(shown.contains("https://team.example"));
    }
}
