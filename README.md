# HealthBook agent-native patient health companion

Your health, all in one place. Medicines, labs and notes linked so you can understand them.

HealthBook is a client-side companion for patients and families. We built it to make discharge, weekly pill routines, lab follow-ups and caregiver help less scattered.

## Why we built it

We kept seeing the same gap after discharge. Lists did not match, follow-ups got lost, and families did the double entry. We wanted one place that remembers the source, tracks all the biomarkers across doctor followup and lab tests. We also wanted to improve patient compliance by keeping track of drug intake and their reactions, interactions. Doctors have to manage multiple patients; instead of going through multiple documents and multiple visits, HealthBook goes through the reports, and eases the workflow by zeroing in on the biomarkers which need attention.

## Features

- **PillMap**: A 7 by 4 grid for the week. Drag pills, see red arcs for drug interactions and amber badges for food timing like take with food or avoid grapefruit.
- **LabStory**: Drop five years of labs at once, normalizes units, draws one chart per marker with reference bands and zoom from 30 days to 5 years.
- **RxBridge**: Built for discharge. Loads your three lists, tags each med as Continued, Dose Changed, Stopped, New or Held, and walks you med by med in plain language.
- **HomeLab**: For the recheck in two weeks problem. Creates due cards with countdowns, lets you upload a phone photo of a slip, and keeps the timeline up to date.
- **Safety and Calendar**: Report a danger sign with a photo, get a triaged response, and keep follow-ups and lab due dates synced to your calendar.
- **Care Circle**: Link a caregiver with view only, manage or full; every action is logged on your behalf with a full audit.
- **Dossier**: Merges meds, labs, proposals, danger reports and calendar into one timeline plus a one-page emergency snapshot where each line links to the highlight on the original PDF.
- **Inspector**: See all 47 WebMCP tools, try them, and review pending approvals.

## Why WebMCP

We chose WebMCP because this work is not just answering questions. It is changing a real interface where timing matters and mistakes carry weight.

A typical discharge means comparing three medication lists, checking interactions against your actual OTCs and diet, and remembering a lab due in fourteen days. Doing that by copy paste into a chat window loses where each fact came from and still leaves you to retype everything into other apps.

With WebMCP the page holds the truth and the agent works on the page. You drop three PDFs, the agent extracts each fact with a highlight on the source and you approve each one. No retyping. You ask what changed, it walks through the nine meds one by one instead of making you click through six screens. You drag a pill and the agent can check interactions, show a ghost preview for a better time, and wait for your tap to apply it.

People and agents now do this together in one place. A patient can upload a lab photo from home, a doctor can pin a note to that exact dot on the chart and propose a dose change, and the patient or caregiver can approve on behalf and see the pillbox and chart update together. A family can also hand over to a new doctor without starting over, by granting time-bound access to the same compiled record. That joint work was hard before because the data was scattered and no agent could safely change a local app with a clear approval step. WebMCP gives us that gate, the same vault across sessions, and a way for the agent to discover tools through the browser instead of living in a separate window.

We find this setup calmer and more useful than a standalone chatbot. It is still not perfect and empty states are a bit rough. But the core flow feels closer to a conversation that leaves traces you can check.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build
npm run test     # 200 tests
```

Data lives in local storage for fast client-side offline-first interactions. If configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, it seamlessly syncs with Supabase Postgres for multi-profile authentication, cross-device persistence, and role-based sharing across care circles and physicians.

## License

MIT, see LICENSE at repo root. Copyright 2026 HealthBook contributors.
