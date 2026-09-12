# CarbonBridge remaining work

Version 1.0 | 12 September 2026 | Inventory of what is **not yet built** against Architecture V2 and Implementation Plan V2

This document is a remaining-work ledger, not a claim that the prototype is incomplete as a demo. The current checkout is a **tested, software-only Node prototype**. The V2 architecture is still the production target. Use this file to decide what to build next; use [CARBONBRIDGE_IMPLEMENTATION_PLAN_V2.md](CARBONBRIDGE_IMPLEMENTATION_PLAN_V2.md) for the original phase definitions.

Governing design: [CARBONBRIDGE_ARCHITECTURE_V2.md](CARBONBRIDGE_ARCHITECTURE_V2.md)  
Regression baseline: [CARBONBRIDGE_ARCHITECTURE.md](CARBONBRIDGE_ARCHITECTURE.md) and [CARBONBRIDGE_IMPLEMENTATION_PLAN.md](CARBONBRIDGE_IMPLEMENTATION_PLAN.md)  
How to run the prototype: [../README.md](../README.md)

---

## 0. Snapshot of what already exists

Do not treat the items below as remaining work. They are the current vertical slice.

| Area | What works today | Where |
|---|---|---|
| Runtime | Dependency-free Node 20 API + vanilla JS web preview. No `npm install`, no LLM key, no application Docker image. | `apps/api`, `apps/web` |
| Marketplace spine | Listing create / versioned PATCH / publish / archive; requirement create / PATCH; public-safe listing summaries. | `apps/api/src/domain/listings.js`, `requirements.js`, `apps/api/src/app.js` |
| Matching | Hard compatibility gates, delivered-cost formula, ranking groups `compatible` / `needs_evidence` / `incompatible`. | `apps/api/src/domain/matching.js` |
| Requests | Submit, accept, decline, cancel; version checks; idempotency; reservation increment. | `apps/api/src/domain/requests.js` |
| Process discovery | Keyword catalog; candidates with `quantity: null`, `price: null`, `canPublish: false`. | `apps/api/src/domain/process-discovery.js` |
| Assistant | Heuristic regex intents; typed cards; hashed action preview; confirm-to-write for requirement, listing draft, submit request, accept request. | `apps/api/src/domain/assistant.js` |
| SSE (server) | `POST /api/v1/conversations/{id}/messages/stream` emits workflow events. | `apps/api/src/app.js` |
| Web preview | Process, marketplace, buyer form, requests, assistant panel; same-origin `/api` proxy; fallback demo data if API is down. | `apps/web/src/main.js`, `apps/web/server.mjs` |
| Contracts | JSON Schemas for records, intent envelope, actions, tools, SSE, capability-parity. | `contracts/v2/` |
| Fixtures | 16 files, 222 records, 60 eval cases, seed 26, clock `2026-09-12T00:00:00Z`. | `data/fixtures/v2/` |
| Checks | `npm run check:all` = platform fixtures + API tests + web string markers. CI runs that suite. | `package.json`, `.github/workflows/platform-checks.yml` |

**Important boundary:** the prototype uses an in-memory store and a heuristic assistant. It is a demonstration and contract reference, not a production deployment.

---

## 1. How to read this ledger

Each remaining item is tagged:

| Tag | Meaning |
|---|---|
| **Must-have** | Needed for an honest, judge-proof demo of the current slice, or for the V2 “initial” product gate. |
| **Should-have** | Completes a phase that already has a partial implementation. |
| **Nice-to-have** | Academic V2 / polish. |
| **Pilot / later** | Production path (Postgres, OIDC, LLM, backups). Do not start these before the demo slice is truthful. |

Status words:

- **Missing** — no product path (route, UI, or service).
- **Stub** — file or class exists but does not do the planned work.
- **Partial** — some of the planned behavior exists; named gaps remain.
- **Data only** — fixtures exist; runtime does not load or use them.
- **Decorative** — UI is visible but does not call a service.

---

## 2. Planned stack vs current stack

