//! Install-script template + server-URL injection.
//!
//! The template lives in `install.sh.tpl` and is embedded at compile time.
//! The only substitution is `{{SERVER_BASE_URL}}` (the scheme+host the
//! client used to reach us), which becomes the default `TP_SERVER` the
//! installer will talk to.

const TEMPLATE: &str = include_str!("install.sh.tpl");

pub fn render(server_base_url: &str) -> String {
    TEMPLATE.replace("{{SERVER_BASE_URL}}", server_base_url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn template_has_shebang() {
        assert!(
            TEMPLATE.starts_with("#!/bin/sh"),
            "install.sh.tpl must start with POSIX sh shebang"
        );
    }

    #[test]
    fn template_has_single_placeholder() {
        assert_eq!(
            TEMPLATE.matches("{{SERVER_BASE_URL}}").count(),
            1,
            "expected exactly one SERVER_BASE_URL placeholder in the template"
        );
    }

    #[test]
    fn render_substitutes_server_url() {
        let out = render("https://example.com");
        assert!(out.contains("https://example.com"));
        assert!(!out.contains("{{SERVER_BASE_URL}}"));
    }
}
