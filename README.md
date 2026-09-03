# HealthBook

**Agent-native health companion connecting clinical records, medication regimens, and biomarker trends through WebMCP.**

HealthBook is an open-source, client-first clinical health platform designed for patients, family caregivers, and physicians. Instead of isolated chatbots or disconnected portals, HealthBook exposes **47 in-browser WebMCP tools** directly onto interactive medical interfaces — allowing AI agents to read grounded records, suggest medication schedules, detect adverse interactions, and propose dose adjustments with clear human-in-the-loop oversight.

---

## ⚡ The Problem & The WebMCP Solution

### The Breakdown in Modern Care
* **Post-Discharge Chaos**: Patients leave the hospital with 3 conflicting medication lists (prior home meds, in-hospital changes, discharge orders) leading to dangerous duplications and unmanaged contraindications.
* **Scattered Biomarkers**: Years of lab results remain trapped in fragmented PDFs with varying measurement units and inconsistent reference intervals.
* **Doctor Cognitive Overload**: Managing complex polypharmacy across dozens of patients forces physicians to manually cross-check dozens of documents to identify why a critical kidney or cardiac biomarker crashed.

### Why WebMCP?
Traditional LLM healthcare chats rely on passive question-answering. WebMCP bridges LLMs directly to the live browser runtime:
* **The Page Holds the Ground Truth**: Medical records, verified lab draws, and active prescriptions live in client state.
* **Bidirectional Interaction**: When an agent assesses an eGFR drop or potassium spike, it does not merely output text — it calls registered tools (`suggest_schedule`, `propose_dosage_change`, `flag_interaction`) to manipulate the interactive canvas.
* **Strict Human-in-the-Loop Governance**: Any impactful action (dose modifications, schedule shifts, medication deletions) routes through a human approval gate with before/after visual previews and one-click confirmations.

---

## 🚀 Key Modules & Capabilities

### 💊 1. PillMap — 7×4 Interactive Medication Scheduler
* **Visual Drug Scheduling**: A 7-day × 4-slot (Morning, Noon, Evening, Bedtime) interactive canvas supporting drag-and-drop pill administration.
* **Safety SVG Arcs**: Dynamic real-time visual arcs highlighting contraindications and major/moderate drug-drug interactions directly between pills.
* **Dietary & Administration Badges**: Automatic flags for food timing ("Take with food", "Take on empty stomach") and food-drug clashes (e.g., grapefruit CYP3A4 inhibition, dairy chelation).
* **AI Schedule Optimization**: WebMCP agents evaluate adherence chronotypes, split morning loads to reduce pill burden, and optimize spacing between interacting compounds.

### 📈 2. LabStory — Longitudinal Biomarker Intelligence
* **Multi-Year Lab Ingestion**: Drop multiple unstructured lab report PDFs at once; automatically extracts, categorizes, and normalizes disparate units (e.g., mg/dL vs. mmol/L).
* **Interactive Trend Charts**: Timeline visualizations with clinical reference ranges and zoom controls spanning 30 days to 5 years.
* **Medication Correlation Overlays**: Visual bands overlaid directly on lab graphs showing exactly when medications were started, adjusted, or stopped — instantly exposing causal relationships (e.g., ACE inhibitor initiation vs. creatinine bump).
* **Causal Reasoning Engine ("Ask Why")**: Ask natural-language clinical questions (e.g., *"Why did my eGFR drop?"*); the engine correlates chronological medication changes with biomarker shifts and generates structured questions for doctor visits.

### 🌉 3. RxBridge — 3-List Discharge Reconciliation
* **Automated Reconciliation**: Compares Pre-Admission, In-Hospital, and Discharge orders into unified categories: *Continued*, *Dose Changed*, *Stopped*, *New*, or *Held*.
* **Step-by-Step Patient Walkthrough**: Guided, plain-language walkthrough explaining the medical rationale behind each prescription transition.
* **Adherence Simulator**: Simulates weekly schedule stability, flagging high-risk dosing friction before the patient leaves the clinic.
* **Pharmacist & Patient Summaries**: Export clean, standardized reconciliation summaries formatted for community pharmacies and clinical handoffs.

### 🧪 4. HomeLab — Closed-Loop Remote Monitoring
* **Lab Due-Date Tracking**: Automated countdown cards for required re-checks (e.g., "Repeat serum potassium in 14 days").
* **Phone Slip Capture**: Rapid mobile photo/scan upload of outpatient laboratory result sheets.
* **Physician Review & Proposals**: Doctors can annotate specific lab points, add clinical commentary, and submit dosage adjustments straight into the patient's pending queue.

