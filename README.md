# paperclip-adapter-kilo

Paperclip adapter for [Kilo CLI](https://github.com/kilocode/kilo) (`kilo_local`). Spawns `kilo run` as a local process with multi-provider model support.

## Status

Production-tested. Running in a 17-agent Paperclip deployment since April 2026. Feature-complete, at parity with `@paperclipai/adapter-opencode-local`.

## Why Kilo?

- Multi-provider model routing via a single CLI — supports any provider Kilo connects to
- Session persistence via SQLite — survives process restarts
- Same JSONL output format as OpenCode — Paperclip UI components are fully compatible
- Provider-agnostic — the adapter passes the model string to `kilo run -m`, works with any configured provider

## Prerequisites

- Kilo CLI v7+: `npm install -g @kilocode/cli`
- At least one auth provider configured: `kilo auth add`
- Paperclip server with `@paperclipai/adapter-utils`

Until Paperclip ships an external adapter plugin surface, inline patching is required. See DEPLOY.md.

## Configuration (adapterConfig)

**Required:**
- `model` — Provider/model format (e.g. `provider/model-name`)

**Optional:**
- `command` — Path to kilo CLI (default: `kilo`)
- `variant` — Reasoning effort: `minimal`, `low`, `medium`, `high`, `max`
- `cwd` — Working directory
- `timeoutSec` — Execution timeout (0 = none)
- `graceSec` — Grace period after SIGTERM (default: 20)
- `thinking` — Show thinking blocks
- `promptTemplate` — Handlebars template for heartbeat prompt
- `bootstrapPromptTemplate` — First-run-only prompt
- `instructionsFilePath` — Path to agent instructions (e.g. AGENTS.md)
- `extraArgs` — Additional CLI flags
- `env` — Extra environment variables

## Architecture

### Execute flow

1. Read config (model, command, variant, timeout)
2. Resolve workspace cwd from Paperclip context
3. Check session resume eligibility (matching cwd)
4. Read agent instructions file if configured
5. Render heartbeat prompt template
6. Build env with Paperclip vars + wake context + user overrides
7. Report invocation metadata
8. Spawn: `kilo run --format json --auto -m <model> [--session <id>] [--dir <cwd>]`
9. Stream JSONL events via `onLog` in real-time
10. Aggregate tokens/cost/summary from `proc.stdout`
11. Retry with fresh session if session is invalid
12. Return `AdapterExecutionResult`

### Wake context env vars

Matches `opencode_local`: `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`, `PAPERCLIP_APPROVAL_ID`, `PAPERCLIP_APPROVAL_STATUS`, `PAPERCLIP_LINKED_ISSUE_IDS`, `PAPERCLIP_WORKSPACE_CWD`, `PAPERCLIP_WORKSPACE_SOURCE`.

### Skills

Kilo auto-discovers Paperclip-managed skills from `~/.claude/skills/` and `~/.opencode/skills/`. No adapter-side injection needed.

### Sessions

Stored in Kilo's SQLite DB (`~/.local/share/kilo/kilo.db`). Adapter captures `sessionID`, returns as `sessionParams`, resumes via `--session` on next wake.

## Differences from opencode_local

| Feature          | opencode_local        | kilo_local                     |
|------------------|-----------------------|--------------------------------|
| Models           | Provider-specific     | Multi-provider routing         |
| Skills           | Adapter injects       | Auto-loaded from global dirs   |
| Session storage  | OpenCode internal     | SQLite DB                      |
| Model validation | ensureModelConfigured | Kilo handles internally        |

## Naming: kilo_local vs kilocode_local

This adapter uses `kilo_local` because the CLI binary is `kilo` (not `kilocode`), consistent with how `opencode_local` maps to the `opencode` binary. Happy to rename if the Paperclip team prefers `kilocode_local`.

## Known Issues

1. Kilo system prompt overhead (~15K+ chars) on every run — monitor on small-context models
2. Dual skill loading from `~/.claude/skills/` and `~/.opencode/skills/` causes duplicate warnings
3. No external plugin surface yet — requires inline patches (see DEPLOY.md)

## License

MIT — see [LICENSE](./LICENSE).

## Credits

Built by [Wu Consulting](https://jasonwu.ai) for the Paperclip + Kilo ecosystem.
