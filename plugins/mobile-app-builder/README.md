# mobile-app-builder

[![Codex Plugin](https://img.shields.io/badge/Codex-plugin-111827)](https://developers.openai.com/codex/)

A Claude Code and Codex plugin that builds a real mobile app (iOS/Android)
end-to-end for someone who doesn't code — from a plain-language conversation
about the idea, to something running live on their own phone, to (optionally)
a real App Store / Play Store release. No terminal, no jargon, no technical
decisions the user didn't ask to make.

## What it handles automatically

- **Environment setup** — checks for Node, git, Homebrew, Xcode, Android
  Studio, etc., and installs what's missing (with a plain-language heads-up
  before anything large or irreversible).
- **The SDK-version trap** — new Expo SDKs regularly ship before Apple/Google
  finish reviewing the matching Expo Go app update. Scaffolding at the
  newest SDK during that window produces a project that can never open on
  the user's phone. This plugin checks Expo's own version API first and
  scaffolds at whatever SDK is actually installable right now.
- **Template cleanup** — strips the demo tabs/explore content every
  `create-expo-app` template ships, down to a clean single screen ready for
  the real app.
- **Live preview** — runs the dev server, builds a scannable connection
  code, and gets it in front of the user reliably (including in plain
  terminal sessions, where naively sending an image can silently never
  reach them).
- **Shipping** — EAS Build compiles in the cloud, so no local Xcode/Android
  Studio install is ever required, even for the final store binary. The one
  thing this plugin genuinely can't do for the user: sign up for a paid
  Apple/Google developer account — that's a human-only, identity-verified
  step.

## Requirements

- macOS, Linux, or Windows with Node.js (the plugin will help install it if
  missing on macOS/Linux).
- Either Claude Code or Codex.
- The official **[Expo](https://github.com/expo/expo)** companion plugin is
  recommended when available. Its skills add framework-specific guidance;
  the ordinary scaffold, preview, and validation flow also has a built-in
  fallback when those companion skills are absent.

## Installation — Claude Code

```
/plugin marketplace add <this-repo's-git-url-or-local-path>
/plugin install mobile-app-builder@mobile-app-builder-marketplace
```

## Installation — Codex

```bash
codex plugin marketplace add <this-repo's-git-url-or-local-path>
codex plugin add mobile-app-builder@app-maker
```

Start a new task after installation so the skill is loaded. These Codex files
are additive: `.claude-plugin/plugin.json` remains the Claude manifest, while
`.codex-plugin/plugin.json` and the repo's `.agents/plugins/marketplace.json`
provide Codex packaging around the same `skills/mobile-app-builder/` source.

## Usage

Just ask, in plain language: *"Build me an app that..."*. The skill
activates automatically. See `skills/mobile-app-builder/SKILL.md` and its
`references/` for the full phase-by-phase process this plugin follows —
every step in it exists because something broke in real testing and got
fixed; see `references/troubleshooting.md` for the specifics.

## License

MIT — see `LICENSE`.
