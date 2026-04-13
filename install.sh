#!/usr/bin/env bash
# install-kilo-adapter.sh — Install kilo_local adapter into Paperclip
#
# Part of: https://github.com/jasonwu-ai/paperclip-adapter-kilo
# Covers: Patches #7 (adapter), #8 (enum), #9 (UI bundle), #10 (fallback), #10b (auto-infer), #11 (force-kill), env display
#
# Usage:
#   ./install-kilo-adapter.sh              # Auto-detect Paperclip, install
#   ./install-kilo-adapter.sh --force      # Re-install over existing
#   ./install-kilo-adapter.sh --check      # Check status only
#   ./install-kilo-adapter.sh --uninstall  # Restore from backup
#   ./install-kilo-adapter.sh /path/to/@paperclipai/server  # Explicit path
#
# What it does:
#   1. Locates Paperclip's compiled files in the npx cache
#   2. Backs up registry.js and constants.js
#   3. Adds kilo_local to the adapter type enum (constants.js)
#   4. Adds import aliases for adapter-utils (top of registry.js)
#   5. Inlines the kilo_local adapter code (registry.js)
#      - Core adapter: execute, testEnvironment, sessionCodec, listModels
#      - Fallback model support with timeout-based failover
#      - Auto-infer: coding plan → gateway prefix mapping
#      - Environment variable display in UI
#   6. Registers kiloLocalAdapter in the adaptersByType map
#   7. Verifies the install
#
# Safe to run multiple times (idempotent).
# Re-run after any Paperclip update (npm/npx pulls new compiled files).
#
# Prerequisites:
#   - Kilo CLI installed: npm install -g @kilocode/cli
#   - At least one Kilo provider authenticated: kilo auth login
#   - Paperclip running or previously run via npx

set -euo pipefail

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${GREEN}[kilo-adapter]${NC} $*"; }
warn()  { echo -e "${YELLOW}[kilo-adapter]${NC} $*"; }
error() { echo -e "${RED}[kilo-adapter]${NC} $*" >&2; }
step()  { echo -e "${CYAN}[kilo-adapter]${NC} $*"; }

# --- Parse args ---
FORCE=false
CHECK_ONLY=false
UNINSTALL=false
EXPLICIT_PATH=""

for arg in "$@"; do
  case "$arg" in
    --force)     FORCE=true ;;
    --check)     CHECK_ONLY=true ;;
    --uninstall) UNINSTALL=true ;;
    -*)          error "Unknown flag: $arg"; exit 1 ;;
    *)           EXPLICIT_PATH="$arg" ;;
  esac
done

