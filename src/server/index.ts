/**
 * Server entry point for kilo_local adapter.
 *
 * Re-exports execute, testEnvironment, models, parse utilities,
 * and defines the session codec for cross-run session persistence.
 */

import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";

// ---------------------------------------------------------------------------
// Session codec
// ---------------------------------------------------------------------------

export interface KiloSessionParams {
  sessionId: string;
  cwd?: string;
  workspaceId?: string;
  repoUrl?: string;
  repoRef?: string;
}

function readNonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function extractSessionId(p: Record<string, unknown>): string | null {
  return (
    readNonEmptyString(p.sessionId) ??
    readNonEmptyString(p.session_id) ??
    readNonEmptyString(p.sessionID)
  );
}

export const sessionCodec: AdapterSessionCodec<KiloSessionParams> = {
  serialize(p: unknown): KiloSessionParams | null {
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    const obj = p as Record<string, unknown>;
    const sid = extractSessionId(obj);
    if (!sid) return null;

    const cwd = readNonEmptyString(obj.cwd);
    const wid = readNonEmptyString(obj.workspaceId);
    const repo = readNonEmptyString(obj.repoUrl);
    const ref = readNonEmptyString(obj.repoRef);

    return {
      sessionId: sid,
      ...(cwd ? { cwd } : {}),
      ...(wid ? { workspaceId: wid } : {}),
      ...(repo ? { repoUrl: repo } : {}),
      ...(ref ? { repoRef: ref } : {}),
    };
  },

  deserialize(raw: unknown): KiloSessionParams | null {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      return null;
    const obj = raw as Record<string, unknown>;
    const sid = extractSessionId(obj);
    if (!sid) return null;

    const cwd = readNonEmptyString(obj.cwd);
    const wid = readNonEmptyString(obj.workspaceId);
    const repo = readNonEmptyString(obj.repoUrl);
    const ref = readNonEmptyString(obj.repoRef);

    return {
      sessionId: sid,
      ...(cwd ? { cwd } : {}),
      ...(wid ? { workspaceId: wid } : {}),
      ...(repo ? { repoUrl: repo } : {}),
      ...(ref ? { repoRef: ref } : {}),
    };
  },

  getDisplayId(p: unknown): string | null {
    if (!p || typeof p !== "object" || Array.isArray(p)) return null;
    return extractSessionId(p as Record<string, unknown>);
  },
};

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export { listKiloModels } from "./models.js";
export { parseKiloJsonl, isKiloUnknownSessionError } from "./parse.js";
export type { KiloParsedResult, KiloTokenUsage } from "./parse.js";
