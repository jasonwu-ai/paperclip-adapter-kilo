/**
 * paperclip-adapter-kilo
 *
 * Paperclip adapter for Kilo CLI (kilo_local).
 * Spawns `kilo run --format json --auto` as a local process with
 * multi-provider model support via configured Kilo providers.
 */

export const type = "kilo_local" as const;
export const label = "Kilo (local)";
export const models: string[] = [];
export const agentConfigurationDoc = `Kilo CLI adapter for Paperclip. Spawns kilo run --format json --auto as a local process. Supports any model available through configured Kilo providers.

Required: model (provider/model format)
Optional: command, variant (reasoning effort), cwd, timeoutSec, graceSec, thinking, promptTemplate, bootstrapPromptTemplate, instructionsFilePath, extraArgs, env

Skills auto-load from ~/.claude/skills/ and ~/.opencode/skills/. Sessions persist in ~/.local/share/kilo/kilo.db.`;
