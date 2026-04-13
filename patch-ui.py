#!/usr/bin/env python3
"""Patch Paperclip UI bundle to recognize kilo_local adapter.
Three phases: explicit patches, regex aliasing, fixup.
Run after install.sh. Idempotent on clean bundle."""
import sys, re, glob

base = glob.glob("/home/paperclip/.npm/_npx/*/node_modules/@paperclipai/server/ui-dist/assets/index-Br2N7xYL.js")
if not base:
    print("ERROR: UI bundle not found"); sys.exit(1)
UI = base[0]

with open(UI, "r") as f:
    c = f.read()

if c.count("kilo_local") > 5:
    print("Already patched (found kilo_local refs). Use clean bundle first."); sys.exit(0)

with open(UI + ".bak.pre-kilo", "w") as f:
    f.write(c)
print(f"Backup: {UI}.bak.pre-kilo")

count = 0
def p(label, old, new):
    global c, count
    n = c.count(old)
    if n == 0:
        print(f"  SKIP {label}")
        return
    c = c.replace(old, new)
    count += 1
    print(f"  OK   {label} ({n}x)")

print("=== Phase 1: Explicit patches ===\n")

p("type array", '"openclaw_gateway","hermes_local"]', '"openclaw_gateway","hermes_local","kilo_local"]')
p("selectable set", 'cJ=new Set(["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local"])', 'cJ=new Set(["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local","kilo_local"])')
p("coming soon gate", 'Lst=new Set(["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local"])', 'Lst=new Set(["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local","kilo_local"])')
p("Jfe capability set", 'Jfe=new Set(["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local"])', 'Jfe=new Set(["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local","kilo_local"])')
p("thinking variants", 'Xfe=new Set(["claude_local","codex_local","gemini_local","opencode_local","hermes_local"])', 'Xfe=new Set(["claude_local","codex_local","gemini_local","opencode_local","hermes_local","kilo_local"])')
p("display label", 'opencode_local:"OpenCode (local)"', 'opencode_local:"OpenCode (local)",kilo_local:"Kilo (local)"')
p("dropdown", '{value:"hermes_local",label:"Hermes Agent",icon:Yfe,desc:"Local multi-provider agent"}', '{value:"hermes_local",label:"Hermes Agent",icon:Yfe,desc:"Local multi-provider agent"},{value:"kilo_local",label:"Kilo",icon:XS,desc:"Local multi-provider agent (Kilo CLI)"}')
p("kilo UI object", 'OXe={type:"opencode_local",label:"OpenCode (local)",parseStdoutLine:SXe,ConfigFields:MXe,buildAdapterConfig:TXe}', 'OXe={type:"opencode_local",label:"OpenCode (local)",parseStdoutLine:SXe,ConfigFields:MXe,buildAdapterConfig:TXe},Z9Kilo={type:"kilo_local",label:"Kilo (local)",parseStdoutLine:SXe,ConfigFields:MXe,buildAdapterConfig:TXe}')
p("fhe array", 'fhe=[xZe,RZe,lXe,kXe,OXe,VXe,WZe,iet,dhe,xet]', 'fhe=[xZe,RZe,lXe,kXe,OXe,Z9Kilo,VXe,WZe,iet,dhe,xet]')
p("adapter array 7", '["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local"]', '["claude_local","codex_local","gemini_local","opencode_local","kilo_local","pi_local","cursor","hermes_local"]')
p("adapter array 8", '["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local","openclaw_gateway"]', '["claude_local","codex_local","gemini_local","opencode_local","kilo_local","pi_local","cursor","hermes_local","openclaw_gateway"]')
p("options heading", 'je==="opencode_local"?"OpenCode options":"Agent options"', 'je==="opencode_local"?"OpenCode options":je==="kilo_local"?"Kilo options":"Agent options"')

print(f"\n=== Phase 2: Regex — alias all opencode_local checks ===\n")
eq_n = len(re.findall(r'[\w.]+\s*===\s*"opencode_local"', c))
neq_n = len(re.findall(r'[\w.]+\s*!==\s*"opencode_local"', c))
c = re.sub(r'([\w.]+)==="opencode_local"', r'(\1==="opencode_local"||\1==="kilo_local")', c)
c = re.sub(r'([\w.]+)!=="opencode_local"', r'(\1!=="opencode_local"&&\1!=="kilo_local")', c)
print(f"  OK   Aliased {eq_n} === and {neq_n} !== comparisons")

print(f"\n=== Phase 3: Fixup options heading post-regex ===\n")
p("fix options heading post-regex",
    '(je==="opencode_local"||je==="kilo_local")?"OpenCode options":je==="kilo_local"?"Kilo options":"Agent options"',
    'je==="opencode_local"?"OpenCode options":je==="kilo_local"?"Kilo options":"Agent options"')

kilo_refs = c.count("kilo_local")
print(f"\nTotal: {count} patch groups applied. {kilo_refs} kilo_local references.")
with open(UI, "w") as f:
    f.write(c)
