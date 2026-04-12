/**
 * UI-side stdout line parser for the Kilo adapter.
 *
 * Converts individual JSONL lines from `kilo run --format json` output
 * into TranscriptEntry objects for the Paperclip run transcript viewer.
 */
import type { TranscriptEntry } from "@paperclipai/adapter-utils";
export declare function parseStdoutLine(line: string): TranscriptEntry | null;
//# sourceMappingURL=parse-stdout.d.ts.map