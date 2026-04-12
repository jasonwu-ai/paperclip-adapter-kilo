/**
 * Kilo CLI JSONL output parser.
 *
 * Parses the newline-delimited JSON events emitted by `kilo run --format json`
 * into aggregated session, usage, cost, and summary data.
 */
export interface KiloTokenUsage {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
}
export interface KiloParsedResult {
    sessionId: string | null;
    usage: KiloTokenUsage;
    costUsd: number;
    summary: string;
    errorMessage: string | null;
}
export declare function parseKiloJsonl(stdout: string): KiloParsedResult;
export declare function isKiloUnknownSessionError(stdout: string, stderr: string): boolean;
//# sourceMappingURL=parse.d.ts.map