# --- Locate Paperclip ---
find_paperclip_dir() {
  # 1. Explicit path
  if [[ -n "$EXPLICIT_PATH" && -d "$EXPLICIT_PATH" ]]; then
    echo "$EXPLICIT_PATH"
    return 0
  fi

  # 2. Running process (most reliable — finds the active instance)
  # Walk process tree: npm exec → sh -c → node (which has node_modules in cmdline)
  local pid
  pid=$(pgrep -f paperclipai 2>/dev/null | head -1) || true
  if [[ -n "$pid" ]]; then
    # Check pid and all descendants for node_modules path
    local all_pids="$pid"
    local child_pids
    child_pids=$(pgrep -P "$pid" 2>/dev/null) || true
    for cpid in $child_pids; do
      all_pids="$all_pids $cpid"
      local grandchild_pids
      grandchild_pids=$(pgrep -P "$cpid" 2>/dev/null) || true
      all_pids="$all_pids $grandchild_pids"
    done
    for check_pid in $all_pids; do
      local cmdline
      cmdline=$(cat "/proc/$check_pid/cmdline" 2>/dev/null | tr '\0' '\n' | grep "node_modules" | head -1) || true
      if [[ -n "$cmdline" ]]; then
        local running_path
        running_path=$(echo "$cmdline" | sed 's|/node_modules/.*|/node_modules/@paperclipai/server|')
        if [[ -d "$running_path" ]]; then
          echo "$running_path"
          return 0
        fi
      fi
    done
  fi

  # 3. Scan npx cache (fallback if Paperclip not running)
  local npx_base="$HOME/.npm/_npx"
  if [[ ! -d "$npx_base" ]]; then
    error "npx cache not found at $npx_base"
    return 1
  fi

  local found=""
  for dir in "$npx_base"/*/; do
    if [[ -d "${dir}node_modules/@paperclipai/server" ]]; then
      found="${dir}node_modules/@paperclipai/server"
      # Don't break — prefer the most recently modified
    fi
  done

  if [[ -z "$found" ]]; then
    error "Could not find @paperclipai/server in npx cache"
    error "Has Paperclip been run via npx on this system?"
    return 1
  fi

  warn "Paperclip not running — using cache: $found"
  echo "$found"
}

PAPERCLIP_DIR=$(find_paperclip_dir)
REGISTRY_JS="$PAPERCLIP_DIR/dist/adapters/registry.js"
CONSTANTS_JS="$(dirname "$PAPERCLIP_DIR")/shared/dist/constants.js"

for f in "$REGISTRY_JS" "$CONSTANTS_JS"; do
  if [[ ! -f "$f" ]]; then
    error "Expected file not found: $f"
    exit 1
  fi
done

info "Paperclip: $PAPERCLIP_DIR"

# --- Status check ---
check_status() {
  local enum_ok=false reg_ok=false fb_ok=false imports_ok=false

  grep -q 'kilo_local' "$CONSTANTS_JS" 2>/dev/null && enum_ok=true
  grep -q "=== KILO LOCAL ADAPTER ===" "$REGISTRY_JS" 2>/dev/null && reg_ok=true
  grep -q "_kiloInferFallback" "$REGISTRY_JS" 2>/dev/null && fb_ok=true
  grep -q "renderTemplate as _kRt" "$REGISTRY_JS" 2>/dev/null && imports_ok=true

  echo ""
  $enum_ok    && info "✓ constants.js: kilo_local in enum"    || warn "✗ constants.js: kilo_local NOT in enum"
  $imports_ok && info "✓ registry.js:  import aliases present" || warn "✗ registry.js:  import aliases missing"
  $reg_ok     && info "✓ registry.js:  adapter code present"   || warn "✗ registry.js:  adapter code missing"
  $fb_ok      && info "✓ registry.js:  fallback auto-infer"    || warn "✗ registry.js:  fallback auto-infer missing"

  # UI bundle
  local ui_bundle ui_ok=false
  ui_bundle=$(find "$PAPERCLIP_DIR/ui-dist/assets/" -name 'index-*.js' -exec grep -l 'claude_local' {} \; 2>/dev/null | head -1)
  if [[ -n "$ui_bundle" ]]; then
    npx tsc -p "$(dirname "$0")" 2>/dev/null; node "$(dirname "$0")/dist/scripts/patch-ui-bundle.js" --check "$ui_bundle" > /dev/null 2>&1 && ui_ok=true
    $ui_ok && info "✓ ui-dist:       kilo_local UI support" || warn "✗ ui-dist:       kilo_local UI support missing"
  else
    warn "✗ ui-dist:       bundle file not found"
  fi

  if $enum_ok && $reg_ok && $fb_ok && $imports_ok && $ui_ok; then
    info "Status: INSTALLED"
    return 0
  else
    warn "Status: NOT INSTALLED (or partial)"
    return 1
  fi
}

if $CHECK_ONLY; then
  check_status
  exit $?
fi

# --- Uninstall ---
if $UNINSTALL; then
  info "Uninstalling kilo adapter..."
  for f in "$REGISTRY_JS" "$CONSTANTS_JS"; do
    local_bak="${f}.bak.pre-kilo"
    if [[ -f "$local_bak" ]]; then
      cp "$local_bak" "$f"
      info "Restored: $(basename "$f") from pre-kilo backup"
    else
      warn "No backup found: $(basename "$local_bak")"
    fi
  done
  info "Uninstall complete. Restart Paperclip: sudo systemctl restart paperclip"
  exit 0
fi

# --- Idempotent check ---
if grep -q "=== KILO LOCAL ADAPTER ===" "$REGISTRY_JS" 2>/dev/null && \
   grep -q 'kilo_local' "$CONSTANTS_JS" 2>/dev/null; then
  if ! $FORCE; then
    info "Kilo adapter already installed."
    check_status
    info "Use --force to re-install, --check to verify."
    exit 0
  fi
  warn "Force mode — re-installing..."
fi

# --- Backups ---
backup_file() {
  local file="$1"
  local backup="${file}.bak.pre-kilo"
  if [[ ! -f "$backup" ]]; then
    cp "$file" "$backup"
    info "Backed up: $(basename "$file") → $(basename "$backup")"
  else
    local ts_backup="${file}.bak.kilo-$(date +%Y%m%d-%H%M%S)"
    cp "$file" "$ts_backup"
    info "Timestamped backup: $(basename "$ts_backup")"
  fi
}

backup_file "$REGISTRY_JS"
backup_file "$CONSTANTS_JS"

# ===================================================================
# PATCH #8: constants.js — add kilo_local to adapter type enum
# ===================================================================
step "Step 1/5: Patching constants.js (adapter type enum)..."

if grep -q 'kilo_local' "$CONSTANTS_JS"; then
  info "  kilo_local already in enum, skipping"
else
  # Try double-quoted style first (Paperclip default), fall back to single
  if grep -q '"opencode_local"' "$CONSTANTS_JS"; then
    sed -i 's/"opencode_local"/"opencode_local", "kilo_local"/g' "$CONSTANTS_JS"
  elif grep -q "'opencode_local'" "$CONSTANTS_JS"; then
    sed -i "s/'opencode_local'/'opencode_local', 'kilo_local'/g" "$CONSTANTS_JS"
  fi

  if grep -q 'kilo_local' "$CONSTANTS_JS"; then
    info "  Added kilo_local to adapter type enum"
  else
    error "  Failed — pattern 'opencode_local' not found in constants.js"
    error "  Manual fix: add \"kilo_local\" to the adapterType z.enum array"
    exit 1
  fi
fi

# ===================================================================
# IMPORTS: registry.js — add adapter-utils aliases
# ===================================================================
step "Step 2/5: Adding import aliases to registry.js..."

if grep -q "renderTemplate as _kRt" "$REGISTRY_JS"; then
  info "  Import aliases already present, skipping"
else
  # Insert imports after line 1
  sed -i '1a\import { renderTemplate as _kRt, joinPromptSections as _kJp, buildPaperclipEnv as _kBpe, asString as _kAs, parseObject as _kPo, ensureAbsoluteDirectory as _kEad, runChildProcess as _kRcp, ensurePathInEnv as _kEpi } from "@paperclipai/adapter-utils/server-utils";\nimport { readFileSync as _kRfs } from "fs";\nimport { isAbsolute as _kIa } from "path";\nimport { execSync as _kExs } from "child_process";' "$REGISTRY_JS"

  if grep -q "renderTemplate as _kRt" "$REGISTRY_JS"; then
    info "  Import aliases added"
  else
    error "  Failed to add imports"
    exit 1
  fi
fi

# ===================================================================
# PATCHES #7, #10, #10b, env: registry.js — adapter code block
# ===================================================================
step "Step 3/5: Injecting adapter code into registry.js..."

# Remove previous adapter block if --force
if grep -q "=== KILO LOCAL ADAPTER ===" "$REGISTRY_JS"; then
  if $FORCE; then
    info "  Removing previous adapter code..."
    sed -i '/\/\/ === KILO LOCAL ADAPTER ===/,/\/\/ === END KILO ===/d' "$REGISTRY_JS"
    sed -i '/^const kiloLocalAdapter = /d' "$REGISTRY_JS"
    sed -i '/^    kiloLocalAdapter,$/d' "$REGISTRY_JS"
    sed -i '/^async function _kiloListSkills/d' "$REGISTRY_JS"
    sed -i '/^async function _kiloSyncSkills/d' "$REGISTRY_JS"
  fi
fi

if grep -q "=== KILO LOCAL ADAPTER ===" "$REGISTRY_JS"; then
  info "  Adapter code already present, skipping"
else
  # Find injection point: before adaptersByType
  INJECT_LINE=$(grep -n "^const adaptersByType = " "$REGISTRY_JS" | head -1 | cut -d: -f1)

  if [[ -z "$INJECT_LINE" ]]; then
    error "  Could not find 'const adaptersByType' in registry.js"
    error "  Paperclip version may be incompatible"
    exit 1
  fi

  info "  Injecting at line $INJECT_LINE (before adaptersByType)..."

  ADAPTER_CODE=$(mktemp)
  cat > "$ADAPTER_CODE" << 'ADAPTER_EOF'

// === KILO LOCAL ADAPTER ===
// Source: https://github.com/jasonwu-ai/paperclip-adapter-kilo
// Installed by: install-kilo-adapter.sh
// Patches: #7 (adapter), #10 (fallback), #10b (auto-infer), #11 (force-kill), env display
function _kParse(line) { try { return JSON.parse(line.trim()); } catch { return null; } }

function _kiloInferFallback(m) {
  if (!m) return "";
  if (m.startsWith("zai-coding-plan/")) return "kilo/z-ai/" + m.slice(16);
  if (m.startsWith("minimax-coding-plan/")) return "kilo/minimax/" + m.slice(20).toLowerCase();
  return "";
}
async function _kiloExecute(ctx) {
  const { runId, agent, runtime, config: _cfg, context, onLog, onMeta, onSpawn, authToken } = ctx;
  const config = _cfg || {};
  const command = config.command || "/usr/bin/kilo";
  const model = _kAs(config.model, "").trim();
  const variant = _kAs(config.variant, "").trim();
  const timeoutSec = config.timeoutSec || 0;
  const graceSec = config.graceSec || 15;
  const _cfgFb = _kAs(config.fallbackModel, "").trim();
  const fallbackModel = _cfgFb || _kiloInferFallback(model);
  const fallbackTimeoutSec = config.fallbackTimeoutSec || 60;

  const wsCtx = _kPo(context.paperclipWorkspace);
  const wsCwd = _kAs(wsCtx.cwd, "");
  const cwd = wsCwd || _kAs(config.cwd, "") || process.cwd();
  await _kEad(cwd, { createIfMissing: true });

  let sessionId = runtime.sessionParams && runtime.sessionParams.sessionId && runtime.sessionParams.cwd === cwd ? runtime.sessionParams.sessionId : null;

  const promptTpl = _kAs(config.promptTemplate, "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.");
  const bsTpl = _kAs(config.bootstrapPromptTemplate, "");
  const td = { agentId: agent.id, companyId: agent.companyId, runId, company: { id: agent.companyId }, agent, run: { id: runId, source: "on_demand" }, context };
  const rendered = _kRt(promptTpl, td);
  const bsRendered = (!sessionId && bsTpl.trim().length > 0) ? _kRt(bsTpl, td).trim() : "";
  const handoff = _kAs(context.paperclipSessionHandoffMarkdown, "").trim();
  let instrPrefix = "";
  const instrPath = _kAs(config.instructionsFilePath, "");
  if (instrPath) { try { instrPrefix = _kRfs(instrPath, "utf-8"); } catch(e) { console.log("[kilo] instr read fail:", e.message); } }
  const prompt = _kJp([instrPrefix, bsRendered, handoff, rendered]);

  const args = ["run", "--format", "json", "--auto"];
  if (model) args.push("-m", model);
  if (variant) args.push("--variant", variant);
  if (config.thinking) args.push("--thinking");
  args.push("--dir", cwd);
  if (sessionId) args.push("--session", sessionId);
  if (config.extraArgs) args.push(...config.extraArgs);

  const env = { ...process.env, ..._kBpe(agent) };
  env.PAPERCLIP_RUN_ID = runId;
  const _kSt = (v) => typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  const _wTask = _kSt(context.taskId) || _kSt(context.issueId);
  const _wReason = _kSt(context.wakeReason);
  const _wComment = _kSt(context.wakeCommentId) || _kSt(context.commentId);
  const _wApprId = _kSt(context.approvalId);
  const _wApprSt = _kSt(context.approvalStatus);
  const _wLinked = Array.isArray(context.issueIds) ? context.issueIds.filter(v => typeof v === "string" && v.trim().length > 0) : [];
  if (_wTask) env.PAPERCLIP_TASK_ID = _wTask;
  if (_wReason) env.PAPERCLIP_WAKE_REASON = _wReason;
  if (_wComment) env.PAPERCLIP_WAKE_COMMENT_ID = _wComment;
  if (_wApprId) env.PAPERCLIP_APPROVAL_ID = _wApprId;
  if (_wApprSt) env.PAPERCLIP_APPROVAL_STATUS = _wApprSt;
  if (_wLinked.length > 0) env.PAPERCLIP_LINKED_ISSUE_IDS = _wLinked.join(",");
  if (wsCwd) env.PAPERCLIP_WORKSPACE_CWD = wsCwd;
  const _wSrc = _kSt(wsCtx.source); if (_wSrc) env.PAPERCLIP_WORKSPACE_SOURCE = _wSrc;
  const _wWid = _kSt(wsCtx.workspaceId); if (_wWid) env.PAPERCLIP_WORKSPACE_ID = _wWid;
  const _wRepo = _kSt(wsCtx.repoUrl); if (_wRepo) env.PAPERCLIP_WORKSPACE_REPO_URL = _wRepo;
  const _wRef = _kSt(wsCtx.repoRef); if (_wRef) env.PAPERCLIP_WORKSPACE_REPO_REF = _wRef;
  const _wAh = _kSt(wsCtx.agentHome); if (_wAh) env.AGENT_HOME = _wAh;
  const _wHints = Array.isArray(context.paperclipWorkspaces) ? context.paperclipWorkspaces.filter(v => typeof v === "object" && v !== null) : [];
  if (_wHints.length > 0) env.PAPERCLIP_WORKSPACES_JSON = JSON.stringify(_wHints);
  if (authToken) env.PAPERCLIP_API_KEY = authToken;
  if (config.env) { for (const [k,v] of Object.entries(config.env)) { env[k] = typeof v === "string" ? v : (v && v.value) || ""; } }
  _kEpi(env);

  if (onMeta) { await onMeta({ adapterType: "kilo_local", command, cwd, commandArgs: [...args, "<stdin prompt " + prompt.length + " chars>"], env: Object.fromEntries(Object.entries(env).filter(([k]) => k.startsWith("PAPERCLIP_") || k === "AGENT_HOME" || k === "HOME")), prompt, promptMetrics: { promptChars: prompt.length }, context }); }

  // -- Fallback-aware execution (#10) --
  const _kiloParseOutput = (stdout) => {
    let sid = null, usage = { inputTokens: 0, outputTokens: 0 }, costUsd = 0, lastText = "";
    for (const line of (stdout || "").split("\n")) {
      if (!line.trim()) continue;
      const ev = _kParse(line);
      if (!ev) continue;
      if (ev.sessionID && !sid) sid = ev.sessionID;
      if (ev.type === "text" && ev.part) lastText = ev.part.text || "";
      if (ev.type === "step_finish" && ev.part) {
        const t = ev.part.tokens || {};
        usage.inputTokens += t.input || 0;
        usage.outputTokens += t.output || 0;
        costUsd += ev.part.cost || 0;
      }
    }
    return { sid, usage, costUsd, lastText };
  };

  const _kiloBuildResult = (proc, parsed, activeModel, isFallback) => {
    const se = (proc.stderr || "").toLowerCase();
    let errorCode, errorMessage;
    if (se.includes("429") || se.includes("rate limit")) { errorCode = "kilo_rate_limit"; errorMessage = "Rate limited"; }
    else if (se.includes("session") && se.includes("not found")) { return { usage: parsed.usage, costUsd: parsed.costUsd, summary: "Session expired", errorCode: "kilo_session_invalid", clearSession: true, sessionParams: null }; }
    else if (proc.exitCode && proc.exitCode !== 0) { errorCode = "kilo_exit_error"; errorMessage = (proc.stderr || "").slice(0, 200); }
    const _mProv = activeModel.includes("/") ? activeModel.slice(0, activeModel.indexOf("/")) : null;
    return { usage: parsed.usage, costUsd: parsed.costUsd, summary: (isFallback ? "[fallback] " : "") + parsed.lastText.slice(0, 500), sessionParams: parsed.sid ? { sessionId: parsed.sid, cwd } : null, sessionDisplayId: parsed.sid || null, provider: _mProv, model: activeModel || null, biller: _mProv || "unknown", billingType: "unknown", errorCode, errorMessage, resultJson: { stdout: proc.stdout, stderr: proc.stderr } };
  };

  const primaryTimeout = fallbackModel ? fallbackTimeoutSec : timeoutSec;
  let _kiloChildPid = null;
  const _kiloOnSpawnWrap = (...a) => { const info = a[0]; if (info && typeof info === "object" && info.pid) _kiloChildPid = info.pid; else if (typeof info === "number") _kiloChildPid = info; if (onSpawn) return onSpawn(...a); };
  let _kiloForceKillTimer = null;
  if (fallbackModel && primaryTimeout > 0) { _kiloForceKillTimer = setTimeout(() => { if (_kiloChildPid) { try { process.kill(_kiloChildPid, 0); process.kill(_kiloChildPid, "SIGKILL"); } catch(e) {} } }, (primaryTimeout + Math.max(1, graceSec) + 5) * 1000); }
  const proc = await _kRcp(runId, command, args, { cwd, env, stdin: prompt, timeoutSec: primaryTimeout, graceSec, onSpawn: _kiloOnSpawnWrap, onLog });
  if (_kiloForceKillTimer) clearTimeout(_kiloForceKillTimer);

  if (proc.timedOut && fallbackModel) {
    await onLog("stdout", "[paperclip] Primary model \"" + model + "\" timed out after " + primaryTimeout + "s. Falling back to \"" + fallbackModel + "\"\n");
    const fbArgs = ["run", "--format", "json", "--auto"];
    if (fallbackModel) fbArgs.push("-m", fallbackModel);
    if (variant) fbArgs.push("--variant", variant);
    if (config.thinking) fbArgs.push("--thinking");
    fbArgs.push("--dir", cwd);
    if (sessionId) fbArgs.push("--session", sessionId);
    if (config.extraArgs) fbArgs.push(...config.extraArgs);
    if (onMeta) { await onMeta({ adapterType: "kilo_local", command, cwd, commandArgs: [...fbArgs, "<stdin prompt " + prompt.length + " chars> [FALLBACK]"], env: Object.fromEntries(Object.entries(env).filter(([k]) => k.startsWith("PAPERCLIP_") || k === "AGENT_HOME" || k === "HOME")), prompt, promptMetrics: { promptChars: prompt.length }, context }); }
    const fbProc = await _kRcp(runId, command, fbArgs, { cwd, env, stdin: prompt, timeoutSec, graceSec, onSpawn, onLog });
    const fbParsed = _kiloParseOutput(fbProc.stdout);
    return _kiloBuildResult(fbProc, fbParsed, fallbackModel, true);
  }

  const parsed = _kiloParseOutput(proc.stdout);
  return _kiloBuildResult(proc, parsed, model, false);
}

function _kiloTestEnv(config) {
  const cmd = _kAs(config && config.command, "/usr/bin/kilo");
  const checks = [];
  try { const v = _kExs(cmd + " --version", { encoding: "utf-8", timeout: 10000 }).trim(); checks.push({ code: "kilo_installed", level: "info", ok: true, message: "Kilo CLI " + v }); }
  catch(e) { checks.push({ code: "kilo_installed", level: "error", ok: false, message: "Not found: " + e.message }); return { status: "fail", testedAt: new Date().toISOString(), checks }; }
  try { const a = _kExs(cmd + " auth list", { encoding: "utf-8", timeout: 10000 }).trim(); const has = a.includes("Gateway") || a.includes("oauth") || a.includes("api-key"); checks.push({ code: "kilo_auth", level: has ? "info" : "warn", ok: has, message: has ? "Auth configured" : "No providers authenticated" }); }
  catch(e) { checks.push({ code: "kilo_auth", level: "warn", ok: false, message: "Auth check failed: " + e.message }); }
  const cwd = config && config.cwd;
  if (cwd) checks.push({ code: "kilo_cwd_valid", level: _kIa(cwd) ? "info" : "error", ok: _kIa(cwd), message: "CWD: " + cwd });
  const status = checks.some(c => !c.ok && c.level === "error") ? "fail" : checks.some(c => !c.ok) ? "warn" : "pass";
  return { status, testedAt: new Date().toISOString(), checks };
}

const _kiloSCodec = {
  serialize(p) { return p && p.sessionId ? JSON.stringify({ sessionId: p.sessionId, cwd: p.cwd }) : null; },
  deserialize(s) { try { const o = JSON.parse(s); return o.sessionId ? o : null; } catch { return null; } },
  getDisplayId(p) { return p && p.sessionId ? p.sessionId.slice(0, 16) : null; },
};

function _kiloListModels() {
  try { const r = _kExs("/usr/bin/kilo models", { encoding: "utf-8", timeout: 15000 }).trim(); return r.split("\n").filter(l => l.includes("/")).map(l => { const i = l.trim().indexOf("/"); return { id: l.trim(), label: l.trim().slice(i+1), group: l.trim().slice(0,i) }; }); }
  catch { return []; }
}
// === END KILO ===
async function _kiloListSkills(ctx) { const s = await listOpenCodeSkills(ctx); s.warnings = ["Kilo uses the shared Claude skills home (~/.claude/skills)."]; return s; }
async function _kiloSyncSkills(ctx, desiredSkills) { const s = await syncOpenCodeSkills(ctx, desiredSkills); s.warnings = ["Kilo uses the shared Claude skills home (~/.claude/skills)."]; return s; }

const kiloLocalAdapter = { type: "kilo_local", execute: _kiloExecute, testEnvironment: _kiloTestEnv, sessionCodec: _kiloSCodec, listSkills: _kiloListSkills, syncSkills: _kiloSyncSkills, models: [], listModels: _kiloListModels, supportsLocalAgentJwt: true, agentConfigurationDoc: "Kilo CLI adapter. Set model (provider/model) and cwd." };
ADAPTER_EOF

  sed -i "$((INJECT_LINE - 1))r $ADAPTER_CODE" "$REGISTRY_JS"
  rm -f "$ADAPTER_CODE"

  info "  Adapter code injected"
fi

# ===================================================================
# MAP ENTRY: Add kiloLocalAdapter to adaptersByType
# ===================================================================
step "Step 4/5: Registering in adaptersByType map..."

if grep -q "kiloLocalAdapter," "$REGISTRY_JS"; then
  info "  kiloLocalAdapter already in map, skipping"
else
  if grep -q "hermesLocalAdapter," "$REGISTRY_JS"; then
    sed -i 's/    hermesLocalAdapter,/    hermesLocalAdapter,\n    kiloLocalAdapter,/' "$REGISTRY_JS"
    info "  Added kiloLocalAdapter to adaptersByType map"
  else
    warn "  Could not find hermesLocalAdapter in map — manual insertion needed"
    warn "  Add 'kiloLocalAdapter,' to the adaptersByType Map array"
  fi
fi

# ===================================================================
# PATCH #9: UI bundle — add kilo_local adapter support to dashboard
# ===================================================================
step "Step 5/5: Patching UI bundle for kilo_local support..."

UI_BUNDLE=$(find "$PAPERCLIP_DIR/ui-dist/assets/" -name 'index-*.js' -exec grep -l 'claude_local' {} \; 2>/dev/null | head -1)

if [[ -z "$UI_BUNDLE" ]]; then
  warn "  UI bundle not found — skipping (dashboard will work, kilo_local just won't appear in UI)"
else
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  npx tsc -p "$SCRIPT_DIR" 2>/dev/null; node "$SCRIPT_DIR/dist/scripts/patch-ui-bundle.js" "$UI_BUNDLE"
fi

# ===================================================================
# Verify
# ===================================================================
echo ""
step "=== Verification ==="
errors=0

if grep -q 'kilo_local' "$CONSTANTS_JS"; then
  info "✓ constants.js: kilo_local in adapter type enum"
else
  error "✗ constants.js: kilo_local NOT in enum"
  ((errors++)) || true
fi

if grep -q "renderTemplate as _kRt" "$REGISTRY_JS"; then
  info "✓ registry.js:  import aliases present"
else
  error "✗ registry.js:  import aliases missing"
  ((errors++)) || true
fi

if grep -q "=== KILO LOCAL ADAPTER ===" "$REGISTRY_JS"; then
  info "✓ registry.js:  adapter code block present"
else
  error "✗ registry.js:  adapter code block missing"
  ((errors++)) || true
fi

if grep -q "_kiloInferFallback" "$REGISTRY_JS"; then
  info "✓ registry.js:  fallback auto-infer present"
else
  error "✗ registry.js:  fallback auto-infer missing"
  ((errors++)) || true
fi

if grep -q "kiloLocalAdapter," "$REGISTRY_JS"; then
  info "✓ registry.js:  kiloLocalAdapter in map"
else
  error "✗ registry.js:  kiloLocalAdapter NOT in map"
  ((errors++)) || true
fi
if grep -q "_kiloListSkills" "$REGISTRY_JS"; then
  info "✓ registry.js:  kilo listSkills/syncSkills present"
else
  error "✗ registry.js:  kilo listSkills/syncSkills missing"
  ((errors++)) || true
fi

# UI bundle
if [[ -n "${UI_BUNDLE:-}" ]]; then
  if npx tsc -p "$(dirname "$0")" 2>/dev/null; node "$(dirname "$0")/dist/scripts/patch-ui-bundle.js" --check "$UI_BUNDLE" > /dev/null 2>&1; then
    info "✓ ui-dist:       kilo_local UI support"
  else
    error "✗ ui-dist:       kilo_local UI support missing"
    ((errors++)) || true
  fi
fi

echo ""
# Sync skills to ~/.kilocode/skills/ for kilo_local agents
if [[ -x ~/sync-kilo-skills.sh ]]; then
  ~/sync-kilo-skills.sh
fi

if [[ $errors -eq 0 ]]; then
  info "=== Installation complete ==="
  echo ""
  info "Next steps:"
  info "  1. Restart Paperclip:  sudo systemctl restart paperclip"
  info "  2. Verify in UI:       Agent → Edit → Adapter Type → 'Kilo (local)'"
  info "  3. Assign an agent:    PATCH /api/agents/:id with adapterType: 'kilo_local'"
  echo ""
  info "Commands:"
  info "  Check status:   $0 --check"
  info "  Re-install:     $0 --force"
  info "  Uninstall:      $0 --uninstall"
else
  error "=== Installation completed with $errors error(s) ==="
  error "Review output above. Use --force to retry from scratch."
  exit 1
fi
