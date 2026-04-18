#!/usr/bin/env bash
# build-release-binaries.sh — produce tp-mcp release artifacts for the server
# to expose at `/download/*` and `/install.sh`.
#
# Per plan 010 Unit 1:
#   - Native target is always built.
#   - Cross-builds to the other arch of the *same* OS are attempted if the
#     rustup target is installed; missing targets are skipped (not an error).
#   - Cross-OS builds (darwin <-> linux) are NOT attempted — run this script
#     on each OS separately and commit the downloads/ tarball into your
#     deployment pipeline.
#   - Output lives under `team-presence/downloads/` and is .gitignored
#     except for .gitkeep.
#   - manifest.json is rebuilt from every tp-mcp-* file the script finds
#     under downloads/ at the end, so two runs on different machines can
#     each contribute their artifact and the final manifest covers both.
#
# Usage:
#   bash scripts/build-release-binaries.sh
#   bash scripts/build-release-binaries.sh --native-only   # skip cross targets
#
# Exits non-zero only on genuine failure (cargo build fails, shasum unavailable).
# Missing cross-target toolchain → warn + skip + continue.

set -euo pipefail

NATIVE_ONLY=0
for arg in "$@"; do
    case "$arg" in
        --native-only) NATIVE_ONLY=1 ;;
        -h|--help)
            sed -n '1,30p' "$0"
            exit 0
            ;;
        *)
            echo "unknown arg: $arg" >&2
            exit 2
            ;;
    esac
done

# Resolve team-presence root (directory containing this script's parent).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOWNLOADS="$ROOT/downloads"
mkdir -p "$DOWNLOADS"

# ----- sha256 helper -----
if command -v sha256sum >/dev/null 2>&1; then
    sha256_bin="sha256sum"
elif command -v shasum >/dev/null 2>&1; then
    sha256_bin="shasum -a 256"
else
    echo "error: neither sha256sum nor shasum found" >&2
    exit 1
fi

compute_sha256() {
    # $1 path -> stdout: 64-char lowercase hex
    # shellcheck disable=SC2086
    $sha256_bin "$1" | awk '{print $1}'
}

# ----- detect native os/arch in our naming scheme -----
uname_s="$(uname -s)"
uname_m="$(uname -m)"

case "$uname_s" in
    Darwin) native_os="darwin" ;;
    Linux)  native_os="linux"  ;;
    *)
        echo "error: unsupported host OS: $uname_s" >&2
        exit 1
        ;;
esac

case "$uname_m" in
    arm64|aarch64) native_arch="aarch64" ;;
    x86_64|amd64)  native_arch="x86_64"  ;;
    *)
        echo "error: unsupported host arch: $uname_m" >&2
        exit 1
        ;;
esac

# Map (os, arch) -> rust target triple.
rust_triple() {
    local os="$1" arch="$2"
    case "$os-$arch" in
        darwin-aarch64) echo "aarch64-apple-darwin" ;;
        darwin-x86_64)  echo "x86_64-apple-darwin"  ;;
        linux-aarch64)  echo "aarch64-unknown-linux-gnu" ;;
        linux-x86_64)   echo "x86_64-unknown-linux-gnu"  ;;
        *) echo "" ;;
    esac
}

# Candidate artifacts we'd like to produce from this host.
# Same-OS cross-arch is attempted; cross-OS is never attempted.
candidates=()
candidates+=("$native_os:$native_arch:native")
if [ "$NATIVE_ONLY" -eq 0 ]; then
    if [ "$native_os" = "darwin" ]; then
        if [ "$native_arch" = "aarch64" ]; then
            candidates+=("darwin:x86_64:cross")
        else
            candidates+=("darwin:aarch64:cross")
        fi
    else
        if [ "$native_arch" = "aarch64" ]; then
            candidates+=("linux:x86_64:cross")
        else
            candidates+=("linux:aarch64:cross")
        fi
    fi
fi

# List installed rustup targets once (best-effort).
installed_targets=""
if command -v rustup >/dev/null 2>&1; then
    installed_targets="$(rustup target list --installed 2>/dev/null || true)"
fi

target_installed() {
    local triple="$1"
    [ -n "$installed_targets" ] || return 1
    printf '%s\n' "$installed_targets" | grep -Fxq "$triple"
}

