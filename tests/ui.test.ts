import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseStdoutLine } from "../src/ui/parse-stdout.js";
import { buildAdapterConfig, configFields } from "../src/ui/build-config.js";

// ---------------------------------------------------------------------------
// parseStdoutLine
// ---------------------------------------------------------------------------

describe("parseStdoutLine", () => {
  it("returns null for empty input", () => {
    assert.equal(parseStdoutLine(""), null);
    assert.equal(parseStdoutLine("   "), null);
  });

  it("parses step_start as system entry", () => {
    const line = JSON.stringify({ type: "step_start", sessionID: "ses_1" });
    const r = parseStdoutLine(line);
    assert.equal(r?.type, "system");
    assert.ok(r?.text?.includes("ses_1"));
  });

  it("parses step_start without sessionID", () => {
    const line = JSON.stringify({ type: "step_start" });
    const r = parseStdoutLine(line);
    assert.equal(r?.type, "system");
    assert.ok(r?.text?.includes("no session"));
  });

  it("parses text event as assistant entry", () => {
    const line = JSON.stringify({ type: "text", part: { text: "Hello world" } });
    const r = parseStdoutLine(line);
    assert.equal(r?.type, "assistant");
    assert.equal(r?.text, "Hello world");
  });

  it("parses tool_use event", () => {
    const line = JSON.stringify({
      type: "tool_use",
      part: {
        tool: "bash",
        state: {
          status: "completed",
          input: { command: "ls" },
          output: "file.txt",
          metadata: { exit: 0 },
        },
      },
    });
    const r = parseStdoutLine(line);
    assert.equal(r?.type, "tool_call");
    assert.equal(r?.tool, "bash");
    assert.equal(r?.status, "completed");
    assert.deepEqual(r?.input, { command: "ls" });
  });

  it("parses step_finish event as result entry", () => {
    const line = JSON.stringify({
      type: "step_finish",
      part: {
        reason: "stop",
        cost: 0.005,
        tokens: { input: 1000, output: 200, reasoning: 50, cache: { read: 100 } },
      },
    });
    const r = parseStdoutLine(line);
    assert.equal(r?.type, "result");
    assert.equal(r?.text, "stop");
    assert.equal(r?.cost, 0.005);
    assert.equal(r?.tokens?.input, 1000);
    assert.equal(r?.tokens?.output, 200);
    assert.equal(r?.tokens?.reasoning, 50);
    assert.equal(r?.tokens?.cacheRead, 100);
  });

  it("returns log entry for non-JSON lines", () => {
    const r = parseStdoutLine("some random output");
    assert.equal(r?.type, "log");
    assert.equal(r?.text, "some random output");
  });

  it("returns log entry for unknown event types", () => {
    const line = JSON.stringify({ type: "unknown_type", data: "test" });
    const r = parseStdoutLine(line);
    assert.equal(r?.type, "log");
  });

  it("handles missing part fields gracefully", () => {
    const line = JSON.stringify({ type: "tool_use", part: {} });
    const r = parseStdoutLine(line);
    assert.equal(r?.type, "tool_call");
    assert.equal(r?.tool, "unknown");
  });
});

// ---------------------------------------------------------------------------
// buildAdapterConfig
// ---------------------------------------------------------------------------

describe("buildAdapterConfig", () => {
  it("builds minimal config with model only", () => {
    const c = buildAdapterConfig({ model: "zai-coding-plan/glm-5.1" });
    assert.deepEqual(c, { model: "zai-coding-plan/glm-5.1" });
  });

  it("builds full config with all fields", () => {
    const c = buildAdapterConfig({
      command: "/usr/local/bin/kilo",
      model: "kilo/openai/gpt-4o",
      variant: "high",
      cwd: "/home/agent/work",
      timeoutSec: "300",
      graceSec: "30",
      thinking: true,
      promptTemplate: "Do the thing",
      bootstrapPromptTemplate: "Init prompt",
      instructionsFilePath: "AGENTS.md",
      extraArgs: "--verbose --debug",
    });
    assert.equal(c.command, "/usr/local/bin/kilo");
    assert.equal(c.model, "kilo/openai/gpt-4o");
    assert.equal(c.variant, "high");
    assert.equal(c.cwd, "/home/agent/work");
    assert.equal(c.timeoutSec, 300);
    assert.equal(c.graceSec, 30);
    assert.equal(c.thinking, true);
    assert.equal(c.promptTemplate, "Do the thing");
    assert.equal(c.bootstrapPromptTemplate, "Init prompt");
    assert.equal(c.instructionsFilePath, "AGENTS.md");
    assert.deepEqual(c.extraArgs, ["--verbose", "--debug"]);
  });

  it("omits falsy fields", () => {
    const c = buildAdapterConfig({});
    assert.deepEqual(c, {});
  });

  it("parses extraArgs by whitespace", () => {
    const c = buildAdapterConfig({ extraArgs: "  --flag1   --flag2  " });
    assert.deepEqual(c.extraArgs, ["--flag1", "--flag2"]);
  });

  it("omits extraArgs when empty after splitting", () => {
    const c = buildAdapterConfig({ extraArgs: "   " });
    assert.equal(c.extraArgs, undefined);
  });

  it("converts numeric timeoutSec from string", () => {
    const c = buildAdapterConfig({ timeoutSec: "120" });
    assert.equal(c.timeoutSec, 120);
  });

  it("defaults graceSec to 20 when NaN", () => {
    const c = buildAdapterConfig({ graceSec: "not a number" });
    assert.equal(c.graceSec, 20);
  });
});

// ---------------------------------------------------------------------------
// configFields
// ---------------------------------------------------------------------------

describe("configFields", () => {
  it("has model as first required field", () => {
    assert.equal(configFields[0].key, "model");
    assert.equal(configFields[0].required, true);
    assert.equal(configFields[0].type, "model_select");
  });

  it("has variant with correct options", () => {
    const variant = configFields.find((f) => f.key === "variant");
    assert.ok(variant);
    assert.deepEqual(variant.options, [
      "",
      "minimal",
      "low",
      "medium",
      "high",
      "max",
    ]);
  });

  it("includes all expected fields", () => {
    const keys = configFields.map((f) => f.key);
    assert.ok(keys.includes("model"));
    assert.ok(keys.includes("variant"));
    assert.ok(keys.includes("command"));
    assert.ok(keys.includes("promptTemplate"));
    assert.ok(keys.includes("extraArgs"));
  });
});
