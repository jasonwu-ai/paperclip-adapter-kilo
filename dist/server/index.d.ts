/**
 * Server entry point for kilo_local adapter.
 *
 * Re-exports execute, testEnvironment, models, parse utilities,
 * and defines the session codec for cross-run session persistence.
 */
import type { AdapterSessionCodec } from "@paperclipai/adapter-utils";
export interface KiloSessionParams {
    sessionId: string;
    cwd?: string;
    workspaceId?: string;
    repoUrl?: string;
    repoRef?: string;
}
export declare const sessionCodec: AdapterSessionCodec<KiloSessionParams>;
export { execute } from "./execute.js";
export { testEnvironment } from "./test.js";
export { listKiloModels } from "./models.js";
export { parseKiloJsonl, isKiloUnknownSessionError } from "./parse.js";
export type { KiloParsedResult, KiloTokenUsage } from "./parse.js";
//# sourceMappingURL=index.d.ts.map