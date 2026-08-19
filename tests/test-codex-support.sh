#!/usr/bin/env bash
# Static regression checks for additive Codex support. No Expo app or network
# connection is required.
set -uo pipefail

PASS=0; FAIL=0
ok()  { printf '  \033[32mPASS\033[0m  %s\n' "$1"; PASS=$((PASS+1)); }
bad() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAIL=$((FAIL+1)); }
grp() { printf '\n\033[1m%s\033[0m\n' "$1"; }

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
SKILL="$(cd "${1:-$ROOT/plugins/mobile-app-builder/skills/mobile-app-builder}" && pwd -P)"
PLUGIN="$(cd "$SKILL/../.." && pwd -P)"

grp "1. Both host packages remain available"
[ -f "$PLUGIN/.claude-plugin/plugin.json" ] \
  && ok "Claude Code manifest is still present" \
  || bad "Claude Code manifest was removed"
[ -f "$PLUGIN/.codex-plugin/plugin.json" ] \
  && ok "Codex manifest is present" \
  || bad "Codex manifest is missing"
[ -f "$ROOT/.claude-plugin/marketplace.json" ] \
  && ok "Claude Code marketplace is still present" \
  || bad "Claude Code marketplace was removed"
[ -f "$ROOT/.agents/plugins/marketplace.json" ] \
  && ok "Codex marketplace is present" \
  || bad "Codex marketplace is missing"

if node -e '
  const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  if (p.name !== "mobile-app-builder" || p.skills !== "./skills/" ||
      p.interface?.displayName !== "Mobile App Builder" ||
      !p.interface?.capabilities?.includes("Write")) process.exit(1);
' "$PLUGIN/.codex-plugin/plugin.json"; then
  ok "Codex manifest identifies the shared skill and UI"
else
  bad "Codex manifest fields are incomplete"
fi

if node -e '
  const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const p = m.plugins?.find(x => x.name === "mobile-app-builder");
  if (m.name !== "app-maker" || p?.source?.source !== "local" ||
      p?.source?.path !== "./plugins/mobile-app-builder" ||
      p?.policy?.installation !== "AVAILABLE") process.exit(1);
' "$ROOT/.agents/plugins/marketplace.json"; then
  ok "Codex marketplace points at the existing plugin"
else
  bad "Codex marketplace source or policy is wrong"
fi

grp "2. Codex skill metadata"
OPENAI_YAML="$SKILL/agents/openai.yaml"
[ -f "$OPENAI_YAML" ] && ok "agents/openai.yaml is present" \
  || bad "agents/openai.yaml is missing"
if ruby -e '
  require "yaml"
  d = YAML.safe_load(File.read(ARGV[0]), aliases: false)
  ok = d.dig("interface", "display_name") == "Mobile App Builder" &&
       d.dig("interface", "default_prompt").include?("$mobile-app-builder") &&
       d.dig("policy", "allow_implicit_invocation") == true
  exit(ok ? 0 : 1)
' "$OPENAI_YAML"; then
  ok "Codex metadata has a skill prompt and implicit activation"
else
  bad "Codex metadata is invalid or incomplete"
fi

if ruby -e '
  require "yaml"
  text = File.read(ARGV[0]); front = text.split(/^---\s*$/, 3)[1]
  d = YAML.safe_load(front, aliases: false)
  exit(d["name"] == "mobile-app-builder" && !d.key?("version") &&
       d.fetch("description", "").length <= 1024 ? 0 : 1)
' "$SKILL/SKILL.md"; then
  ok "SKILL.md frontmatter is Codex-compatible"
else
  bad "SKILL.md frontmatter has unsupported or oversized fields"
fi

grp "3. Shared workflow is host-aware"
grep -q 'supports both Claude Code and Codex' "$SKILL/SKILL.md" \
  && ok "skill explicitly preserves both hosts" \
  || bad "dual-host contract is missing"
grep -q 'MOBILE_APP_BUILDER_SKILL_DIR' "$SKILL/references/build-flow.md" \
  && ok "bundled scripts use a host-neutral root" \
  || bad "host-neutral skill root is missing"
grep -q 'CLAUDE_PLUGIN_ROOT' "$SKILL/references/build-flow.md" \
  && ok "Claude Code root remains supported" \
  || bad "Claude Code root fallback was removed"
if grep -R -q '\${CLAUDE_PLUGIN_ROOT}/scripts' \
    "$SKILL/SKILL.md" "$SKILL/references/build-flow/"; then
  bad "a runtime command still assumes the Claude-only root shape"
else
  ok "runtime commands no longer assume a Claude-only root shape"
fi
grep -q 'Codex desktop' "$SKILL/references/build-flow/phase-3-preview-expo-go.md" \
  && grep -q 'plain Claude Code' "$SKILL/references/build-flow/phase-3-preview-expo-go.md" \
  && ok "QR delivery covers Codex desktop and Claude terminals" \
  || bad "QR delivery does not cover both host UIs"
grep -q '`AGENTS.md`' "$SKILL/references/build-flow/phase-2-scaffold.md" \
  && grep -q '`CLAUDE.md`' "$SKILL/references/build-flow/phase-2-scaffold.md" \
  && ok "fresh project instructions preserve Codex and Claude entry points" \
  || bad "fresh project instructions omit one host's entry point"

grp "4. Installation docs"
if grep -q 'codex plugin marketplace add' "$ROOT/README.md" &&
   grep -q '/plugin marketplace add' "$ROOT/README.md"; then
  ok "README documents Codex and Claude Code installation"
else
  bad "README is missing one host's installation path"
fi

grp "RESULT"
printf '  %d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
