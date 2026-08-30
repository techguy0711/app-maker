#!/usr/bin/env bash
# Prints a scannable ASCII QR code to stdout and also writes a PNG version.
# The caller presents whichever form its current host renders reliably.
#
# WHY THIS EXISTS: `npx expo start` only draws its QR code / connection URL
# through an interactive terminal UI, gated on stdout being a real TTY.
# Agent tool sessions run the dev server as a background process (it has to
# — it's long-running), which is never a TTY, so that QR/URL never appears
# in the captured log. Confirmed by testing: even after a phone successfully
# connected and the bundle loaded, the log contained no QR and no exp://
# URL — only "Waiting on http://localhost:PORT" and bundler progress.
#
# WHY BOTH FORMS EXIST: tested both ways. Delivering the PNG via SendUserFile
# silently reports success in a plain Claude Code terminal where there is no
# inline image viewer. ASCII is reliable there. Codex desktop does render
# local images inline, so its clearest presentation is the PNG referenced by
# absolute path. The caller must choose the form its host actually displays.
#
# WHY NOT THE qrcode-terminal / qrcode CLIs DIRECTLY: both force ANSI color
# escape codes when invoked as a CLI (`qrcode-terminal "text"` or
# `qrcode --small "text"`), which come out as unreadable raw escape-code
# soup once relayed through chat. Calling qrcode-terminal's library API
# directly (`.generate(text, {small:true}, cb)`) instead of its CLI avoids
# this — confirmed: it prints plain unicode block characters only. That's
# what this script does.
#
# Usage: make-preview-qr.sh <port> [output-png-path]
#        make-preview-qr.sh <full-url> [output-png-path]
# Example: make-preview-qr.sh 8081 /tmp/preview-qr.png
# Example: make-preview-qr.sh "https://u.expo.dev/abc123?channel-name=preview" /tmp/preview-qr.png
#
# The second form (a full URL as the first arg, detected by "://") skips LAN
# IP lookup entirely and QRs the URL as-is — for the EAS Update fallback
# (see build-flow/phase-3-preview-expo-go.md, "When the dev server can't reach the phone at
# all"), where the connect URL comes from Expo's cloud, not this machine's
# network.

set -euo pipefail

ARG1="${1:?Usage: make-preview-qr.sh <port|full-url> [output-png-path]}"
OUTPUT="${2:-}"

get_lan_ip() {
  local ip=""
  if command -v ipconfig >/dev/null 2>&1; then
    for iface in en0 en1 en2; do
      ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
      [ -n "$ip" ] && break
    done
  fi
  if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
    ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") print $(i+1)}')"
  fi
  if [ -z "$ip" ] && command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [ -z "$ip" ]; then
    ip="$(ifconfig 2>/dev/null | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1)"
  fi
  echo "$ip"
}

case "$ARG1" in
  *://*)
    CONNECT_URL="$ARG1"
    ;;
  *)
    PORT="$ARG1"
    LAN_IP="$(get_lan_ip)"
    if [ -z "$LAN_IP" ]; then
      echo "Could not determine this computer's LAN IP address automatically." >&2
      echo "Check network settings, or fall back to 'npx expo start --tunnel' and" >&2
      echo "grep its log output for an exp:// or exps:// URL instead. If this" >&2
      echo "session isn't running on the user's own machine (for example," >&2
      echo "a mobile, remote, or cloud session), neither LAN nor tunnel will" >&2
      echo "work at all — see build-flow/phase-3-preview-expo-go.md's EAS Update fallback." >&2
      exit 1
    fi
    CONNECT_URL="exp://${LAN_IP}:${PORT}"
    ;;
esac

# Cache the renderers so repeat calls (very common — one per preview during
# iteration) don't reinstall every time. Check package manifests rather than
# only directories: an interrupted npm reify can leave the directory tree
# behind with none of the package files, and a normal install then reports
# success without repairing it. --force heals that partial cache instead of
# handing Node a path that cannot be required.
CACHE_DIR="${TMPDIR:-/tmp}/app-maker-qrcode-terminal"
TERMINAL_MODULE="$CACHE_DIR/node_modules/qrcode-terminal"
PNG_MODULE="$CACHE_DIR/node_modules/qrcode"
NEEDS_INSTALL=0
[ -f "$TERMINAL_MODULE/package.json" ] || NEEDS_INSTALL=1
if [ -n "$OUTPUT" ] && [ ! -f "$PNG_MODULE/package.json" ]; then
  NEEDS_INSTALL=1
fi

if [ "$NEEDS_INSTALL" -eq 1 ]; then
  mkdir -p "$CACHE_DIR"
  if [ -n "$OUTPUT" ]; then
    (cd "$CACHE_DIR" && npm install --silent --no-save --force qrcode-terminal qrcode >/dev/null 2>&1)
  else
    (cd "$CACHE_DIR" && npm install --silent --no-save --force qrcode-terminal >/dev/null 2>&1)
  fi
fi

echo "Connection URL: $CONNECT_URL"
echo ""
node -e '
require(process.argv[1]).generate(process.argv[2], { small: true }, function (qr) {
  console.log(qr);
});
' "$TERMINAL_MODULE" "$CONNECT_URL"

if [ -n "$OUTPUT" ]; then
  "$CACHE_DIR/node_modules/.bin/qrcode" -o "$OUTPUT" -w 500 "$CONNECT_URL" >/dev/null 2>&1
  echo ""
  echo "PNG also saved to: $OUTPUT"
  echo "Codex desktop: render this absolute path inline. Terminal clients:"
  echo "use the ASCII QR above. Include the connection URL in either case."
fi
