#!/usr/bin/env python3
"""Patch Paperclip UI bundle to recognize kilo_local adapter.
Run after install.sh. Safe to re-run (idempotent on clean bundle)."""
import sys, glob

# Find UI bundle
base = glob.glob("/home/paperclip/.npm/_npx/*/node_modules/@paperclipai/server/ui-dist/assets/index-Br2N7xYL.js")
if not base:
    print("ERROR: UI bundle not found"); sys.exit(1)
UI = base[0]

with open(UI, "r") as f:
    c = f.read()

if "kilo_local" in c:
    print("Already patched, skipping."); sys.exit(0)

with open(UI + ".bak.pre-kilo", "w") as f:
    f.write(c)
print(f"Backup: {UI}.bak.pre-kilo")

count = 0
def p(label, old, new):
    global c, count
    n = c.count(old)
    if n == 0: print(f"  SKIP {label}"); return
    c = c.replace(old, new); count += 1
    print(f"  OK   {label} ({n}x)")

p("type array", '"openclaw_gateway","hermes_local"]', '"openclaw_gateway","hermes_local","kilo_local"]')
p("selectable set", 'cJ=new Set(["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local"])', 'cJ=new Set(["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local","kilo_local"])')
p("display label", 'opencode_local:"OpenCode (local)"', 'opencode_local:"OpenCode (local)",kilo_local:"Kilo (local)"')
p("dropdown", '{value:"hermes_local",label:"Hermes Agent",icon:Yfe,desc:"Local multi-provider agent"}', '{value:"hermes_local",label:"Hermes Agent",icon:Yfe,desc:"Local multi-provider agent"},{value:"kilo_local",label:"Kilo",icon:XS,desc:"Local multi-provider agent (Kilo CLI)"}')
p("kilo UI object", 'OXe={type:"opencode_local",label:"OpenCode (local)",parseStdoutLine:SXe,ConfigFields:MXe,buildAdapterConfig:TXe}', 'OXe={type:"opencode_local",label:"OpenCode (local)",parseStdoutLine:SXe,ConfigFields:MXe,buildAdapterConfig:TXe},Z9Kilo={type:"kilo_local",label:"Kilo (local)",parseStdoutLine:SXe,ConfigFields:MXe,buildAdapterConfig:TXe}')
p("fhe array", 'fhe=[xZe,RZe,lXe,kXe,OXe,VXe,WZe,iet,dhe,xet]', 'fhe=[xZe,RZe,lXe,kXe,OXe,Z9Kilo,VXe,WZe,iet,dhe,xet]')

print(f"\n{count} patches applied.")
with open(UI, "w") as f:
    f.write(c)

# 7. "Coming soon" gate — without this, kilo_local shows greyed out
p("coming soon gate",
    'Lst=new Set(["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local"])',
    'Lst=new Set(["claude_local","codex_local","gemini_local","opencode_local","pi_local","cursor","hermes_local","kilo_local"])')
