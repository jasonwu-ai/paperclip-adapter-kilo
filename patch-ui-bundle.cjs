#!/usr/bin/env node
// patch-ui-bundle.js — Patches Paperclip UI bundle to add kilo_local adapter support
// Part of paperclip-adapter-kilo. Called by install.sh.
//
// Approach: On an UNPATCHED build, "opencode_local" exists throughout the UI bundle.
// This script adds "kilo_local" as a parallel adapter type that shares opencode_local's
// behavior everywhere except labels/display names.
//
// The script applies patches in a specific order:
//   1. Structural additions (adapter def, dropdown, display names, arrays, Sets, thinking effort)
//   2. Special ternary cases (where kilo gets its own label)
//   3. General conditional wrapping (=== and !==)
//
// Order matters: step 2 must happen before step 3 to avoid double-wrapping ternary cases.

const fs = require('fs');

const CHECK_MODE = process.argv.includes('--check');
const bundlePath = process.argv[2];

if (!bundlePath || bundlePath.startsWith('--')) {
  // If --check passed first, look for path as arg 3
  const altPath = process.argv[3];
  if (!altPath && !CHECK_MODE) {
    console.error('Usage: node patch-ui-bundle.js <bundle-file> [--check]');
    console.error('       node patch-ui-bundle.js --check <bundle-file>');
    process.exit(1);
  }
  if (!altPath) {
    console.error('Usage: node patch-ui-bundle.js --check <bundle-file>');
    process.exit(1);
  }
}

