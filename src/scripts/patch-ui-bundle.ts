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

import { readFileSync, writeFileSync, existsSync } from "fs";

const CHECK_MODE = process.argv.includes("--check");
const bundlePath = process.argv[2];

const filePath =
  bundlePath && !bundlePath.startsWith("--") ? bundlePath : process.argv[3];

if (!filePath) {
  console.error("Usage: node patch-ui-bundle.js <bundle-file> [--check]");
  console.error("       node patch-ui-bundle.js --check <bundle-file>");
  process.exit(1);
}

if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

let content = readFileSync(filePath, "utf8");

// === CHECK MODE ===
if (CHECK_MODE) {
  const checks: Array<{ name: string; test: () => boolean }> = [
    {
      name: "kilo_local in adapter enum",
      test: () => content.includes('"kilo_local"'),
    },
    {
      name: "Z9Kilo adapter definition",
      test: () => /\w+=\{type:"kilo_local"/.test(content),
    },
    {
      name: "Kilo display name",
      test: () => content.includes('kilo_local:"Kilo (local)"'),
    },
    {
      name: "Conditional wrapping",
      test: () =>
        /\w+==="opencode_local"\|\|\w+==="kilo_local"/.test(content),
    },
    {
      name: "Kilo dropdown entry",
      test: () => content.includes('value:"kilo_local",label:"Kilo"'),
    },
    {
      name: "Kilo thinking effort",
      test: () => /kilo_local:\[\{value:""/.test(content),
    },
  ];

  let pass = 0;
  for (const c of checks) {
    const ok = c.test();
    console.log(`  ${ok ? "✓" : "✗"} ${c.name}`);
    if (ok) pass++;
  }
  console.log(`\nUI bundle: ${pass}/${checks.length} checks passed`);
  process.exit(pass === checks.length ? 0 : 1);
}

// === PATCH MODE ===
if (content.includes("kilo_local")) {
  console.log("✓ UI bundle already patched (kilo_local found)");
  process.exit(0);
}

const original = content;
let patchCount = 0;

type SearchPattern = string | RegExp;

function patch(
  name: string,
  search: SearchPattern,
  replacement: string | ((...args: string[]) => string),
): boolean {
  if (typeof search === "string") {
    if (!content.includes(search)) {
      console.error(`✗ PATCH FAILED - anchor not found: ${name}`);
      console.error(`  Looking for: ${search.substring(0, 80)}...`);
      return false;
    }
    content = content.replace(search, replacement as string);
  } else {
    if (!search.test(content)) {
      console.error(`✗ PATCH FAILED - pattern not found: ${name}`);
      return false;
    }
    // Reset lastIndex after test() for global regexes
    search.lastIndex = 0;
    content = content.replace(
      search,
      replacement as (...args: string[]) => string,
    );
  }
  patchCount++;
  console.log(`  ✓ ${name}`);
  return true;
}

console.log("Patching UI bundle for kilo_local support...\n");

// ============================================================
// STEP 1: Structural additions
// These add new kilo_local entries in arrays, objects, and definitions.
// Must be done before conditional wrapping to avoid conflicts.
// ============================================================

// 1a. Main adapter type enum array — add "kilo_local" at end before closing bracket
patch("1a. Adapter type enum array", '"hermes_local"],', '"hermes_local","kilo_local"],');

// 1b. Upload-capable adapter Set (claude_local, codex_local, opencode_local)
patch(
  "1b. Upload adapter Set",
  /new Set\(\["claude_local","codex_local","opencode_local"\]\)/,
  'new Set(["claude_local","codex_local","opencode_local","kilo_local"])',
);

// 1c. Local adapter Set (claude_local, codex_local, gemini_local, opencode_local, pi_local, cursor, hermes_local)
const localAdapterSetPattern =
  /new Set\(\["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local"\]\)/g;
if (localAdapterSetPattern.test(content)) {
  localAdapterSetPattern.lastIndex = 0;
  content = content.replace(
    localAdapterSetPattern,
    'new Set(["claude_local","codex_local","gemini_local","opencode_local","kilo_local","pi_local","cursor","hermes_local"])',
  );
  patchCount++;
  console.log("  ✓ 1c. Local adapter Sets");
}

// 1d. Display name maps (opencode_local:"OpenCode (local)" — appears 2x)
const displayNamePattern = /opencode_local:"OpenCode \(local\)"/g;
const displayNameCount = (content.match(displayNamePattern) || []).length;
content = content.replace(
  displayNamePattern,
  'opencode_local:"OpenCode (local)",kilo_local:"Kilo (local)"',
);
if (displayNameCount > 0) {
  patchCount++;
  console.log(`  ✓ 1d. Display name map (${displayNameCount} occurrences)`);
}

// 1e. Adapter definition object — create Z9Kilo after the OpenCode adapter def
patch(
  "1e. Kilo adapter definition",
  /(\w+)=\{type:"opencode_local",label:"OpenCode \(local\)",(parseStdoutLine:\w+,ConfigFields:\w+,buildAdapterConfig:\w+)\}/,
  (_match: string, varName: string, sharedFields: string) =>
    `${_match},Z9Kilo={type:"kilo_local",label:"Kilo (local)",${sharedFields}}`,
);

// 1f. Register Z9Kilo in the adapter array — add before hermes adapter entry
patch(
  "1f. Register Z9Kilo in adapter array",
  /,([\w]+)=\{type:"hermes_local"/,
  (_match: string, hermesVar: string) =>
    `,Z9Kilo,${hermesVar}={type:"hermes_local"`,
);

// 1g. Dropdown option entries — add kilo option after opencode option
patch(
  "1g. Dropdown option entry",
  /(\{value:"opencode_local",label:"OpenCode[^"]*"[^}]+\})/g,
  (match: string) => {
    const iconMatch = match.match(/icon:(\w+)/);
    const icon = iconMatch ? iconMatch[1] : "XS";
    return `${match},{value:"kilo_local",label:"Kilo",icon:${icon},desc:"Local multi-provider agent (Kilo CLI)"}`;
  },
);

// 1h. Thinking effort options — add kilo_local array after opencode_local's
patch(
  "1h. Thinking effort options",
  /(opencode_local:(\[\{value:""[^\]]+\]))/,
  (_match: string, fullEntry: string, optionsArray: string) =>
    `${fullEntry},kilo_local:${optionsArray}`,
);

// ============================================================
// STEP 2: Special ternary cases
// These are places where kilo_local gets its own unique label/string,
// NOT a grouped || with opencode_local.
// Must be done BEFORE general conditional wrapping (step 3).
// ============================================================

// 2a. Options label ternary: "OpenCode options":"Agent options" → add kilo branch
patch(
  "2a. Options label ternary",
  /(\w+)==="opencode_local"\?"OpenCode options":"Agent options"/,
  (_match: string, varName: string) =>
    `${varName}==="opencode_local"?"OpenCode options":${varName}==="kilo_local"?"Kilo options":"Agent options"`,
);

// ============================================================
// STEP 3: General conditional wrapping
// Every remaining VAR==="opencode_local" gets wrapped to include kilo_local.
// Every remaining VAR!=="opencode_local" gets wrapped similarly.
// ============================================================

// 3a. Wrap === conditionals
let eqCount = 0;
content = content.replace(
  /(\w+)==="opencode_local"/g,
  (_match: string, varName: string) => {
    eqCount++;
    return `(${varName}==="opencode_local"||${varName}==="kilo_local")`;
  },
);
if (eqCount > 0) {
  patchCount++;
  console.log(`  ✓ 3a. Conditional === wrapping (${eqCount} occurrences)`);
}

// 3b. Wrap !== conditionals
let neqCount = 0;
content = content.replace(
  /(\w+)!=="opencode_local"/g,
  (_match: string, varName: string) => {
    neqCount++;
    return `(${varName}!=="opencode_local"&&${varName}!=="kilo_local")`;
  },
);
if (neqCount > 0) {
  patchCount++;
  console.log(`  ✓ 3b. Conditional !== wrapping (${neqCount} occurrences)`);
}

// ============================================================
// VALIDATION
// ============================================================

if (content === original) {
  console.error(
    "\n✗ No changes made — file may already be patched or anchors have changed",
  );
  process.exit(1);
}

const finalCount = (content.match(/kilo_local/g) || []).length;
console.log(
  `\n${patchCount} patch groups applied. ${finalCount} kilo_local references in output.`,
);

// Sanity check: brace count shouldn't change dramatically
const origBraces = (original.match(/\{/g) || []).length;
const newBraces = (content.match(/\{/g) || []).length;
if (Math.abs(origBraces - newBraces) > 20) {
  console.error(
    `\n⚠ WARNING: Brace count changed significantly (${origBraces} → ${newBraces}). Review output carefully.`,
  );
}

writeFileSync(filePath, content, "utf8");
console.log(`\n✓ Patched: ${filePath}`);
