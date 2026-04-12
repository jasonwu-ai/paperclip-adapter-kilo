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

interface KiloStepFinishTokens {
  input?: number;
  output?: number;
  reasoning?: number;
  total?: number;
  cache?: { read?: number; write?: number };
}

interface KiloEvent {
  type: string;
  timestamp?: number;
  sessionID?: string;
  part?: {
    type?: string;
    text?: string;
    reason?: string;
    cost?: number;
    tokens?: KiloStepFinishTokens;
    tool?: string;
    message?: string;
    state?: {
      status?: string;
      input?: Record<string, unknown>;
      output?: string;
      metadata?: Record<string, unknown>;
    };
  };
  message?: string;
}

export function parseKiloJsonl(stdout: string): KiloParsedResult {
  const result: KiloParsedResult = {
    sessionId: null,
    usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
    costUsd: 0,
    summary: "",
    errorMessage: null,
  };

  if (!stdout) return result;

  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;

    let event: KiloEvent;
    try {
      event = JSON.parse(line.trim()) as KiloEvent;
    } catch {
      continue;
    }

    // Capture session ID from the first event that carries one
    if (event.sessionID && !result.sessionId) {
      result.sessionId = event.sessionID;
    }

    // Accumulate text for summary (last text wins, capped at 500 chars)
    if (event.type === "text" && event.part) {
      const text = event.part.text;
      if (typeof text === "string" && text.length > 0) {
        result.summary = text.slice(0, 500);
      }
    }

    // Aggregate tokens/cost across all step_finish events
    if (event.type === "step_finish" && event.part) {
      const tokens = event.part.tokens ?? {};
      result.usage.inputTokens += tokens.input ?? 0;
      result.usage.outputTokens += tokens.output ?? 0;
      const cache = tokens.cache ?? {};
      result.usage.cachedInputTokens += cache.read ?? 0;
      result.costUsd += event.part.cost ?? 0;
    }

    // Capture error messages
    if (event.type === "error") {
      result.errorMessage =
        typeof event.part?.message === "string"
          ? event.part.message
          : typeof event.message === "string"
            ? event.message
            : "Unknown kilo error";
    }
  }

  return result;
}

export function isKiloUnknownSessionError(
  stdout: string,
  stderr: string,
): boolean {
  const combined = ((stdout || "") + (stderr || "")).toLowerCase();
  return (
    (combined.includes("session") && combined.includes("not found")) ||
    (combined.includes("session") && combined.includes("unknown")) ||
    (combined.includes("session") && combined.includes("expired"))
  );
}