### 🛡️ 5. Safety & Calendar — Acute Triage & Protocol Sync
* **Danger Sign Reporting**: Patients report red-flag symptoms with vitals and photos; triage algorithms categorize priority (Emergency, Urgent, Routine) and alert the care team.
* **ICS Calendar Synchronization**: Two-way export syncing upcoming medication re-checks, appointments, and lab draws directly to Apple Calendar, Google Calendar, or Outlook (.ics).

### 👥 6. Care Circle & Dossier — Multi-Role Collaboration
* **Role-Based Access Control (RBAC)**: Support for Patients, Family Caregivers, and Doctors with granular permissions (`view_only`, `manage`, `full`).
* **Audit Trail**: Full transparency logging every action taken on behalf of a patient.
* **Emergency Dossier**: One-click generation of an emergency summary card linking clinical facts back to bounding-box highlights on original source records.
* **Physician Multi-Patient View**: Specialist dashboard allowing cardiologists and nephrologists to switch between active patients, review out-of-range indicators, and issue updates.

### 🛠️ 7. WebMCP Inspector
* Inspect and test all **47 registered WebMCP tools** directly within the application.
* Review real-time invocation parameters, response payloads, execution timing, and pending approval queues.

---

## 🛠️ Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    HealthBook Web UI                         │
│   (React 18 + TypeScript + Vite + Tailwind CSS + Lucide)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌────────────────────────┐              ┌──────────────────┐
│   WebMCP Engine        │              │  LocalVault      │
│  - 47 Registered Tools │              │  - State Store   │
│  - Spec Polyfill       │◄────────────►│  - Event Bus     │
│  - Human Approval Gate │              │  - FHIR Exporter │
│  - Execution Context   │              └─────────┬────────┘
└───────────┬────────────┘                        │
            │                                     │ Optional Sync
            ▼                                     ▼
┌────────────────────────┐              ┌──────────────────┐
│  AI / Search Proxies   │              │  Supabase        │
│  - Claude / GPT / Gemini│             │  - Postgres DB   │
│  - Exa Neural Grounding│              │  - Auth & RBAC   │
│  - Tesseract/Vision OCR│              │  - Audit Logs    │
└────────────────────────┘              └──────────────────┘
```

* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS.
* **WebMCP Core**: Native `document.modelContext` integration with backwards-compatible polyfill, typed schemas, and human approval gates.
* **Clinical Intelligence**: Heuristic safety checks + LLM structured completion (Claude, OpenAI, Gemini) + Exa neural medical grounding.
* **Persistence & Sync**: Offline-first client architecture with optional Supabase PostgreSQL sync for secure multi-tenant authentication, cross-device sync, and doctor-patient relationships.

---

## 💻 Getting Started

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sujalmh/HealthBook.git
   cd HealthBook
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment (Optional)**:
   Create a `.env` file in the root directory if connecting Supabase or external AI backends:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_EXA_API_KEY=your_exa_api_key
   ```
   *(Note: HealthBook is fully functional offline using local mock stores if credentials are not provided.)*

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

5. **Run test suite**:
   ```bash
   npm run test
   ```
   Executes 200 unit and integration tests across all modules.

---

## 🧪 WebMCP Tool Surface (47 Tools)

HealthBook exposes an extensive clinical toolset categorized across core domains:

| Domain | Key Tools | Function |
|---|---|---|
| **PillMap** | `suggest_schedule`, `check_interactions`, `check_diet_interactions`, `simulate_adherence` | Rebalances daily pill distributions and flags pharmacological/food conflicts. |
| **LabStory** | `extract_labs`, `correlate_meds` | Discovers lab draws from PDFs and maps biomarker trajectories against medication changes. |
| **RxBridge** | `explain_med_change`, `flag_interaction`, `suggest_question_for_doctor` | Decodes discharge deltas and formulates targeted consultation questions. |
| **HomeLab** | `upload_lab_image`, `propose_dosage_change`, `approve_dosage_change`, `sync_pillmap_from_proposal` | Facilitates doctor-patient remote lab review and closed-loop regimen adjustments. |
| **Safety** | `report_danger_sign`, `notify_doctor`, `doctor_change_dose`, `sync_to_calendar` | Clinical triaging, emergency notification, and schedule synchronization. |
| **Care Circle** | `grant_caregiver_access`, `act_on_behalf`, `switch_profile`, `link_patient` | Manages role-based delegation, patient linking, and audit trails. |
| **Doctor** | `link_doctor`, `list_doctor_patients`, `view_patient_as_doctor` | Specialist workflows for cohort overview and cross-patient chart inspection. |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
