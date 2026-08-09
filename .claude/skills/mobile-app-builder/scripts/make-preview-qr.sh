#!/usr/bin/env bash
# Prints a scannable ASCII QR code directly to stdout (the primary, always-
# works method) and also writes a PNG version (a bonus for GUI clients).
#
# WHY THIS EXISTS: `npx expo start` only draws its QR code / connection URL
# through an interactive terminal UI, gated on stdout being a real TTY.
# Claude Code always runs the dev server as a background process (it has to
# — it's long-running), which is never a TTY, so that QR/URL never appears
# in the captured log. Confirmed by testing: even after a phone successfully
# connected and the bundle loaded, the log contained no QR and no exp://
# URL — only "Waiting on http://localhost:PORT" and bundler progress.
#
# WHY ASCII-TO-STDOUT IS PRIMARY, NOT THE PNG: tested both ways. Delivering
# the PNG via SendUserFile silently reports success even in a plain terminal
# Claude Code session where there is no inline image viewer — the user never
# sees it and gets no error either. ASCII printed directly in the response
# works everywhere text works, terminal or GUI client alike. So: always
# print the ASCII block below in your reply. Only bother attaching the PNG
# as an extra when you know the session has a GUI (e.g. the user already
# confirmed images render for them).
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
# Example: make-preview-qr.sh 8081 /tmp/preview-qr.png

set -euo pipefail

PORT="${1:?Usage: make-preview-qr.sh <port> [output-png-path]}"
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

LAN_IP="$(get_lan_ip)"
if [ -z "$LAN_IP" ]; then
  echo "Could not determine this computer's LAN IP address automatically." >&2
  echo "Check network settings, or fall back to 'npx expo start --tunnel' and" >&2
  echo "grep its log output for an exp:// or exps:// URL instead." >&2
  exit 1
fi

CONNECT_URL="exp://${LAN_IP}:${PORT}"

# Cache the qrcode-terminal install so repeat calls (very common — one per
# preview during iteration) don't reinstall every time.
CACHE_DIR="${TMPDIR:-/tmp}/mobile-app-builder-qrcode-terminal"
if [ ! -d "$CACHE_DIR/node_modules/qrcode-terminal" ]; then
  mkdir -p "$CACHE_DIR"
  (cd "$CACHE_DIR" && npm install --silent --no-save qrcode-terminal >/dev/null 2>&1)
fi

echo "Connection URL: $CONNECT_URL"
echo ""
node -e "
require('$CACHE_DIR/node_modules/qrcode-terminal').generate('$CONNECT_URL', { small: true }, function (qr) {
  console.log(qr);
});
"

if [ -n "$OUTPUT" ]; then
  npx -y qrcode -o "$OUTPUT" -w 500 "$CONNECT_URL" >/dev/null 2>&1 || true
  if [ -f "$OUTPUT" ]; then
    echo ""
    echo "PNG also saved to: $OUTPUT (only send this via SendUserFile if you"
    echo "already know images render in this session — it fails silently"
    echo "with no error in plain-terminal sessions; the ASCII above is the"
    echo "one guaranteed to actually reach the user)."
  fi
fi