Implementation Plan V2 §20 recommends React + Vite + FastAPI + PostgreSQL + Alembic + OIDC + Playwright + an LLM adapter. The checkout does **not** implement that stack.

| Planned | Current | Remaining |
|---|---|---|
| FastAPI, Pydantic, SQLAlchemy, Alembic | Node `http` in `apps/api/src/server.js` + `app.js` | Entire Python API lane |
| PostgreSQL + non-owner role + migrations | In-memory `Store`; `PostgresPersistence` is a contract stub | Real DB adapter, schema, transactions, locks |
| OIDC sessions, CSRF, secure cookies | `x-demo-user` / `x-demo-organization` headers | Real identity; **must remove demo headers** before any shared deploy |
| React / TypeScript / Vite / TanStack Query | Live UI is string-templated `apps/web/src/main.js` | Wire `App.tsx` + `main.tsx` + `vite.config.ts`, or delete the unused draft |
| OpenAPI | None | Generate and check `contracts/openapi.yaml` against routes |
| LLM provider adapter (OpenAI Responses API, typed tools) | `provider: 'heuristic-demo'` regex intents | Provider interface, timeouts, eval harness, kill switch |
| Private object storage | None | Evidence upload, scanning, ACL |
| Durable jobs / outbox / worker | In-process memory | Job leases, retry, unknown-outcome reconciliation |
| Docker app images | Compose is **Postgres 16 only** | API/web/worker images, staging/pilot environments |
| Playwright E2E + eval runner | String-marker web check; fixture JSON validation | Browser journeys; executed 60-case report |

`infra/docker-compose.demo.yml` does not run the application. `scripts/seed-demo.mjs` prints a dry-run plan (`mode: "dry_run_fixture_adapter"`). It does **not** populate the running API. Runtime seed is `apps/api/data/demo/marketplace.json`.

---

## 3. Remaining work by V2 phase

### Phase 1 — Foundation, contracts, secure identity

**Objective from the plan:** authenticated organizations, role/capability checks, health, frozen baseline contracts, working DB.

| Remaining item | Status | Notes |
|---|---|---|
| OIDC / session / CSRF | Missing | Demo headers in `apps/api/src/infra/auth.js` |
| Canonical OpenAPI + decimal/error conventions as generated contract | Missing | Live API is camelCase envelopes `{ data, requestId }`; V2 schemas are snake_case + UUIDv5 |
| PostgreSQL + Alembic + non-owner application role | Stub | `apps/api/src/infra/persistence.js`; compose password `CARBONBRIDGE_DEMO_DB_PASSWORD` |
| Role-aware React shell, org switcher, loading/error/permission states | Partial | Live shell hardcodes “Aster Fermentation / Ananya Shah”; actor switch is `?user=` only |
| Serve `/capabilities` and the capability-parity manifest | Partial | Product route is `GET /api/v1/assistant/capabilities`. `contracts/v2/capability-manifest.json` is a schema, not a served document |
| Secret scan, CSRF tests, full tenant capability matrix | Missing | Process isolation is tested (buyer 404 on seller process); not a full matrix |

**Exit gate still open:** a user can access only authorized organization data through a real session, and the public contract is frozen.

### Phase 2 — Complete manual marketplace

**Objective:** marketplace usable with no AI.

| Remaining item | Status | Notes |
|---|---|---|
| Supplier listing editor / detail page | Missing in UI | API: `POST/PATCH /api/v1/listings`, publish, archive. “＋ Create a listing” routes to process, not an editor |
| Listing detail deep link `/listings/:id` | Missing in UI | Cards select locally; “View details” is not a real record page |
| Buyer requirement form completeness | Partial | UI posts quantity, month, purity. Missing impurity limits, physical form, distance, budget, site, window dates |
| Marketplace search/filter/pagination | Partial / decorative | Text search is client-side. Material / Quality / Availability buttons do nothing. API filter is `state`, `sourceIndustry` only. No pagination |
| Saved searches | Missing | |
| Public vs private projections in UI | Partial | API has owner draft vs public-safe summaries; UI does not explain unpublished drafts |
| Keyboard / narrow-screen marketplace editor | Missing | Preview is desktop-first |

