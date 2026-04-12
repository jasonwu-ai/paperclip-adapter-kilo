/**
 * CLI-side stdout event formatter for terminal display.
 *
 * Used by `paperclipai run --watch` to render kilo_local run output
 * in a human-readable terminal format.
 */
export function formatStdoutEvent(line) {
    if (!line || !line.trim())
        return null;
    let event;
    try {
        event = JSON.parse(line.trim());
    }
    catch {
        return line;
    }
    switch (event.type) {
        case "step_start":
            return `-- step started (${event.sessionID || "?"}) --`;
        case "text":
            return event.part?.text || "";
        case "tool_use": {
            const t = event.part?.tool || "?";
            const s = event.part?.state?.status || "";
            return `[${t}] ${s}`;
        }
        case "step_finish": {
            const tk = event.part?.tokens ?? {};
            const cost = (event.part?.cost ?? 0).toFixed(6);
            return `-- ${event.part?.reason || "?"} (in:${tk.input ?? 0} out:${tk.output ?? 0} cost:$${cost}) --`;
        }
        default:
            return line;
    }
}
//# sourceMappingURL=index.js.map