const filePath = bundlePath && !bundlePath.startsWith('--') ? bundlePath : process.argv[3];

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// === CHECK MODE ===
if (CHECK_MODE) {
  const checks = [
    { name: 'kilo_local in adapter enum', test: () => content.includes('"kilo_local"') },
    { name: 'Z9Kilo adapter definition', test: () => /\w+=\{type:"kilo_local"/.test(content) },
    { name: 'Kilo display name', test: () => content.includes('kilo_local:"Kilo (local)"') },
    { name: 'Conditional wrapping', test: () => /\w+==="opencode_local"\|\|\w+==="kilo_local"/.test(content) },
    { name: 'Kilo dropdown entry', test: () => content.includes('value:"kilo_local",label:"Kilo"') },
    { name: 'Kilo thinking effort', test: () => /kilo_local:\[\{value:""/.test(content) },
  ];
  let pass = 0;
  for (const c of checks) {
    const ok = c.test();
    console.log(`  ${ok ? '✓' : '✗'} ${c.name}`);
    if (ok) pass++;
  }
  console.log(`\nUI bundle: ${pass}/${checks.length} checks passed`);
  process.exit(pass === checks.length ? 0 : 1);
}

// === PATCH MODE ===
if (content.includes('kilo_local')) {
  console.log('✓ UI bundle already patched (kilo_local found)');
  process.exit(0);
}

const original = content;
let patchCount = 0;

function patch(name, search, replacement) {
  if (typeof search === 'string') {
    if (!content.includes(search)) {
      console.error(`✗ PATCH FAILED - anchor not found: ${name}`);
      console.error(`  Looking for: ${search.substring(0, 80)}...`);
      return false;
    }
    content = content.replace(search, replacement);
  } else {
    // Regex
    if (!search.test(content)) {
      console.error(`✗ PATCH FAILED - pattern not found: ${name}`);
      return false;
    }
    content = content.replace(search, replacement);
  }
  patchCount++;
  console.log(`  ✓ ${name}`);
  return true;
}

console.log('Patching UI bundle for kilo_local support...\n');

// ============================================================
// STEP 1: Structural additions
// These add new kilo_local entries in arrays, objects, and definitions.
// Must be done before conditional wrapping to avoid conflicts.
// ============================================================

// 1a. Main adapter type enum array
// Add "kilo_local" at end, before closing bracket
// Anchor: "hermes_local"], — the last adapter in the main enum
patch(
  '1a. Adapter type enum array',
  '"hermes_local"],',
  '"hermes_local","kilo_local"],'
);

// 1b. Upload-capable adapter Set (claude_local, codex_local, opencode_local)
// Anchor: unique Set with exactly these 3 adapters
patch(
  '1b. Upload adapter Set',
  /new Set\(\["claude_local","codex_local","opencode_local"\]\)/,
  'new Set(["claude_local","codex_local","opencode_local","kilo_local"])'
);

// 1c. Local adapter Set (claude_local, codex_local, gemini_local, opencode_local, pi_local, cursor, hermes_local)
// This appears in multiple places — patch all occurrences
// Anchor: Set with these specific adapters
const localAdapterSetPattern = /new Set\(\["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local"\]\)/g;
if (localAdapterSetPattern.test(content)) {
  content = content.replace(
    /new Set\(\["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local"\]\)/g,
    'new Set(["claude_local","codex_local","gemini_local","opencode_local","kilo_local","pi_local","cursor","hermes_local"])'
  );
  patchCount++;
  console.log('  ✓ 1c. Local adapter Sets');
}

// 1d. Display name maps (opencode_local:"OpenCode (local)" — appears 2x)
// Add kilo entry after each occurrence
const displayNameCount = (content.match(/opencode_local:"OpenCode \(local\)"/g) || []).length;
content = content.replace(
  /opencode_local:"OpenCode \(local\)"/g,
  'opencode_local:"OpenCode (local)",kilo_local:"Kilo (local)"'
);
if (displayNameCount > 0) {
  patchCount++;
  console.log(`  ✓ 1d. Display name map (${displayNameCount} occurrences)`);
}

// 1e. Adapter definition object — create Z9Kilo after the OpenCode adapter def
// The OpenCode def looks like: VARNAME={type:"opencode_local",label:"OpenCode (local)",parseStdoutLine:FN1,ConfigFields:FN2,buildAdapterConfig:FN3}
// We duplicate it with kilo names, reusing the same functions
patch(
  '1e. Kilo adapter definition',
  /(\w+)=\{type:"opencode_local",label:"OpenCode \(local\)",(parseStdoutLine:\w+,ConfigFields:\w+,buildAdapterConfig:\w+)\}/,
  (match, varName, sharedFields) => {
    // Keep original, add Z9Kilo after
    return `${match},Z9Kilo={type:"kilo_local",label:"Kilo (local)",${sharedFields}}`;
  }
);

// 1f. Register Z9Kilo in the adapter array
// The adapter array contains the opencode var followed by others
// We need to find the array and add Z9Kilo after the opencode entry
// Anchor: the opencode adapter var is followed by a comma and the next adapter var
// Since we just created Z9Kilo, find the array that contains the opencode adapter def var
// Pattern: look for the array that has the opencode def var (captured in 1e)
// We need to find the adapter array. It looks like: [var1,var2,...,openCodeVar,nextVar,...]
// Since variable names change, find the array by looking for the pattern after "Z9Kilo" definition
// Actually, easier: find the array entry for the hermes adapter (stable label) and add Z9Kilo before it
patch(
  '1f. Register Z9Kilo in adapter array',
  /,([\w]+)=\{type:"hermes_local"/,
  (match, hermesVar) => `,Z9Kilo,${hermesVar}={type:"hermes_local"`
);

// 1g. Dropdown option entries — add kilo option after opencode option
// Pattern: {value:"opencode_local",label:"OpenCode",icon:ICONVAR,desc:"..."}
// There might be a slightly different format. Let's be flexible:
patch(
  '1g. Dropdown option entry',
  /(\{value:"opencode_local",label:"OpenCode[^"]*"[^}]+\})/g,
  (match) => {
    // Extract the icon variable used by opencode
    const iconMatch = match.match(/icon:(\w+)/);
    const icon = iconMatch ? iconMatch[1] : 'XS';
    return `${match},{value:"kilo_local",label:"Kilo",icon:${icon},desc:"Local multi-provider agent (Kilo CLI)"}`;
  }
);

// 1h. Thinking effort options — add kilo_local array after opencode_local's
// opencode_local has options like: [{value:"",label:"Default"},{value:"minimal",...},...]
// We need to find the opencode effort options and duplicate for kilo
patch(
  '1h. Thinking effort options',
  /(opencode_local:(\[\{value:""[^\]]+\]))/,
  (match, fullEntry, optionsArray) => {
    return `${fullEntry},kilo_local:${optionsArray}`;
  }
);

// ============================================================
// STEP 2: Special ternary cases
// These are places where kilo_local gets its own unique label/string,
// NOT a grouped || with opencode_local.
// Must be done BEFORE general conditional wrapping (step 3).
// ============================================================

// 2a. Options label ternary: "OpenCode options":"Agent options" → add kilo branch
patch(
  '2a. Options label ternary',
  /(\w+)==="opencode_local"\?"OpenCode options":"Agent options"/,
  (match, varName) => `${varName}==="opencode_local"?"OpenCode options":${varName}==="kilo_local"?"Kilo options":"Agent options"`
);

// ============================================================
// STEP 3: General conditional wrapping
// Every remaining VAR==="opencode_local" gets wrapped to include kilo_local.
// Every remaining VAR!=="opencode_local" gets wrapped similarly.
// ============================================================

// 3a. Wrap === conditionals
// Match word==="opencode_local" that is NOT already wrapped (no preceding ||)
// and NOT inside an object value context (those were handled in step 1)
let eqCount = 0;
content = content.replace(/(\w+)==="opencode_local"/g, (match, varName) => {
  eqCount++;
  return `(${varName}==="opencode_local"||${varName}==="kilo_local")`;
});
if (eqCount > 0) {
  patchCount++;
  console.log(`  ✓ 3a. Conditional === wrapping (${eqCount} occurrences)`);
}

// 3b. Wrap !== conditionals
let neqCount = 0;
content = content.replace(/(\w+)!=="opencode_local"/g, (match, varName) => {
  neqCount++;
  return `(${varName}!=="opencode_local"&&${varName}!=="kilo_local")`;
});
if (neqCount > 0) {
  patchCount++;
  console.log(`  ✓ 3b. Conditional !== wrapping (${neqCount} occurrences)`);
}

// ============================================================
// STEP 4: Remaining list/array entries
// Catch any adapter lists that include opencode_local in a comma-separated
// string pattern but weren't caught by the Set patches above.
// ============================================================

// 4a. Adapter list in conditional chains (codex_local||gemini_local||hermes_local||opencode_local||pi_local||cursor)
// These should already be handled by step 3's === wrapping, so no action needed.

// ============================================================
// VALIDATION
// ============================================================

if (content === original) {
  console.error('\n✗ No changes made — file may already be patched or anchors have changed');
  process.exit(1);
}

// Count final kilo_local references
const finalCount = (content.match(/kilo_local/g) || []).length;
console.log(`\n${patchCount} patch groups applied. ${finalCount} kilo_local references in output.`);

// Sanity check: the file should still be valid-ish JS (same number of braces)
const origBraces = (original.match(/\{/g) || []).length;
const newBraces = (content.match(/\{/g) || []).length;
if (Math.abs(origBraces - newBraces) > 20) {
  console.error(`\n⚠ WARNING: Brace count changed significantly (${origBraces} → ${newBraces}). Review output carefully.`);
}

// Write patched file
fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n✓ Patched: ${filePath}`);