**Exit gate still open:** a supplier publishes a record and a buyer searches and saves a full requirement through **normal screens**, with no mock UI response.

### Phase 3 — Quality, matching, economics, requests

**Objective:** V1 decision path — pass/fail/unknown quality, ranking, compare, gaps, receipts, atomic accept.

| Remaining item | Status | Notes |
|---|---|---|
| V1 golden ranking S01–S08 in the live seed | Missing | Runtime seed has **four** streams (`stream-a`, `stream-d`, `stream-f`, unknown-quality). Tests expect 2 compatible / 1 needs evidence / 1 incompatible. Stream F fails CO (7000 vs 5000 ppmv), so V1 order A→D→F is **not** reproduced |
| Same-basis conversion (wet/dry) | Missing | Analyte match is exact `analyte\|unit\|basis`. No `BASIS_NOT_COMPARABLE` path |
| Decimal arithmetic | Partial | Money is integer paise; `apps/api/src/domain/numeric.js` uses JS `Number`, not decimal |
| Match result page with check rows | Missing in UI | API: `POST /api/v1/matches/run`, `GET /api/v1/matches/{id}` |
| Compare up to three options | Partial API / missing UI | Assistant can compare; no `/compare` page |
| Quality-gap explanation panel | Partial API / missing UI | Groups exist; V1 S02 shortage, S03 purity, S05 moisture, S07 missing, S08 expiry are not in the demo seed |
| Alternative buyers | Partial API | `POST /listings/{id}/alternative-buyers`. Seed has one published requirement, so results are usually empty. No UI |
| What-if scenarios | Partial API | `POST /matches/{id}/scenarios`. No UI |
| Immutable decision receipt in UI | Partial API | `GET /matches/{id}/receipt`. No dedicated receipt screen |
| Concurrent 60 t vs 100 t accept | Missing | In-memory `transaction()` is a no-op. Not in `apps/api/tests/api.test.js` |
| Database locking / replay-once allocation | Missing | Restart loses reservations |

**Exit gate still open:** two simultaneous 60 t accepts against 100 t allocate 60 t once; historical receipts stay immutable after edits.

### Phase 4 — NGO, evidence, policy

**Entire phase is remaining as product.** Fixtures exist; no API routes, no real UI.

| Remaining item | Status | Notes |
|---|---|---|
| NGO projects, review, participation | Missing | Demo seed has `org-climateworks` / `user-reviewer` unused by product flows |
| Internal targets and action plans | Missing | |
| Material-flow events and impact claims | Missing | Must not treat accept = delivery or reuse = avoidance |
| Evidence upload, scan, review, ACL | Missing / decorative | Evidence vault in `apps/web/src/main.js` (`evidenceView`) is static copy: “42% ready”, “Upload evidence” |
| Policy library, jurisdiction/as-of screening | Data only | `data/fixtures/v2/policy_rules.json`, `policy_scenarios.json`. No `/policies` or `/screenings` |

**Exit gate still open:** unsupported policy questions return explicit unknown; no invented carbon-credit eligibility.

### Phase 5 — Process discovery data, knowledge, market evidence

| Remaining item | Status | Notes |
|---|---|---|
| Manual process editor (versioned steps, confirm extracted fields) | Partial | Analyze posts to `POST /api/v1/processes/discover`. No versioned process editor, no step CRUD |
| Evidence checklist wired to real evidence items | Decorative | Hardcoded rows in the evidence view |
| Reviewed source retrieval / RAG with ACL | Data only | 12 sources, 12 documents, 48 chunks in `data/fixtures/v2/`. Runtime seed has **no** knowledge tables |
| Price observation search | Data only | Matching uses rate card + distance matrix, not `price_observations.json` |
| Six curated process families in the **running** store | Data only | Fixtures have 6 profiles / 12 scenarios. API catalog is keyword-based and separate |
| Load V2 fixtures into the API | Missing | Two datasets: UUIDv5 package vs human-readable `marketplace.json`. They are not synced |
| Real seed adapter (not dry-run) | Stub | `scripts/seed-demo.mjs` |

