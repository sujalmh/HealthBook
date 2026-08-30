# Milestone M3 — Hardening & Verification (R3 + R1+R2)

Goal: Generic wiring Settings>env no regression no hardcode + WebMCP 40 + 6-viewport + Success Auditor

DependsOn: [M2]
Workstreams: ws-m3-settings-ui (src/components/settings + src/core/settings + App.tsx main.tsx), ws-m3-verification (test/* vite.config verification snapshots opencode.json)
Status: pending
Acceptance: R3 grep VITE_AI >=1 .gitignore .env  no-hardcode 0 secret 0 lint0 build1660 test172 runner231 getTools40, Settings gate glob localStorage >=1, plus R1/R2 retained, 6-viewports no gaps, Success Auditor final PASS before Done
Gate: critic→challenger→auditor batch + Success Auditor Ralph Loop max3
