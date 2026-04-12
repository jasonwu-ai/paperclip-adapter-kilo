#!/usr/bin/env node
/**
 * patch-ui-bundle.ts — Patches Paperclip UI bundle to add kilo_local adapter support
 * Part of paperclip-adapter-kilo. Called by install.sh.
 *
 * Approach: On an UNPATCHED build, "opencode_local" exists throughout the UI bundle.
 * This script adds "kilo_local" as a parallel adapter type that shares opencode_local's
 * behavior everywhere except labels/display names.
 *
 * The script applies patches in a specific order:
 *   1. Structural additions (adapter def, dropdown, display names, arrays, Sets, thinking effort)
 *   2. Special ternary cases (where kilo gets its own label)
 *   3. General conditional wrapping (=== and !==)
 *
 * Order matters: step 2 must happen before step 3 to avoid double-wrapping ternary cases.
 */
export {};
//# sourceMappingURL=patch-ui-bundle.d.ts.map