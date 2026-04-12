import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatStdoutEvent } from "../src/cli/index.js";

describe("formatStdoutEvent", () => {
  it("returns null for empty input", () => {
    assert.equal(formatStdoutEvent(""), null);
    assert.equal(formatStdoutEvent("   "), null);
  });

  it("formats step_start", () => {
    const line = JSON.stringify({ type: "step_start", sessionID: "ses_abc" });
    assert.equal(formatStdoutEvent(line), "-- step started (ses_abc) --");
  });

  it("formats step_start without session", () => {
    const line = JSON.stringify({ type: "step_start" });
    assert.equal(formatStdoutEvent(line), "-- step started (?) --");
  });

  it("formats text event", () => {
    const line = JSON.stringify({ type: "text", part: { text: "Hello!" } });
    assert.equal(formatStdoutEvent(line), "Hello!");
  });

  it("formats tool_use event", () => {
    const line = JSON.stringify({
      type: "tool_use",
      part: { tool: "bash", state: { status: "completed" } },
    });
    assert.equal(formatStdoutEvent(line), "[bash] completed");
  });

  it("formats step_finish event", () => {
    const line = JSON.stringify({
      type: "step_finish",
      part: {
        reason: "stop",
        cost: 0.00123,
        tokens: { input: 500, output: 100 },
      },
    });
    assert.equal(
      formatStdoutEvent(line),
      "-- stop (in:500 out:100 cost:$0.001230) --",
    );
  });

  it("passes non-JSON lines through", () => {
    assert.equal(formatStdoutEvent("raw output"), "raw output");
  });

  it("passes unknown event types through", () => {
    const line = JSON.stringify({ type: "custom", data: 123 });
    assert.equal(formatStdoutEvent(line), line);
  });
});