**Exit gate still open:** a hypothesis cannot silently become verified stock **and** at least three curated families plus unknown/negative cases run through the live services.

### Phase 6 — Conversation foundation and read-only assistance

| Remaining item | Status | Notes |
|---|---|---|
| Real LLM adapter | Missing | Heuristic provider only |
| Conversation list / history persistence | Partial | In-memory conversations; no list page, no retention/deletion policy |
| SSE / streaming in the web client | Missing in UI | `apps/web/src/api.js` POSTs `/messages` only. No EventSource |
| Citations and source cards | Missing | No retrieval; answers are canned text + service payloads |
| “Second one” / entity context in UI | Partial API | `resolveMatchResult` handles ordinals; UI does not surface context chips |
| Org-switch invalidates conversation context | Missing | Query-param actor switch does not reset chat context |
| Provider timeout, token budget, retry/cancel | Missing | |
| Fabricated-result detection | Missing | |

**Exit gate still open:** user-visible answers identify record/source basis; unauthorized data never enters model context.

### Phase 7 — Safe tool actions and manual/chat parity

| Remaining item | Status | Notes |
|---|---|---|
| Publish listing via assistant | Missing | Writes today: create requirement, listing **draft**, submit request, accept request. Publication is manual API only |
| Central action gateway with payload/version hash re-check against dirty manual forms | Partial | Hashed 15-minute action records exist; no dirty-form banner, no `action_proposals` table |
| Undo for supported drafts | Missing | |
| Prompt-injection / tampered / expired / role-revoked approval suite | Missing | Not in API tests |
| Manual/chat command equivalence for every mutation | Partial | Four tools only. See §8 matrix below |
| Demo-mode commit refusal vs live confirm | Partial | Offline shell will not commit; if API is down the local `assistantResponse()` still talks as if it matched buyers |

**Exit gate still open:** zero unauthorized effects in an adversarial suite; model text alone cannot satisfy a sensitive approval.

### Phase 8 — Multi-step orchestration

**Entire phase is remaining** except a one-shot workflow row around a single intent.

| Remaining item | Status | Notes |
|---|---|---|
| Durable step graph, leases, checkpoints | Missing | `assistant.js` inserts `workflows`; not a graph |
| Resume / cancel APIs | Missing | Plan: `POST /workflows/{id}/resume`, `/cancel` |
| Discovery → evidence → draft → publish pipeline | Missing | |
| Buyer need → match → request as one orchestrated run | Partial | User must drive each step; no specialist registry |
| Crash-after-commit / duplicate-job / max-turn tests | Missing | |

**Exit gate still open:** process-to-listing and buyer-to-request demos complete through **both** interfaces without inventing evidence.

### Phase 9 — Analytics, reports, notifications

| Remaining item | Status | Notes |
|---|---|---|
| Source-backed analytics / report builder | Decorative | Reports view hardcodes 360 t / 85 t / 42 t / 78% |
| Notification inbox and preferences | Decorative | Bell button has a dot; no inbox |
| Saved searches / remaining-stock buyer tips | Missing | |
| Quote-provider adapter | Missing | |
| Outbox delivery after commit | Missing | |
| Dashboard numbers from stored snapshots | Partial | `GET /api/v1/dashboard` and `/activity` exist; UI does not use them as the reports page |

**Exit gate still open:** every chart/report reproduces from stored inputs; no LLM arithmetic.

### Phase 10 — Purchase planning and commercial extensions

**Entire phase is remaining.**

- Two-supplier plans and supplier-exclusion scenarios
- Versioned offers / counteroffers
- Accepted-request release (both parties)
- Dispatch / receipt / dispute / partial delivery
- Payment settlement (explicitly future even in the plan)

Request timeline copy already labels fulfillment as a later workflow step.

### Phase 11 — System assurance

- Executed 60-case eval dashboard (today the JSONL is **counted**, not run)
- Issue triage, source/rule review UI
- Privacy export / deletion
- Accessibility audit of manual and chat surfaces
- Load, restore-drill, rollback evidence
- Held-out real pilot tasks

