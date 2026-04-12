# Deployment — Inline Patches

Until Paperclip ships an external adapter plugin surface, kilo_local requires patching three compiled files.

## Patches Required

### 1. Adapter type enum (constants.js)
Add "kilo_local" to the adapter type array in @paperclipai/shared/dist/constants.js.

### 2. Adapter code (registry.js)
Inline the adapter (execute, testEnv, sessionCodec, listModels) into @paperclipai/server/dist/adapters/registry.js. Uses runChildProcess from adapter-utils.

### 3. UI bundle (index-*.js)
11 patch groups in 3 phases:
- Phase 1: Regex alias all opencode_local comparisons to also match kilo_local
- Phase 2: Explicit patches for arrays/sets/labels/dropdown/UI registry
- Phase 3: Options heading fixup

Critical: Phase 1 must run first on the clean file.

## After Paperclip Updates
All patches are lost. Re-apply in order (enum, registry, UI), then restart.
