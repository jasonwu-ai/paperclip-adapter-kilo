# paperclip-adapter-kilo

Paperclip adapter for [Kilo CLI](https://github.com/kilocode/kilo) (`kilo_local`). Spawns `kilo run` as a local process with multi-provider model support.

## Status

Production-tested in multi-agent Paperclip deployments. Feature-complete with full wake context, session persistence, real-time transcript streaming, and enriched run metadata.

## Why Kilo?

- Multi-provider model routing via a single CLI — supports any provider Kilo connects to
- Session persistence via SQLite — survives process restarts
- Same JSONL output format as OpenCode — Paperclip UI components are fully compatible
- Provider-agnostic — the adapter passes the model string to `kilo run -m`, works with any configured provider

## Prerequisites

- Kilo CLI v7+: `npm install -g @kilocode/cli`
- At least one auth provider configured: `kilo auth add`
- Paperclip server with `@paperclipai/adapter-utils`

Until Paperclip ships an external adapter plugin surface, inline patching is required. Run `./install.sh` to install automatically.

## Installation

```bash
git clone https://github.com/jasonwu-ai/paperclip-adapter-kilo.git
cd paperclip-adapter-kilo
./install.sh
sudo systemctl restart paperclip
```

The install script auto-detects your Paperclip installation, backs up the target files, and patches in the adapter with fallback model support. Safe to run multiple times (idempotent).

**After a Paperclip update** (patches get wiped):

```bash
./install.sh          # re-applies everything
```

**Other commands:**

```bash
./install.sh --check      # verify install status
./install.sh --force      # re-install over existing
./install.sh --uninstall  # restore from backup
```

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

Kilo discovers skills from its configured skill directories. If you also have Claude Code or OpenCode installed, Kilo will additionally scan `~/.claude/skills/` and `~/.opencode/skills/`, picking up any Paperclip-managed skills already symlinked there. No adapter-side injection is needed.

### Sessions

Stored in Kilo's SQLite DB (`~/.local/share/kilo/kilo.db`). The adapter captures `sessionID` from JSONL output, returns it as `sessionParams`, and resumes via `--session` on the next wake.

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

1. **System prompt overhead** — Kilo injects ~15K+ chars of its own system prompt on every run. Monitor context usage on smaller-context models.
2. **Duplicate skill warnings** — If you also run `claude_local` or `opencode_local` agents, Kilo may scan their skill directories and log duplicate warnings. This is cosmetic and does not affect execution.
3. **No external plugin surface yet** — Requires inline patches to register the adapter (run `./install.sh`). This will be resolved when Paperclip ships its plugin system ([#1973](https://github.com/paperclipai/paperclip/issues/1973)).

## License

MIT — see [LICENSE](./LICENSE).

## Credits

Built by [Wu Consulting](https://jasonwu.ai) for the Paperclip + Kilo ecosystem.
