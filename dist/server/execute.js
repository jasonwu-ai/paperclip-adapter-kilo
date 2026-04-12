/**
 * Kilo adapter execute function.
 *
 * Spawns `kilo run --format json --auto` as a child process, streams output,
 * and returns an AdapterExecutionResult with usage, session state, and cost.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { asString, asNumber, asStringArray, parseObject, buildPaperclipEnv, joinPromptSections, buildInvocationEnvForLogs, ensureAbsoluteDirectory, ensurePathInEnv, resolveCommandForLogs, renderTemplate, runChildProcess, } from "@paperclipai/adapter-utils/server-utils";
import { parseKiloJsonl, isKiloUnknownSessionError } from "./parse.js";
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function firstNonEmptyLine(text) {
    return (text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find(Boolean) ?? "");
}
function parseModelProvider(model) {
    if (!model)
        return null;
    const t = model.trim();
    return t.includes("/") ? t.slice(0, t.indexOf("/")).trim() || null : null;
}
function nonEmptyString(v) {
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------
export async function execute(ctx) {
    const { runId, agent, runtime, config, context, onLog, onMeta, onSpawn, authToken, } = ctx;
    // ---- Config extraction ---------------------------------------------------
    const command = asString(config.command, "kilo");
    const model = asString(config.model, "").trim();
    const variant = asString(config.variant, "").trim();
    const timeoutSec = asNumber(config.timeoutSec, 0);
    const graceSec = asNumber(config.graceSec, 20);
    const extraArgs = (() => {
        const a = asStringArray(config.extraArgs);
        return a.length > 0 ? a : asStringArray(config.args);
    })();
    // ---- Workspace -----------------------------------------------------------
    const wsCtx = parseObject(context.paperclipWorkspace);
    const wsCwd = asString(wsCtx.cwd, "");
    const wsSrc = asString(wsCtx.source, "");
    const wsId = asString(wsCtx.workspaceId, "");
    const wsRepo = asString(wsCtx.repoUrl, "");
    const wsRef = asString(wsCtx.repoRef, "");
    const wsAh = asString(wsCtx.agentHome, "");
    const wsHints = Array.isArray(context.paperclipWorkspaces)
        ? context.paperclipWorkspaces.filter((v) => typeof v === "object" && v !== null)
        : [];
    const cfgCwd = asString(config.cwd, "");
    const useConfigCwd = wsSrc === "agent_home" && cfgCwd.length > 0;
    const effectiveWsCwd = useConfigCwd ? "" : wsCwd;
    const cwd = effectiveWsCwd || cfgCwd || process.cwd();
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    // ---- Session -------------------------------------------------------------
    const rtSp = parseObject(runtime.sessionParams);
    const rtSid = asString(rtSp.sessionId, runtime.sessionId ?? "");
    const rtScwd = asString(rtSp.cwd, "");
    const canResume = rtSid.length > 0 &&
        (rtScwd.length === 0 || path.resolve(rtScwd) === path.resolve(cwd));
    const sessionId = canResume ? rtSid : null;
    if (rtSid && !canResume) {
        await onLog("stdout", `[paperclip] Kilo session "${rtSid}" saved for "${rtScwd}", not resuming in "${cwd}".\n`);
    }
    // ---- Instructions --------------------------------------------------------
    const instrPath = asString(config.instructionsFilePath, "").trim();
    const resolvedInstr = instrPath ? path.resolve(cwd, instrPath) : "";
    const instrDir = resolvedInstr ? `${path.dirname(resolvedInstr)}/` : "";
    let instrPrefix = "";
    if (resolvedInstr) {
        try {
            const contents = await fs.readFile(resolvedInstr, "utf8");
            instrPrefix = `${contents}\n\nThe above agent instructions were loaded from ${resolvedInstr}. Resolve any relative file references from ${instrDir}.\n\n`;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await onLog("stdout", `[paperclip] Warning: could not read instructions "${resolvedInstr}": ${msg}\n`);
        }
    }
    // ---- Prompt --------------------------------------------------------------
    const promptTpl = asString(config.promptTemplate, "You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work.");
    const bsTpl = asString(config.bootstrapPromptTemplate, "");
    const td = {
        agentId: agent.id,
        companyId: agent.companyId,
        runId,
        company: { id: agent.companyId },
        agent,
        run: { id: runId, source: "on_demand" },
        context,
    };
    const rendered = renderTemplate(promptTpl, td);
    const bsRendered = !sessionId && bsTpl.trim().length > 0
        ? renderTemplate(bsTpl, td).trim()
        : "";
    const handoff = asString(context.paperclipSessionHandoffMarkdown, "").trim();
    const prompt = joinPromptSections([
        instrPrefix,
        bsRendered,
        handoff,
        rendered,
    ]);
    const promptMetrics = {
        promptChars: prompt.length,
        instructionsChars: instrPrefix.length,
        bootstrapPromptChars: bsRendered.length,
        sessionHandoffChars: handoff.length,
        heartbeatPromptChars: rendered.length,
    };
    // ---- Environment ---------------------------------------------------------
    const envConfig = parseObject(config.env);
    const hasExplicitKey = typeof envConfig.PAPERCLIP_API_KEY === "string" &&
        envConfig.PAPERCLIP_API_KEY.trim().length > 0;
    const env = { ...buildPaperclipEnv(agent) };
    env.PAPERCLIP_RUN_ID = runId;
    // Wake context
    const wTask = nonEmptyString(context.taskId) || nonEmptyString(context.issueId);
    const wReason = nonEmptyString(context.wakeReason);
    const wComment = nonEmptyString(context.wakeCommentId) ||
        nonEmptyString(context.commentId);
    const wApprId = nonEmptyString(context.approvalId);
    const wApprSt = nonEmptyString(context.approvalStatus);
    const wLinked = Array.isArray(context.issueIds)
        ? context.issueIds.filter((v) => typeof v === "string" && v.trim().length > 0)
        : [];
    if (wTask)
        env.PAPERCLIP_TASK_ID = wTask;
    if (wReason)
        env.PAPERCLIP_WAKE_REASON = wReason;
    if (wComment)
        env.PAPERCLIP_WAKE_COMMENT_ID = wComment;
    if (wApprId)
        env.PAPERCLIP_APPROVAL_ID = wApprId;
    if (wApprSt)
        env.PAPERCLIP_APPROVAL_STATUS = wApprSt;
    if (wLinked.length > 0)
        env.PAPERCLIP_LINKED_ISSUE_IDS = wLinked.join(",");
    if (effectiveWsCwd)
        env.PAPERCLIP_WORKSPACE_CWD = effectiveWsCwd;
    if (wsSrc)
        env.PAPERCLIP_WORKSPACE_SOURCE = wsSrc;
    if (wsId)
        env.PAPERCLIP_WORKSPACE_ID = wsId;
    if (wsRepo)
        env.PAPERCLIP_WORKSPACE_REPO_URL = wsRepo;
    if (wsRef)
        env.PAPERCLIP_WORKSPACE_REPO_REF = wsRef;
    if (wsAh)
        env.AGENT_HOME = wsAh;
    if (wsHints.length > 0)
        env.PAPERCLIP_WORKSPACES_JSON = JSON.stringify(wsHints);
    // Merge user env config
    for (const [k, v] of Object.entries(envConfig)) {
        if (typeof v === "string")
            env[k] = v;
    }
    if (!hasExplicitKey && authToken)
        env.PAPERCLIP_API_KEY = authToken;
    const runtimeEnv = Object.fromEntries(Object.entries(ensurePathInEnv({ ...process.env, ...env })).filter((e) => typeof e[1] === "string"));
    const resolvedCmd = await resolveCommandForLogs(command, cwd, runtimeEnv);
    const loggedEnv = buildInvocationEnvForLogs(env, {
        runtimeEnv,
        includeRuntimeKeys: ["HOME"],
        resolvedCommand: resolvedCmd,
    });
    const cmdNotes = [];
    if (resolvedInstr && instrPrefix.length > 0) {
        cmdNotes.push(`Loaded instructions from ${resolvedInstr}`);
    }
    // ---- Args builder --------------------------------------------------------
    const buildArgs = (sid) => {
        const a = ["run", "--format", "json", "--auto"];
        if (model)
            a.push("-m", model);
        if (variant)
            a.push("--variant", variant);
        if (config.thinking)
            a.push("--thinking");
        a.push("--dir", cwd);
        if (sid)
            a.push("--session", sid);
        if (extraArgs.length > 0)
            a.push(...extraArgs);
        return a;
    };
    // ---- Run attempt ---------------------------------------------------------
    const runAttempt = async (sid) => {
        const args = buildArgs(sid);
        if (onMeta) {
            await onMeta({
                adapterType: "kilo_local",
                command: resolvedCmd,
                cwd,
                commandNotes: cmdNotes,
                commandArgs: [...args, `<stdin prompt ${prompt.length} chars>`],
                env: loggedEnv,
                prompt,
                promptMetrics,
                context,
            });
        }
        const proc = await runChildProcess(runId, command, args, {
            cwd,
            env: runtimeEnv,
            stdin: prompt,
            timeoutSec,
            graceSec,
            onSpawn,
            onLog,
        });
        return {
            proc,
            rawStderr: proc.stderr,
            parsed: parseKiloJsonl(proc.stdout),
        };
    };
    // ---- Result builder ------------------------------------------------------
    const toResult = (attempt, clearSession = false) => {
        if (attempt.proc.timedOut) {
            return {
                exitCode: attempt.proc.exitCode,
                signal: attempt.proc.signal,
                timedOut: true,
                errorMessage: `Timed out after ${timeoutSec}s`,
                clearSession,
            };
        }
        const rSid = attempt.parsed.sessionId ??
            (clearSession
                ? null
                : (rtSid || runtime.sessionId || null));
        const rSp = rSid
            ? {
                sessionId: rSid,
                cwd,
                ...(wsId ? { workspaceId: wsId } : {}),
                ...(wsRepo ? { repoUrl: wsRepo } : {}),
                ...(wsRef ? { repoRef: wsRef } : {}),
            }
            : null;
        const pErr = typeof attempt.parsed.errorMessage === "string"
            ? attempt.parsed.errorMessage.trim()
            : "";
        const stderrLine = firstNonEmptyLine(attempt.proc.stderr);
        const rawExit = attempt.proc.exitCode;
        const exitCode = pErr && (rawExit ?? 0) === 0 ? 1 : rawExit;
        const errMsg = pErr || stderrLine || `Kilo exited with code ${exitCode ?? -1}`;
        const provider = parseModelProvider(model);
        return {
            exitCode,
            signal: attempt.proc.signal,
            timedOut: false,
            errorMessage: (exitCode ?? 0) === 0 ? null : errMsg,
            usage: {
                inputTokens: attempt.parsed.usage.inputTokens,
                outputTokens: attempt.parsed.usage.outputTokens,
                cachedInputTokens: attempt.parsed.usage.cachedInputTokens,
            },
            sessionId: rSid,
            sessionParams: rSp,
            sessionDisplayId: rSid,
            provider,
            biller: provider ?? "unknown",
            model: model || null,
            billingType: "unknown",
            costUsd: attempt.parsed.costUsd,
            resultJson: {
                stdout: attempt.proc.stdout,
                stderr: attempt.proc.stderr,
            },
            summary: attempt.parsed.summary,
            clearSession: Boolean(clearSession && !attempt.parsed.sessionId),
        };
    };
    // ---- Execute with session retry ------------------------------------------
    const initial = await runAttempt(sessionId);
    const failed = !initial.proc.timedOut &&
        ((initial.proc.exitCode ?? 0) !== 0 ||
            Boolean(initial.parsed.errorMessage));
    if (sessionId &&
        failed &&
        isKiloUnknownSessionError(initial.proc.stdout, initial.rawStderr)) {
        await onLog("stdout", `[paperclip] Kilo session "${sessionId}" unavailable; retrying fresh.\n`);
        const retry = await runAttempt(null);
        return toResult(retry, true);
    }
    return toResult(initial);
}
//# sourceMappingURL=execute.js.map