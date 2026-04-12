/**
 * Server entry point for kilo_local adapter.
 *
 * Re-exports execute, testEnvironment, models, parse utilities,
 * and defines the session codec for cross-run session persistence.
 */
function readNonEmptyString(v) {
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}
function extractSessionId(p) {
    return (readNonEmptyString(p.sessionId) ??
        readNonEmptyString(p.session_id) ??
        readNonEmptyString(p.sessionID));
}
export const sessionCodec = {
    serialize(p) {
        if (!p || typeof p !== "object" || Array.isArray(p))
            return null;
        const obj = p;
        const sid = extractSessionId(obj);
        if (!sid)
            return null;
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
    deserialize(raw) {
        if (typeof raw !== "object" || raw === null || Array.isArray(raw))
            return null;
        const obj = raw;
        const sid = extractSessionId(obj);
        if (!sid)
            return null;
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
    getDisplayId(p) {
        if (!p || typeof p !== "object" || Array.isArray(p))
            return null;
        return extractSessionId(p);
    },
};
// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------
export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export { listKiloModels } from "./models.js";
export { parseKiloJsonl, isKiloUnknownSessionError } from "./parse.js";
//# sourceMappingURL=index.js.map