build_artifact() {
    # $1 os  $2 arch  $3 kind (native|cross)
    local os="$1" arch="$2" kind="$3"
    local triple
    triple="$(rust_triple "$os" "$arch")"
    if [ -z "$triple" ]; then
        echo "skip: no rust triple mapping for $os-$arch" >&2
        return 0
    fi

    local extra_args=()
    if [ "$kind" = "cross" ]; then
        if ! target_installed "$triple"; then
            echo "skip: rustup target $triple not installed — cross $os-$arch omitted" >&2
            echo "  (run: rustup target add $triple)" >&2
            return 0
        fi
        extra_args=(--target "$triple")
    fi

    echo "==> building tp-mcp ($kind $os-$arch, triple=$triple)"
    # cargo build --release -p team-presence-tp-mcp [--target <triple>]
    # NOTE: `${arr[@]+"${arr[@]}"}` safely expands to nothing under `set -u`
    # when the array is empty (native builds have no extra flags).
    if ! cargo build --release -p team-presence-tp-mcp ${extra_args[@]+"${extra_args[@]}"}; then
        echo "error: cargo build failed for $os-$arch" >&2
        return 1
    fi

    local src
    if [ "$kind" = "native" ]; then
        src="$ROOT/target/release/tp-mcp"
    else
        src="$ROOT/target/$triple/release/tp-mcp"
    fi

    if [ ! -f "$src" ]; then
        echo "error: expected artifact not found: $src" >&2
        return 1
    fi

    local dst="$DOWNLOADS/tp-mcp-$os-$arch"
    # Atomic replace so a concurrent server read never sees a half-written file.
    cp -f "$src" "$dst.tmp"
    chmod +x "$dst.tmp"
    mv -f "$dst.tmp" "$dst"
    echo "    wrote $dst ($(wc -c <"$dst" | tr -d ' ') bytes)"
}

any_failed=0
for c in "${candidates[@]}"; do
    IFS=':' read -r os arch kind <<<"$c"
    if ! build_artifact "$os" "$arch" "$kind"; then
        any_failed=1
        # On genuine build failure we stop to avoid writing an inconsistent
        # manifest; do not regenerate manifest.json.
        break
    fi
done

if [ "$any_failed" -ne 0 ]; then
    echo "build failed; manifest NOT regenerated" >&2
    exit 1
fi

# ----- regenerate manifest.json from whatever artifacts currently exist -----
# Manifest version = workspace version + "+g" + short git SHA (if available).
workspace_version="$(grep -E '^version = "' Cargo.toml | head -n1 | sed -E 's/^version = "(.*)"/\1/')"
if [ -z "$workspace_version" ]; then
    workspace_version="0.0.0"
fi
if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --short=12 HEAD >/dev/null 2>&1; then
    git_sha="$(git -C "$ROOT" rev-parse --short=12 HEAD)"
    version="${workspace_version}+g${git_sha}"
else
    version="${workspace_version}"
fi

generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

manifest_tmp="$DOWNLOADS/manifest.json.tmp"
{
    printf '{\n'
    printf '  "version": "%s",\n' "$version"
    printf '  "generated_at": "%s",\n' "$generated_at"
    printf '  "artifacts": [\n'
    first=1
    # Iterate deterministically (sort) over every tp-mcp-* file in downloads/.
    while IFS= read -r -d '' f; do
        name="$(basename "$f")"
        # name form: tp-mcp-<os>-<arch>
        tail="${name#tp-mcp-}"
        art_os="${tail%%-*}"
        art_arch="${tail#*-}"
        case "$art_os" in darwin|linux) ;; *) continue ;; esac
        case "$art_arch" in aarch64|x86_64) ;; *) continue ;; esac
        size=$(wc -c <"$f" | tr -d ' ')
        sha=$(compute_sha256 "$f")
        if [ "$first" -eq 0 ]; then
            printf ',\n'
        fi
        first=0
        printf '    { "os": "%s", "arch": "%s", "path": "/download/%s", "sha256": "%s", "size": %s }' \
            "$art_os" "$art_arch" "$name" "$sha" "$size"
    done < <(find "$DOWNLOADS" -maxdepth 1 -type f -name 'tp-mcp-*' -print0 | sort -z)
    printf '\n  ]\n}\n'
} > "$manifest_tmp"
mv -f "$manifest_tmp" "$DOWNLOADS/manifest.json"

echo
echo "manifest: $DOWNLOADS/manifest.json"
echo "version:  $version"
echo "artifacts present:"
find "$DOWNLOADS" -maxdepth 1 -type f -name 'tp-mcp-*' -print | sort