V2 §17 thresholds (100% forbidden mutations, 95% tool accuracy, 95% citation coverage) are **unmeasured**.

### Phase 12 — Deployment and pilot

- Separate dev / staging / pilot environments
- Immutable API/worker images, one migration job
- Same-origin HTTPS, CSP, secure cookies
- Managed PostgreSQL, encrypted backups, restore
- `ASSISTANT_ENABLED` / `DEMO_MODE` flags actually read by the Node API (today they are documentation for a future FastAPI lane)
- Operations handbook, secret rotation, named owner sign-off

---

## 4. Remaining work by product surface

### 4.1 Backend routes that the plan names but the API does not serve

Present in Architecture V2 / Implementation Plan V2, **absent** from `apps/api/src/app.js`:

- `/capabilities` (distinct from `/api/v1/assistant/capabilities`)
- `/projects`, `/review`, `/participations`
- `/policies`, `/screenings/{id}`
- `/knowledge/search`, `/price-observations`
- `/processes/{id}` versioned updates beyond GET + discover
- `/workflows/{id}/resume`, `/workflows/{id}/cancel`
- `/reports`, `/notifications`, `/notification-preferences`, `/saved-searches`
- `/purchase-plans`, `/offers`, `/release-requests`, `/fulfillments`, `/disputes`
- Evidence upload / review endpoints
- OpenAPI document

Existing but unused by the UI: `/api/v1/dashboard`, `/api/v1/activity`, match receipt, match scenarios, alternative buyers, listing-draft GET/PATCH, SSE stream.

### 4.2 Web UI remaining

Live entry is `apps/web/index.html` → `apps/web/src/main.js`. React (`App.tsx`) is an unused draft.

**Pages that exist as routes but are not product-complete:**

| Route | What is real | What is left |
|---|---|---|
| `/` Overview | Layout, process-first copy | Live metrics, org-accurate identity |
| `/processes` | Analyze → API discover | Step editor, evidence wiring, promote-to-listing editor |
| `/marketplace` | API listings + client search | Filters, pagination, detail, compare, request-from-card |
| `/requirements/new` | Partial form + match run | Full specification fields |
| `/requests` | Accept/decline against API | Review page, receipt, timeline events |
| `/evidence` | Decorative | Real checklist, upload, review states |
| `/reports` | Decorative | Snapshot-backed charts, provenance drawer |
| `/assistant` | Live messages when API is up | SSE, citations, conversation list, context chips |

**Controls that look interactive and are not:**

- Material / Quality / Availability filter chips
- Upload evidence
- New report / report period selector
- Settings
- Notifications bell
- Workspace switcher
- Attach file and voice input in the composer
- Demand-by-month chart bars
- Hardcoded “Verified evidence” on fallback listings (API seed quality can be `self_reported`)

**Identity remaining:** switching `?user=user-seller` does not update the branded sidebar (still Ananya Shah / Aster Fermentation). Seller vs buyer vs reviewer is easy to miss in a demo.

**Fallback remaining:** if the API is down, hardcoded listings (Aster / Prithvi / Kaveri, 96% fit) **contradict** the live seed (CarbonStone `stream-a/d/f`). Judges will see two products.

### 4.3 Assistant remaining

Implemented intents (heuristic): discover process, prepare listing draft, create requirement (may ask missing fields), find/compare matches, prepare request, accept request, confirm/cancel, explain, clarify.

**Not implemented as tools:**

- Policy screening
- Knowledge / citation search
- Analytics / report draft
- NGO / targets
- Publish listing
- Admin / source review
- Notifications
- Purchase planning
- Evidence upload

Capability example file (`contracts/v2/capability-manifest.json.example`) lists several of those as if they were product capabilities. They are not.

### 4.4 Data remaining

| Dataset | Exists? | Loaded by API? |
|---|---|---|
| `apps/api/data/demo/marketplace.json` | Yes | Yes (boot and `POST /api/v1/demo/seed`) |
| `data/fixtures/v2/*` (222 records) | Yes | No |
| Knowledge chunks / documents | Yes | No |
| Policy rules / scenarios | Yes | No |
| Price observations | Yes | No |
| 60-case `assistant_eval_set.jsonl` | Yes | Validated as JSON only |
| V1 S01–S08 golden marketplace | In V1 docs | No |

