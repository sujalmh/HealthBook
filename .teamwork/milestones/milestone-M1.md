# Milestone M1 — Intelligence Core (R1)

Goal: Generic AI client wrapper Settings>env, vision+text multimodal single response, structured generic, all image OCR via AI no hardcode

DependsOn: [M0]
Workstreams: ws-m1-ai-client (src/core/ai/**), ws-m1-extraction (src/tools/vaultTools, labStory, homeLab + vault DocumentDropzone + homelab UploadLabModal + types)
Status: pending
Acceptance: R1 grep gates env-config no-hardcode-provider configurable-read bbox vision structured no-hardcode-ocr + demo probe Fact[] mixed categories grounded bbox !=0.08 vision single request screenshots 1280/375/768 JFIF>5K + lint0 build1660 test172 runner231 getTools40
Gate: critic→challenger→auditor batch, re-captures 1280/375/768 + 6-viewport, FAIL repair max3
