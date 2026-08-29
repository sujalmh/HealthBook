## 2026-08-28T21:03:34Z
You are worker_m2_labstory for CareCanvas.
Your working directory is /Users/sujal/Projects/proj1/.agents/worker_m2_labstory.
Your task is to implement Milestone 2 (LabStory & Longitudinal Biomarker Causal Engine) for CareCanvas per the specifications in:
1. /Users/sujal/Projects/proj1/.agents/ORIGINAL_REQUEST.md
2. /Users/sujal/Projects/proj1/PROJECT.md
3. /Users/sujal/Projects/proj1/.agents/spec_miner_survey_2/clinical_modules_spec.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Deliverables:
1. WebMCP Tools in `src/tools/labStoryTools.ts`:
   - `extract_labs`: Parses multi-year PDF/photo drops, normalizes units (e.g. mg/dL vs mmol/L), calculates 10% borderline flags, preserves reference/optimal ranges.
   - `correlate_meds`: Causal query engine analyzing biomarker trends vs medication timing, dosage changes, and adherence (e.g. glucose spikes vs prednisone, eGFR decline vs NSAIDs). Generates plain-language narrative, chart overlay bands, and doctor questions.
2. LabStory Visual Canvases & Components in `src/components/labstory/`:
   - `LabStoryView.tsx`: Main module dashboard with marker selector (Creatinine, eGFR, HbA1c, Fasting Glucose, Potassium, etc.), 30D/90D/1Y/5Y zoom filter, multi-doc drop zone, and story sentence banner.
   - `BiomarkerChart.tsx`: High-performance HTML5 Canvas / SVG responsive time-series chart with reference range shaded areas, optimal range toggles, interactive point hover/tap with value+date, and doctor pinned comments (📌).
   - `MedOverlayBands.tsx`: Colored timeline bands displaying active medications from LocalVault (e.g. Prednisone, Lisinopril, Metformin) aligned with the lab time axis.
   - `CausalQueryPanel.tsx`: "Ask Why" conversational input interface executing `correlate_meds`, displaying causal insights and suggested doctor questions with "Add to Question Bank" action.
   - `StorySentence.tsx`: Auto-generated clinical trajectory one-liners.
3. Integration with LocalVault & App:
   - Wire `LabStoryView` into `src/App.tsx` navigation tab.
   - Ensure labs and doctor comments persist to `LocalVault` object stores `labs` and `facts`.
4. Tests:
   - Write comprehensive unit & integration tests in `test/unit/labStory.test.ts` verifying unit normalization, borderline flagging, causal correlation logic, and range calculations.
   - Run `npm test` and `npm run build` to verify clean pass.

Write your handoff report to:
`/Users/sujal/Projects/proj1/.agents/worker_m2_labstory/handoff.md`.