Remaining data work: one store, one seed command that actually writes, labels on every synthetic number, clock-stable quality expiry (`stream-d` quality expires `2026-09-28` — a later machine clock drops D into unknown).

### 4.5 Tests remaining

| Planned | Current | Remaining |
|---|---|---|
| API buyer-to-seller journey | 11 cases in `apps/api/tests/api.test.js` | Concurrent accept, action tamper/expiry, publish-without-quality, reviewer role, wet/dry, S01–S08 |
| Platform fixture validation | `tests/platform/v2-fixtures.test.mjs` | Bind fixtures to the running matcher |
| Web check | `apps/web/scripts/check.mjs` string markers | Real UI tests |
| Playwright E2E | Missing (`tests/e2e` absent) | Demo journey, API-down fallback, actor switch |
| Eval harness | JSONL counted, not executed | §17 report with thresholds |
| Accessibility | Missing | Keyboard, labels, contrast |
| Load / restore | Missing | |

---

## 5. Manual vs chat parity matrix (still open)

From Implementation Plan V2 §18. Every row must share one canonical record.

| Capability | Manual | Chat | Remaining |
|---|---|---|---|
| Process discovery | Partial form | Partial (heuristic) | Versioned editor; citations |
| Evidence request | Decorative | Missing | Upload + gap list artifact |
| Seller listing | API only, no editor | Draft only, no publish | Editor + publish preview |
| Buyer requirement | Partial form | Partial (asks missing fields) | Full spec both paths |
| Search / match / compare | Match run button; no compare page | Find + compare intents | Match page + compare 3 |
| Request | Accept/decline in UI | Prepare + confirm | Create-from-card; receipt |
| Approval | Confirm on action card | “confirm” | Dirty-form / stale version UX |
| NGO / environment | Missing | Missing | Whole row |
| Analytics / report | Decorative | Missing | Whole row |
| Notifications | Decorative | Missing | Whole row |
| Admin | Missing | Missing | Whole row |
| Purchase planning | Missing | Missing | Whole row |

---

## 6. Suggested build order (hackathon → academic V2)

### Slice A — make the current demo truthful (Must-have)

1. Keep API + web running together; treat API-down fallback as a labeled degraded mode, not a second marketplace.
2. Drive the live identity from `GET /api/v1/me` (org name, user name, role). Remove or hide Aster/Ananya when connected.
3. Hide or stamp **Unavailable** on Evidence, Reports, Settings, filters, attach, voice, notifications. V2 rule: *unsupported buttons are hidden or explicitly marked unavailable*.
4. Add a match-result panel that shows the three groups and listed vs delivered paise (stream-a ₹2,120/t, stream-d ₹2,240/t in the current seed).
5. Add a listing detail + request-from-listing path that calls existing APIs.
6. Wire SSE into the composer or remove “streaming” language.
7. Align fallback copy with CarbonStone / GreenBuild so a dropped API does not invent Aster listings.

### Slice B — finish the manual marketplace (Should-have)

1. Listing create/edit/publish form in the UI (API already exists).
2. Full requirement form (limits, form, window, budget, site).
3. Working marketplace filters against API query params; simple pagination.
4. Decision receipt and what-if screens on top of existing match endpoints.
5. Concurrent-accept test even on the memory store; document that Postgres locks are still remaining.

### Slice C — one data plane (Should-have)

1. Load a subset of `data/fixtures/v2` into the API store (or generate `marketplace.json` from those fixtures).
2. Replace dry-run `seed:demo` with an adapter that the API can actually apply.
3. Surface `synthetic_demo` labels on every price, quantity and “verified” badge.

### Slice D — assistant that matches the contracts (Nice-to-have before LLM)

1. Execute the 60-case eval set against the heuristic provider (intent names, forbidden writes).
2. Add citation-shaped payloads even from fixtures, so the UI can show source cards before an LLM exists.
3. Add publish-listing as an approval-gated tool.
4. Then — and only then — swap the heuristic provider for a typed LLM adapter behind `ASSISTANT_ENABLED`.

