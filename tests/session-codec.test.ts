import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sessionCodec } from "../src/server/index.js";

describe("sessionCodec.serialize", () => {
  it("extracts sessionId from standard field", () => {
    const r = sessionCodec.serialize({ sessionId: "ses_abc" });
    assert.deepEqual(r, { sessionId: "ses_abc" });
  });

  it("extracts sessionId from sessionID variant", () => {
    const r = sessionCodec.serialize({ sessionID: "ses_def" });
    assert.deepEqual(r, { sessionId: "ses_def" });
  });

  it("extracts sessionId from session_id variant", () => {
    const r = sessionCodec.serialize({ session_id: "ses_ghi" });
    assert.deepEqual(r, { sessionId: "ses_ghi" });
  });

  it("prefers sessionId over sessionID and session_id", () => {
    const r = sessionCodec.serialize({
      sessionId: "winner",
      sessionID: "loser1",
      session_id: "loser2",
    });
    assert.equal(r?.sessionId, "winner");
  });

  it("includes optional fields when present", () => {
    const r = sessionCodec.serialize({
      sessionId: "ses_full",
      cwd: "/home/test",
      workspaceId: "ws_1",
      repoUrl: "https://github.com/test/repo",
      repoRef: "main",
    });
    assert.deepEqual(r, {
      sessionId: "ses_full",
      cwd: "/home/test",
      workspaceId: "ws_1",
      repoUrl: "https://github.com/test/repo",
      repoRef: "main",
    });
  });

  it("omits empty optional fields", () => {
    const r = sessionCodec.serialize({
      sessionId: "ses_min",
      cwd: "",
      workspaceId: "  ",
    });
    assert.deepEqual(r, { sessionId: "ses_min" });
  });

  it("returns null for null input", () => {
    assert.equal(sessionCodec.serialize(null), null);
  });

  it("returns null for undefined input", () => {
    assert.equal(sessionCodec.serialize(undefined), null);
  });

  it("returns null for array input", () => {
    assert.equal(sessionCodec.serialize([]), null);
  });

  it("returns null when no session ID found", () => {
    assert.equal(sessionCodec.serialize({ cwd: "/tmp" }), null);
  });

  it("returns null for empty session ID", () => {
    assert.equal(sessionCodec.serialize({ sessionId: "" }), null);
  });

  it("returns null for whitespace-only session ID", () => {
    assert.equal(sessionCodec.serialize({ sessionId: "   " }), null);
  });
});

describe("sessionCodec.deserialize", () => {
  it("round-trips with serialize output", () => {
    const original = {
      sessionId: "ses_round",
      cwd: "/workspace",
      workspaceId: "ws_2",
    };
    const serialized = sessionCodec.serialize(original);
    const deserialized = sessionCodec.deserialize(serialized);
    assert.deepEqual(deserialized, serialized);
  });

  it("handles all sessionId field variants", () => {
    assert.equal(
      sessionCodec.deserialize({ sessionID: "from_ID" })?.sessionId,
      "from_ID",
    );
    assert.equal(
      sessionCodec.deserialize({ session_id: "from_id" })?.sessionId,
      "from_id",
    );
  });

  it("returns null for non-object types", () => {
    assert.equal(sessionCodec.deserialize("string"), null);
    assert.equal(sessionCodec.deserialize(42), null);
    assert.equal(sessionCodec.deserialize(null), null);
    assert.equal(sessionCodec.deserialize([]), null);
  });
});

describe("sessionCodec.getDisplayId", () => {
  it("returns sessionId from object", () => {
    assert.equal(
      sessionCodec.getDisplayId({ sessionId: "ses_display" }),
      "ses_display",
    );
  });

  it("returns null for missing sessionId", () => {
    assert.equal(sessionCodec.getDisplayId({ cwd: "/tmp" }), null);
  });

  it("returns null for null/undefined", () => {
    assert.equal(sessionCodec.getDisplayId(null), null);
    assert.equal(sessionCodec.getDisplayId(undefined), null);
  });

  it("handles sessionID variant", () => {
    assert.equal(
      sessionCodec.getDisplayId({ sessionID: "ses_ALT" }),
      "ses_ALT",
    );
  });
});
