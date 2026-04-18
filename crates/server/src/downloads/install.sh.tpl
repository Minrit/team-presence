#!/bin/sh
# tp-mcp installer — plan 010 Unit 3.
#
# Drops the tp-mcp binary into ${TP_INSTALL_DIR:-$HOME/.local/bin} after
# validating its sha256 against ${TP_SERVER}/download/manifest.json.
#
# POSIX sh only — no bashisms. Overridable via environment:
#   TP_SERVER        where to pull manifest + binary from (default: baked in)
#   TP_INSTALL_DIR   where to drop tp-mcp (default: $HOME/.local/bin)
#   TP_SKIP_SHA      set=1 to skip sha256 verification (debug only)

set -eu

TP_SERVER="${TP_SERVER:-{{SERVER_BASE_URL}}}"
TP_INSTALL_DIR="${TP_INSTALL_DIR:-$HOME/.local/bin}"
TP_SKIP_SHA="${TP_SKIP_SHA:-0}"

say()  { printf '%s\n' "$*"; }
warn() { printf 'tp-mcp-install: %s\n' "$*" >&2; }
die()  { warn "$*"; exit 1; }

# ----- detect os/arch in our naming scheme (darwin|linux, aarch64|x86_64)
uname_s=$(uname -s 2>/dev/null || echo unknown)
uname_m=$(uname -m 2>/dev/null || echo unknown)

case "$uname_s" in
    Darwin) os=darwin ;;
    Linux)  os=linux  ;;
    *) die "unsupported OS '$uname_s' — tp-mcp publishes Linux/macOS builds only" ;;
esac

case "$uname_m" in
    arm64|aarch64) arch=aarch64 ;;
    x86_64|amd64)  arch=x86_64  ;;
    *) die "unsupported CPU '$uname_m' — supported: arm64/aarch64, x86_64/amd64" ;;
esac

target="tp-mcp-$os-$arch"
say "==> detected platform: $os $arch  (artifact: $target)"

# ----- require curl
command -v curl >/dev/null 2>&1 || die "curl is required but not on PATH"

# ----- pick an available sha256 tool
sha_cmd=""
if command -v sha256sum >/dev/null 2>&1; then
    sha_cmd="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
    sha_cmd="shasum -a 256"
fi
if [ -z "$sha_cmd" ] && [ "$TP_SKIP_SHA" != "1" ]; then
    die "neither sha256sum nor shasum found; install one or set TP_SKIP_SHA=1 (not recommended)"
fi

# ----- fetch manifest
manifest_url="$TP_SERVER/download/manifest.json"
say "==> fetching $manifest_url"
manifest=$(curl -fsSL "$manifest_url") \
    || die "failed to fetch manifest from $manifest_url (check TP_SERVER and network)"

# Find the artifact line for our (os, arch). Manifest format is line-per-artifact:
#   { "os": "darwin", "arch": "aarch64", "path": "/download/tp-mcp-darwin-aarch64", "sha256": "HEX", "size": N }
artifact_line=$(printf '%s\n' "$manifest" | grep "\"os\": \"$os\", \"arch\": \"$arch\"" || true)
if [ -z "$artifact_line" ]; then
    die "server manifest has no artifact for $os/$arch — available artifacts:
$(printf '%s\n' "$manifest" | grep -E '"os":|"arch":' || true)"
fi

# Extract sha256 and path. Manifest is machine-generated so the sed is safe.
expected_sha=$(printf '%s\n' "$artifact_line" | sed 's/.*"sha256": "\([a-f0-9]*\)".*/\1/')
artifact_path=$(printf '%s\n' "$artifact_line" | sed 's/.*"path": "\([^"]*\)".*/\1/')

if [ -z "$expected_sha" ] || [ -z "$artifact_path" ]; then
    die "could not parse manifest entry (sha256='$expected_sha' path='$artifact_path')"
fi

# ----- prepare install dir
mkdir -p "$TP_INSTALL_DIR" \
    || die "cannot create install dir $TP_INSTALL_DIR — choose another via TP_INSTALL_DIR=..."
if [ ! -w "$TP_INSTALL_DIR" ]; then
    die "install dir $TP_INSTALL_DIR is not writable"
fi

# ----- download
download_url="$TP_SERVER$artifact_path"
# Use $$ to avoid clobbering a concurrent install from the same user.
tmp="$TP_INSTALL_DIR/tp-mcp.download.$$"
trap 'rm -f "$tmp"' EXIT INT TERM HUP
say "==> downloading $download_url"
curl -fsSL "$download_url" -o "$tmp" \
    || die "download failed from $download_url"

# ----- verify sha256
if [ "$TP_SKIP_SHA" = "1" ]; then
    warn "TP_SKIP_SHA=1 — skipping checksum verification"
else
    got_sha=$($sha_cmd "$tmp" | awk '{print $1}')
    if [ "$got_sha" != "$expected_sha" ]; then
        die "checksum mismatch for $target
  expected: $expected_sha
  got:      $got_sha
this can mean the manifest is stale, or the download was tampered with."
    fi
    say "==> checksum ok (sha256=$expected_sha)"
fi

# ----- atomic install
chmod +x "$tmp"
mv -f "$tmp" "$TP_INSTALL_DIR/tp-mcp"
trap - EXIT INT TERM HUP

installed="$TP_INSTALL_DIR/tp-mcp"
say "==> installed $installed"

# ----- PATH hint
case ":$PATH:" in
    *":$TP_INSTALL_DIR:"*) ;;
    *)
        say ""
        say "note: $TP_INSTALL_DIR is not on your PATH."
        say "      add this to your shell rc (once):"
        say "        export PATH=\"$TP_INSTALL_DIR:\$PATH\""
        ;;
esac

say ""
say "next steps:"
say "  1. open Claude Code (or any MCP client)"
say "  2. run: /tp-connect-machine"
say "  (or wire tp-mcp into .mcp.json manually — see $TP_SERVER/agent-setup.md §3)"