### Slice E — academic V2 (Nice-to-have)

Phases 4, 8, 9, 10 as specified: policy/NGO, durable workflows, reports/notifications, offers/fulfillment.

### Slice F — pilot (Later)

Postgres, OIDC, object storage, backups, Playwright, OpenAPI, production compose, partner-reviewed specs.

---

## 7. Risks if remaining work is ignored

1. **Two products on screen.** Offline UI shows Aster listings and “96% fit”; live API shows CarbonStone streams. Switching mid-demo looks false.
2. **Decorative chrome.** Filters, upload, reports, voice, settings look finished and do nothing.
3. **Persona UX.** `?user=` does not change the shell identity.
4. **Match story drift.** V1 docs still describe S01 recommended / S02 shortage / S03 purity / S06 cheapest listed. The live seed cannot show that. Demo from the **actual** 2 / 1 / 1 grouping.
5. **Quality-d expiry `2026-09-28`.** After that date, stream-d leaves the compatible set.
6. **In-memory reservations.** Refresh or restart loses accepts. Concurrent accept is unproven.
7. **Assistant overclaim.** Local fallback replies talk as if matching happened.
8. **Stack surprise.** Architecture PDF says FastAPI/Postgres/React; runtime is Node + HTML strings. Lead with the README prototype boundary.
9. **CORS / ports.** API CORS allowlist is `http://localhost:5173`. Live preview is `127.0.0.1:4173` and must use the same-origin proxy. Web binds IPv4 only — open `http://127.0.0.1:4173`, not `localhost` on Windows.
10. **No LLM.** “Ask CarbonBridge anything” is keyword routing. Off-script questions go to clarify.

---

## 8. Explicitly out of scope until later

These are named in Architecture V2 as future expansion. They are **not** remaining work for the current prototype gate:

- Additional materials beyond the supported discovery catalog
- Multilingual or voice input (the voice button is decorative and should stay unavailable)
- Partner APIs, live logistics quotes, LCA integrations
- Payment / settlement
- Carbon-credit market workflows
- IoT / sensor integration (the prototype is software-only by design)

Do not add UI that implies any of the above exists.

---

## 9. File index for implementers

| Path | Role in remaining work |
|---|---|
| `apps/api/src/app.js` | Add missing routes; keep envelope + auth gates |
| `apps/api/src/domain/*.js` | Matching, requests, discovery, assistant — extend, do not fork rules into the browser |
| `apps/api/src/infra/store.js` | Replace with Postgres adapter when Slice F starts |
| `apps/api/src/infra/persistence.js` | Stub to replace |
| `apps/api/data/demo/marketplace.json` | Live seed; keep in sync with fixtures or generate it |
| `apps/api/tests/api.test.js` | Extend before claiming a phase exit |
| `apps/web/src/main.js` | Live UI; hide decorative controls; bind `/me` |
| `apps/web/src/api.js` | Add SSE, listing CRUD, receipt, filters |
| `apps/web/src/App.tsx` | Unused React draft — migrate or stop maintaining a second UI |
| `contracts/v2/` | Align live API with schemas or generate OpenAPI from the live API |
| `data/fixtures/v2/` | Bind to runtime; run eval harness |
| `scripts/seed-demo.mjs` | Replace dry-run |
| `infra/docker-compose.demo.yml` | Postgres only until an app image exists |
| `.github/workflows/platform-checks.yml` | Add E2E/eval jobs when those suites exist |

---

## 10. Definition of “remaining work done” for the next review

A follow-up is allowed to mark a section complete only when:

1. The behavior is reachable from the **running** web preview or a documented API, not only from fixtures or architecture prose.
2. A test in `npm run check:all` (or a new named suite) fails if the behavior regresses.
3. Unsupported actions are hidden or labeled unavailable — no simulated success.
4. Synthetic values keep their `synthetic_demo` provenance in the UI.

Until those four are true, keep the item in this ledger.
