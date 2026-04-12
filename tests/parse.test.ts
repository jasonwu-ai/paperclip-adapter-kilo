import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseKiloJsonl, isKiloUnknownSessionError } from "../src/server/parse.js";

describe("parseKiloJsonl", () => {
  it("returns default result for empty input", () => {
    const r = parseKiloJsonl("");
    assert.equal(r.sessionId, null);
    assert.equal(r.usage.inputTokens, 0);
    assert.equal(r.usage.outputTokens, 0);
    assert.equal(r.usage.cachedInputTokens, 0);
    assert.equal(r.costUsd, 0);
    assert.equal(r.summary, "");
    assert.equal(r.errorMessage, null);
  });

  it("captures sessionId from first event", () => {
    const lines = [
      JSON.stringify({ type: "step_start", sessionID: "ses_abc123" }),
      JSON.stringify({ type: "step_start", sessionID: "ses_other" }),
    ].join("\n");
    const r = parseKiloJsonl(lines);
    assert.equal(r.sessionId, "ses_abc123");
  });

  it("aggregates tokens across multiple step_finish events", () => {
    const lines = [
      JSON.stringify({
        type: "step_finish",
        part: {
          reason: "tool-calls",
          cost: 0.001,
          tokens: { input: 100, output: 20, cache: { read: 50 } },
        },
      }),
      JSON.stringify({
        type: "step_finish",
        part: {
          reason: "stop",
          cost: 0.002,
          tokens: { input: 200, output: 30, cache: { read: 10 } },
        },
      }),
    ].join("\n");
    const r = parseKiloJsonl(lines);
    assert.equal(r.usage.inputTokens, 300);
    assert.equal(r.usage.outputTokens, 50);
    assert.equal(r.usage.cachedInputTokens, 60);
    assert.equal(r.costUsd, 0.003);
  });

  it("captures last text event as summary, capped at 500 chars", () => {
    const longText = "x".repeat(600);
    const lines = [
      JSON.stringify({ type: "text", part: { text: "first message" } }),
      JSON.stringify({ type: "text", part: { text: longText } }),
    ].join("\n");
    const r = parseKiloJsonl(lines);
    assert.equal(r.summary.length, 500);
    assert.equal(r.summary, longText.slice(0, 500));
  });

  it("captures error events with part.message", () => {
    const lines = JSON.stringify({
      type: "error",
      part: { message: "Rate limit exceeded" },
    });
    const r = parseKiloJsonl(lines);
    assert.equal(r.errorMessage, "Rate limit exceeded");
  });

  it("captures error events with top-level message", () => {
    const lines = JSON.stringify({
      type: "error",
      message: "Connection failed",
    });
    const r = parseKiloJsonl(lines);
    assert.equal(r.errorMessage, "Connection failed");
  });

  it("falls back to generic error when no message fields", () => {
    const lines = JSON.stringify({ type: "error" });
    const r = parseKiloJsonl(lines);
    assert.equal(r.errorMessage, "Unknown kilo error");
  });

  it("skips non-JSON lines gracefully", () => {
    const lines = [
      "this is not json",
      JSON.stringify({ type: "text", part: { text: "hello" } }),
      "another bad line",
    ].join("\n");
    const r = parseKiloJsonl(lines);
    assert.equal(r.summary, "hello");
    assert.equal(r.errorMessage, null);
  });

  it("handles missing token fields gracefully", () => {
    const lines = JSON.stringify({
      type: "step_finish",
      part: { reason: "stop", tokens: {} },
    });
    const r = parseKiloJsonl(lines);
    assert.equal(r.usage.inputTokens, 0);
    assert.equal(r.usage.outputTokens, 0);
    assert.equal(r.usage.cachedInputTokens, 0);
  });

  it("handles step_finish with no tokens at all", () => {
    const lines = JSON.stringify({
      type: "step_finish",
      part: { reason: "stop" },
    });
    const r = parseKiloJsonl(lines);
    assert.equal(r.usage.inputTokens, 0);
    assert.equal(r.costUsd, 0);
  });

  it("parses a full multi-step run", () => {
    const lines = [
      JSON.stringify({ type: "step_start", sessionID: "ses_full" }),
      JSON.stringify({ type: "text", part: { text: "Looking at the code" } }),
      JSON.stringify({
        type: "tool_use",
        part: {
          tool: "bash",
          state: { status: "completed", input: { command: "ls" }, output: "file.txt" },
        },
      }),
      JSON.stringify({
        type: "step_finish",
        part: { reason: "tool-calls", cost: 0.005, tokens: { input: 500, output: 100, cache: { read: 200 } } },
      }),
      JSON.stringify({ type: "step_start", sessionID: "ses_full" }),
      JSON.stringify({ type: "text", part: { text: "Done. Created the file." } }),
      JSON.stringify({
        type: "step_finish",
        part: { reason: "stop", cost: 0.003, tokens: { input: 800, output: 50, cache: { read: 400 } } },
      }),
    ].join("\n");

    const r = parseKiloJsonl(lines);
    assert.equal(r.sessionId, "ses_full");
    assert.equal(r.usage.inputTokens, 1300);
    assert.equal(r.usage.outputTokens, 150);
    assert.equal(r.usage.cachedInputTokens, 600);
    assert.equal(r.costUsd, 0.008);
    assert.equal(r.summary, "Done. Created the file.");
    assert.equal(r.errorMessage, null);
  });
});

describe("isKiloUnknownSessionError", () => {
  it("detects 'session not found'", () => {
    assert.equal(isKiloUnknownSessionError("Session not found", ""), true);
  });

  it("detects 'session unknown' in stderr", () => {
    assert.equal(isKiloUnknownSessionError("", "Error: session unknown"), true);
  });

  it("detects 'session expired'", () => {
    assert.equal(isKiloUnknownSessionError("Session has expired", ""), true);
  });

  it("returns false for unrelated errors", () => {
    assert.equal(isKiloUnknownSessionError("Rate limit exceeded", ""), false);
  });

  it("returns false for empty input", () => {
    assert.equal(isKiloUnknownSessionError("", ""), false);
  });

  it("is case-insensitive", () => {
    assert.equal(isKiloUnknownSessionError("SESSION NOT FOUND", ""), true);
  });
});
