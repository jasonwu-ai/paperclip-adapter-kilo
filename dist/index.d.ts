/**
 * paperclip-adapter-kilo
 *
 * Paperclip adapter for Kilo CLI (kilo_local).
 * Spawns `kilo run --format json --auto` as a local process with
 * multi-provider model support via configured Kilo providers.
 */
export declare const type: "kilo_local";
export declare const label = "Kilo (local)";
export declare const models: string[];
export declare const agentConfigurationDoc = "Kilo CLI adapter for Paperclip. Spawns kilo run --format json --auto as a local process. Supports any model available through configured Kilo providers.\n\nRequired: model (provider/model format)\nOptional: command, variant (reasoning effort), cwd, timeoutSec, graceSec, thinking, promptTemplate, bootstrapPromptTemplate, instructionsFilePath, extraArgs, env\n\nSkills auto-load from ~/.claude/skills/ and ~/.opencode/skills/. Sessions persist in ~/.local/share/kilo/kilo.db.";
//# sourceMappingURL=index.d.ts.map