/**
 * UI-side stdout line parser for the Kilo adapter.
 *
 * Converts individual JSONL lines from `kilo run --format json` output
 * into TranscriptEntry objects for the Paperclip run transcript viewer.
 */

import type { TranscriptEntry } from "@paperclipai/adapter-utils";

interface KiloStdoutEvent {
  type: string;
  sessionID?: string;
  part?: {
    text?: string;
    tool?: string;
    reason?: string;
    cost?: number;
    tokens?: {
      input?: number;
      output?: number;
      reasoning?: number;
      cache?: { read?: number };
    };
    state?: {
      status?: string;
      input?: Record<string, unknown>;
      output?: string;
      metadata?: Record<string, unknown>;
    };
  };
}

export function parseStdoutLine(line: string): TranscriptEntry | null {
  if (!line || !line.trim()) return null;

  let event: KiloStdoutEvent;
  try {
    event = JSON.parse(line.trim()) as KiloStdoutEvent;
  } catch {
    return { type: "log", text: line };
  }

  switch (event.type) {
    case "step_start":
      return {
        type: "system",
        text: `step started (${event.sessionID || "no session"})`,
      };

    case "text":
      return {
        type: "assistant",
        text: event.part?.text || "",
      };

    case "tool_use":
      return {
        type: "tool_call",
        tool: event.part?.tool || "unknown",
        input: event.part?.state?.input || {},
        output: event.part?.state?.output || "",
        status: event.part?.state?.status || "unknown",
        metadata: event.part?.state?.metadata || {},
      };

    case "step_finish": {
      const t = event.part?.tokens ?? {};
      return {
        type: "result",
        text: event.part?.reason || "unknown",
        tokens: {
          input: t.input ?? 0,
          output: t.output ?? 0,
          reasoning: t.reasoning ?? 0,
          cacheRead: t.cache?.read ?? 0,
        },
        cost: event.part?.cost ?? 0,
      };
    }

    default:
      return { type: "log", text: line };
  }
}
