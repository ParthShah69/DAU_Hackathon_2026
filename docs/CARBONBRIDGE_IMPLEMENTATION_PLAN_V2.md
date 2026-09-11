# CarbonBridge Implementation Plan - Version 2

Version 2.0 | 12 September 2026 | Capability-based delivery; the former 12-hour limit no longer applies

Implement the [Architecture Plan V2](CARBONBRIDGE_ARCHITECTURE_V2.md) first as the governing design. Preserve [Architecture V1](CARBONBRIDGE_ARCHITECTURE.md) and [Implementation Plan V1](CARBONBRIDGE_IMPLEMENTATION_PLAN.md) as the regression baseline. This is a development plan, not a claim that application code, fixtures or tests already exist.

## 1. Delivery strategy

Build the existing marketplace services and manual workflows first, while defining shared commands and permissions from the start. Add discovery and knowledge, then a read-only assistant, then controlled writes, then multi-step orchestration. Complete reporting, commercial extensions and pilot operations through tested increments. Security is implemented alongside each capability, not postponed until the final phase.

The repository at planning time contains only the two V1 documents. Phase 1 must discover any other code before deciding whether to adapt it or build the planned modules. Do not rewrite functioning code merely to adopt an agent framework. No fixed duration is imposed; move to the next gate based on demonstrated behavior and re-estimate after the first working vertical slice.

### Release boundaries

| Release | Scope | Required result |
|---|---|---|
| Foundation | Phases 1-5 | Complete core manual marketplace, quality, supporting environment and process/evidence workspace |
| V2 initial | Phases 6-8 plus cross-cutting gates | Cited discovery, contextual read tools, prepared/approved writes and manual/chat parity |
| Complete academic V2 | Phases 9-10 | Reports/notifications, stronger analytics, split planning, offers, release/fulfillment and all retained V1 extensions |
| Pilot candidate | Phases 11-12 and partner review | Tested privacy/security/recovery, supported real specifications and deployment evidence |
| Future expansion | Separate scoped increments | More materials/languages/integrations only after validated demand |

Stages are not permission to remove features. Every V1 component maps to an implementation phase and a verification below. Unsupported future buttons are hidden or explicitly marked as unavailable; no simulated success is presented as a committed action.

## 2. Preservation ledger

| V1 capability / invariant | V2 implementation home | Phase | Regression evidence |
|---|---|---:|---|
| Organizations, users, memberships, roles | Existing identity/organization modules | 1 | Tenant and capability matrix tests |
| Supplier profiles, sites, listings | Catalog and manual supplier UI | 2 | Draft/publish/edit/archive round trip |
| Buyer requirements and limits | Requirements and buyer UI | 2 | Saved requirement survives refresh/edit |
| Quantity/purity separation, units and evidence | Quality service | 3 | Unknown/basis/expiry/detection-limit vectors |
| Bounded supply periods and MOQ | Catalog/reservation domain | 2-3 | Date, minimum-order and capacity tests |
| Marketplace search/filter/pagination | Search service | 2 | Identical manual/tool results, bounded pages |
| Hard compatibility and deterministic ranking | Matching service, same V1 policy | 3 | V1 golden results and tie order |
| Delivered-cost estimate | Logistics service, V1 method | 3 | V1 arithmetic and exclusions unchanged |
| Compare three options | Comparison UI/service | 3 | Same requirement/currency restrictions |
| Quality gaps and treatment guidance | Quality + reviewed knowledge | 3,5 | Exact gap; no invented treatment outcome |
| Alternative buyer discovery | Matching over permitted requirements | 3 | Opt-in/privacy gates and full quality checks |
| What-if and decision receipt | Scenario/snapshot services | 3 | Original terms immutable |
| Request/accept/decline/cancel/expiry | Requests service, original states | 3 | Party authorization, deadline and stale-version tests |
| Atomic inventory/idempotency | Reservations, operation ledger | 3 | Concurrent 60/100 test; replay allocates once |
| NGO projects and participation | Sustainability and review UI | 4 | Separate participation/evidence records |
| Internal targets/environmental actions | Targets and policy module | 4 | Internal versus regulatory source distinguished |
| Captured/reused/material-flow records | Material flows/claims | 4 | No acceptance=delivery or reuse=avoidance shortcut |
| Private evidence and review | Evidence/storage | 4-5 | Scanning, access and review-scope tests |
| Notifications and outbox | Jobs/notifications | 9 | Delivery only after commit, deduplication |
| Reporting/dashboard metrics | Analytics/report jobs | 3,9 | Metrics trace to scoped records/snapshots |
| Versioned bids/counteroffers | Offers service | 10 | Accepted terms match approved offer version |
| Post-accept cancellation/release | Release workflow | 10 | Both parties' agreement; capacity released once |
| Dispatch/receipt/dispute | Fulfillment domain | 10 | Partial delivery and quantity invariants |
| Live route/quote adapter boundary | Logistics adapter | 9-12 | Timeout, expiry, provider provenance and fallback |
| APIs, errors, versions and decimal formats | Shared contract | 1 onward | Backward-compatible OpenAPI checks |
| Audit, backups, privacy and production gates | Cross-cutting infrastructure | 1 onward;11-12 | Access review, restore drill, operational evidence |

Retain every named V1 table listed in Architecture V2 section 9.1. Code generation and migrations must not rename or discard them just because chat now creates records. Existing V1 scoring and seed cases remain a stable test profile.

## 3. Phase 1 - Baseline inventory, contracts and secure foundation

- **Objective:** establish the actual starting code, preserve V1 and create a shared application foundation.
- **Features:** authenticated organizations, role/capability checks, settings, health checks and developer startup.
- **Backend:** inventory existing modules; build/reuse FastAPI core, structured errors, request IDs, OIDC/session handling and typed command/query interfaces. Set the transaction and idempotency conventions before mutations.
- **Frontend:** preserve the V1 navigation/route inventory; build organization switching, role-aware shell and reusable loading/error/permission states.
- **Database:** create/review original migrations and membership constraints; non-owner application role, dev/staging separation and private DB configuration.
- **AI/chatbot:** no model access yet. Define specialist responsibilities, tool metadata and a capability-parity manifest.
- **APIs:** `/api/v1/me`, `/capabilities`, `/health/live`, `/health/ready`; canonical OpenAPI/error/decimal conventions.
- **Expected output:** reproducible repository layout, working authenticated shell/API/DB and approved preservation ledger.
- **Testing:** clean startup/migration, auth failures, cross-organization access, CSRF/session handling, manifest validation and secret scan.
- **Exit gate:** a user can access only authorized organization data and the baseline contract is frozen for the first feature slice.

## 4. Phase 2 - Complete manual marketplace and buyer/seller lifecycle

- **Objective:** make marketplace work usable without AI.
- **Features:** profiles/sites, listing drafts, publish/edit/archive, available supply periods, buyer requirements, search/filter and saved criteria.
- **Backend:** implement catalog/requirement services, validation, public versus private response projections and permission checks. Do not accept organization ownership from untrusted request bodies.
- **Frontend:** supplier editor/detail/dashboard, buyer editor, marketplace filters, responsive cards and clear units/dates. Preserve input after errors.
- **Database:** retain organizations/sites/streams/quality placeholders/supply periods/requirements/limits; validate positive amounts, non-overlapping periods and minimum orders.
- **AI/chatbot:** define future draft/search tool inputs around these same DTOs; no duplicate chat schemas containing different business fields.
- **APIs:** V1 listing/requirement CRUD and publish, plus archive/unpublish and saved-search operations where needed.
- **Expected output:** a supplier publishes a record and a buyer searches and saves a requirement through normal screens.
- **Testing:** draft/public separation, pagination, invalid units/dates, ownership, version conflicts, archive visibility, keyboard and narrow-screen usability.
- **Exit gate:** no core marketplace action depends on a model or a mock UI response.

## 5. Phase 3 - Quality, matching, economics and request consistency

- **Objective:** complete V1's differentiated decision and transaction path.
- **Features:** pass/fail/unknown quality matrix, versioned cost/ranking, compare, gaps, alternative buyers, scenarios, receipts, requests and reservations.
- **Backend:** pure deterministic quality/matching functions; shared cost and rounding helpers; immutable snapshots; party-scoped request state machine; atomic acceptance with consistent lock order and idempotency.
- **Frontend:** match result groups, cost breakdown, compare up to three, gap/alternative views, request review/timeline and conflict recovery.
- **Database:** V1 reports/analytes/rate cards/distances/match runs/results/requests/reservations/events/idempotency records. Preserve effective expiry and reject late accepts even if maintenance has not run.
- **AI/chatbot:** create structured explanation payloads and a deterministic tool-test driver; future assistant may summarize these results, never recalculate them.
- **APIs:** all V1 match, scenario, receipt, alternative-buyer and request endpoints.
- **Expected output:** complete supplier -> buyer -> match -> request -> accepted reservation workflow, with repeatable evidence.
- **Testing:** V1 S01/S04/S06 ranking, S02 shortage, S03 purity gap, S05 moisture, S07 missing value, S08 expiry; currency/rounding; same-basis conversion; concurrent accepts; replay; stale snapshot; private export access.
- **Exit gate:** two simultaneous 60 t acceptances against 100 t allocate exactly 60 t once, with the other rejected. All saved historical decisions remain unchanged after edits.

## 6. Phase 4 - Environmental, NGO, evidence and policy foundations

- **Objective:** preserve supporting V1 functionality and make policy guidance explicit and reviewable.
- **Features:** NGO/project drafts and review, participation, internal targets, action plans, capture/receipt/reuse evidence, policy library and scoped screening.
- **Backend:** project/participation permissions; reviewer evidence scope; material-flow invariants; dated policy retrieval and reviewed applicability/rule functions. The rule engine evaluates only the facts and scope it supports.
- **Frontend:** NGO editor/catalog, project review, participation form, target/action-plan screens, flow-event forms, evidence viewer and jurisdiction/as-of-date policy workspace.
- **Database:** retain projects/participations/material_flow_events/impact_claims/evidence_documents; add evidence reviews, organization targets, action plans and policy documents/rules/screenings. Reference immutable knowledge document versions introduced in Phase 5, or create their shared source-table foundation here once.
- **AI/chatbot:** no authoritative legal answer from a model. Prepare policy/NGO tools and deterministic source cards; narrative assistance comes after retrieval is tested.
- **APIs:** projects/review/participation, evidence upload/review, targets/action plans, policies/search and policy-screenings.
- **Expected output:** manual support modules with clear source/evidence states and a limited reviewed policy test set.
- **Testing:** reviewer-only approval, wrong jurisdiction, missing reporting date, source conflict/expiry, internal-versus-regulatory target, NGO-not-offset, transaction-not-reuse and tenant evidence isolation.
- **Exit gate:** unsupported policy questions return an explicit unknown; no universal legal target or invented carbon-credit eligibility is presented.

## 7. Phase 5 - Process discovery data, knowledge and market evidence

- **Objective:** support the user's new process-first workflow with a trustworthy data foundation.
- **Features:** manual process editor, structured steps, potential-output workspace, evidence checklist, reviewed source retrieval and price comparables.
- **Backend:** process/version/candidate services; source ingestion, isolated extraction and reviewer approval; full-text retrieval with ACL filters; method registry; typed price-observation search. Candidate promotion only prepares a draft after category and evidence checks.
- **Frontend:** process form and diagram/table, opportunity cards with assumptions, edit/confirm extracted fields, evidence readiness and comparable-price panel.
- **Database:** process profiles/versions/steps, discovery runs/resource candidates, categories/methods, source/document/chunk metadata, evidence links and price observations. Introduce tables only once if Phase 4 created the shared foundation.
- **AI/chatbot:** first bounded model experiment: extract structured process fields and propose sourced candidate outputs. It has read tools only. Flag missing evidence and keep generated quantities/prices null unless a supported calculation/source provides them.
- **APIs:** processes/versioned updates, discoveries, resource-candidate/listing-draft, knowledge/search and price-observations.
- **Expected output:** a user describes a process, reviews possible outputs and sees exactly what is needed before listing.
- **Testing:** unsupported process, contradictory inputs, already-captured versus merely-emitted CO2, uncollected output, unsupported material, missing composition, stale quote, source ACL and citation locator validation.
- **Exit gate:** a hypothesis cannot silently become verified quality or available stock. At least three curated process families and their unknown/negative cases pass expert-reviewed examples.

## 8. Phase 6 - Conversation foundation and read-only assistance

- **Objective:** add a reliable assistant without enabling consequential writes prematurely.
- **Features:** conversation list/history, chat panel/full page, entity context, source cards, progress, retry/cancel and manual deep links.
- **Backend:** conversation/message/run persistence, provider adapter, structured intent extraction, tenant context, bounded history summaries, SSE/polling and limits. Capture token/latency metadata and provider failures.
- **Frontend:** accessible composer, typed result cards reused from manual UI, context chips, result-set references and visible partial/error states.
- **Database:** conversations/members/messages/context, workflow/agent runs and tool invocation logs. Retention and deletion rules are implemented now.
- **AI/chatbot:** route to read-only discovery, search, quality, compare, policy and reporting tools; support ambiguity questions and factual citations. No unrestricted database/browser/shell tool.
- **APIs:** conversations/messages, workflow status/events and read-only tool handlers to existing services.
- **Expected output:** "Find suitable sellers and explain the second result" works using actual saved records; provider outage leaves manual UI available.
- **Testing:** intent/entity accuracy, "second one" reference, organization switch, conversation ID attack, streaming reconnect, provider timeout, token budget and fabricated-result detection.
- **Exit gate:** user-visible answers identify their record/source basis; unauthorized data never enters model context.

## 9. Phase 7 - Safe tool actions and manual/chat parity

- **Objective:** let the assistant perform real work through existing services.
- **Features:** private drafts, prepared edits, publication/request previews, approvals, committed receipts, undo for supported drafts and synchronized UI.
- **Backend:** central action gateway, canonical server-generated diffs, authorization class, payload/version hash, expiry, idempotency and execution ledger. Recheck roles/versions immediately before effects. Keep database transactions short.
- **Frontend:** editable prepared forms, exact action preview, approve/reject, links to affected records and stale/conflict banners; never overwrite dirty manual forms.
- **Database:** action_proposals/action_approvals linked to workflow and existing idempotency/audit/outbox; add source-channel correlation without replacing V1 audit.
- **AI/chatbot:** seller/buyer/commercial specialists can prepare typed changes; the orchestrator executes only policy-authorized actions. Natural-language confirmation binds one unambiguous pending proposal.
- **APIs:** actions/prepare, approve, execute; reuse V1 mutation services and their request/response semantics.
- **Expected output:** a user can create a listing draft, edit it manually, ask for publication, approve and see exactly one live listing.
- **Testing:** tampered/expired approval, changed terms, role revoked after preview, duplicate messages/clicks, commit response timeout, malformed arguments, prompt-injected approval text and manual/chat command equivalence.
- **Exit gate:** zero unauthorized effects in the adversarial suite; no model text alone can satisfy a sensitive approval.

## 10. Phase 8 - Multi-step orchestration and full discovery-to-market journey

- **Objective:** complete the process automation the user described.
- **Features:** dependent specialist steps, clarification/resume, partial completion, cancellation, discovery -> evidence -> draft -> publish -> buyer discovery, and buyer need -> match -> request.
- **Backend:** durable step graph, dependency validation, leases/checkpoints, bounded delegation and stable execution keys. Reconcile unknown outcomes before retry. Specialists use typed inputs/outputs and minimal scopes.
- **Frontend:** task checklist, waiting-for-input/approval states, completed artifact cards and resume from either chat or manual page.
- **Database:** workflow_steps, durable job/outbox integration, saved result references and action lineage. Never cascade-delete business records with a workflow.
- **AI/chatbot:** controlled multi-intent planner, specialist registry and grounded final synthesis. Parallelize independent reads; serialize writes or dependent work. Do not recursively spawn unconstrained agents.
- **APIs:** workflow/resume and cancel, discovery/task-specific tools, existing service commands.
- **Expected output:** a compound instruction completes supported steps and asks targeted questions for the remaining ones, without inventing missing evidence or repeating already committed work.
- **Testing:** crash after commit/before receipt, worker lease expiry, duplicate jobs, cancellation after first step, stale context on resume, conflicting simultaneous edits, max-turn/tool-call exhaustion and cross-specialist injection.
- **Exit gate:** the process-to-listing and buyer-to-request demos pass through both interfaces; V2 initial capability is complete.

## 11. Phase 9 - Analytics, reports, notifications and operational assistance

- **Objective:** make the system useful for ongoing marketplace work.
- **Features:** source-backed analytics, evidence-gap opportunities, remaining-stock buyers, report builder, decision briefs, inbox/preferences and current quote-provider integration when available.
- **Backend:** approved aggregate query catalog, metric definitions, report snapshots/jobs, post-commit outbox delivery, provider adapter contracts, stale source/price checks and scoped recommendation runs.
- **Frontend:** dashboards with real denominators, report preview/export, source/provenance drawer, notification inbox and preferences, corresponding chat cards.
- **Database:** report_jobs, notifications/preferences, saved_searches and recommendation_runs; retain all V1 calculation snapshots and flow records.
- **AI/chatbot:** analytics specialist explains computed metrics, compares stored periods and drafts reports from evidence bundles. Tips identify their data basis, sample size and next action.
- **APIs:** reports, activity, notification-preferences, saved-searches, metric queries and quote lookup adapters.
- **Expected output:** "Explain my unsold inventory and prepare a report" returns reproducible figures and actionable, permitted buyer opportunities.
- **Testing:** aggregate tenant leakage, double-counted joins, wrong period/unit, zero denominator, report source changes, signed download access, duplicate notifications and provider timeout/stale quote.
- **Exit gate:** every numerical chart/report can be reproduced from its stored inputs/query version; no LLM arithmetic substitutes for the service result.

## 12. Phase 10 - Purchase planning and preserved commercial extensions

- **Objective:** complete the advanced workflows retained from V1 and the subsequent deal-rescue idea.
- **Features:** two-supplier plans, supplier-exclusion scenarios, versioned offers/counteroffers, accepted-request release, partial dispatch/receipt and disputes.
- **Backend:** per-leg feasibility/MOQ/quality/capacity and deterministic costs; offer version/expiry/acceptance; mutually approved release; fulfillment ledger and partial-delivery invariants. Preserve V1 request states rather than overloading them.
- **Frontend:** manual plan builder/comparison, individual request confirmation state, offer review, release approval and fulfillment/dispute timelines; equivalent chat preparations.
- **Database:** purchase_plans/legs, offers/offer_versions, release_requests, fulfillments/disputes and event links to reservations/material flows.
- **AI/chatbot:** explain proposals and prepare exact actions; never blend incompatible streams, autonomously negotiate for both parties or promise a fully secured multi-supplier plan prematurely.
- **APIs:** purchase-plans/scenarios/prepare-requests, offers/version/accept, release-requests/approve, fulfillments/events and disputes.
- **Expected output:** a split plan yields traceable leg costs and partial/complete confirmations; real order changes remain explicitly approved.
- **Testing:** pair allocation boundaries, MOQ conflicts, insufficiency, supplier removal, price change, partial supplier acceptance, duplicate release, dispatch > reserved, rejected receipt and permission asymmetry.
- **Exit gate:** complete academic V2 includes every retained V1 planned module with manual and conversational parity; payment settlement remains separate future scope.

## 13. Phase 11 - System assurance and pilot validation

- **Objective:** prove that the assembled system is safe, useful and recoverable.
- **Features:** eval dashboard, issue triage, source/rule review, privacy export/deletion and operational runbooks.
- **Backend:** harden limits, cache scopes, token redaction, document scanning, external URL allowlists, audit retention and unknown-outcome reconciliation.
- **Frontend:** accessibility/manual/chat parity audit, truthful status/citation review and privacy controls.
- **Database:** upgrade from V1 backup, index/query review, retention/deletion/restore procedures and immutable-history verification.
- **AI/chatbot:** run the fixed held-out suite and reviewed real pilot tasks; compare model/prompt configurations without changing domain policies.
- **APIs:** full regression, abuse-rate-limit and direct endpoint tests independent of the UI.
- **Expected output:** reproducible test/eval report, known limitations, no unresolved critical defects and a partner-reviewed data/specification set.
- **Testing:** unit/API/DB/intent/tool/security/RAG/E2E/load/accessibility tests; crash/retry/provider outage; restore drill and deployment rollback.
- **Exit gate:** meet section 17 quality thresholds, with measured evidence rather than a claim of perfect automation.

## 14. Phase 12 - Deployment, pilot and release operation

- **Objective:** deploy a controlled pilot with a maintainable operating model.
- **Features:** separate environments, real identity provider, monitoring, backups, admin workflows and support procedures.
- **Backend:** build immutable API/worker images, one migration job, liveness/readiness and graceful shutdown; configure timeouts, secrets and provider spend limits.
- **Frontend:** production build behind same-origin HTTPS; CSP, correct API/SSE proxy behavior and visible environment labeling.
- **Database:** private managed PostgreSQL, encrypted backup schedule, tested restore, correct non-owner role and supported-version maintenance.
- **AI/chatbot:** server-only provider credentials, pinned evaluated model/prompt/tool versions, assistant feature flag and manual fallback. Review provider data controls before uploading partner records.
- **APIs:** smoke checks through public gateway; external adapters with real credentials only after agreements and integration tests.
- **Expected output:** pilot URL, versioned release, operations handbook, recovery evidence and feedback loop.
- **Testing:** staging-to-production promotion, migration once, health checks, session/security headers, SSE reconnect, worker recovery, secret rotation, restore and rollback.
- **Exit gate:** named owner approves the measured release evidence and supported pilot scope. No unsupported compliance, price or climate claims remain in the UI.

## 15. V2 demo data package and data contracts

The demo dataset is deliberately small, inspectable and reproducible. It demonstrates the complete journey without pretending that synthetic values are certified industrial measurements. Keep all V1 fixtures and migrations unchanged; add V2 material under `data/fixtures/v2/`.

### 15.1 Fixture inventory

| File | Suggested records | Purpose |
|---|---:|---|
| `process_profiles.json` | 6 | Plain-language production processes with inputs, steps and possible outputs. Include mineral carbonation/concrete curing, greenhouse enrichment, algae cultivation, methanol, urea and food/beverage use cases. |
| `process_scenarios.json` | 12 | Complete and incomplete seller descriptions, including one ambiguous process, one contaminated stream and one process with no measured capture. |
| `buyer_specification_examples.json` | 8 | Purity, moisture, form, delivery radius, cadence and price constraints for realistic buyer requests. |
| `treatment_pathways.json` | 7 | Qualitative transformation or handling pathways. These are opportunities until a specialist and evidence review establish feasibility. |
| `knowledge_sources.json` | 12 | Source metadata for project documents, technical guidance, policy pages and organization-provided evidence. |
| `knowledge_documents.jsonl` | 12 | Normalized source documents with retrieval metadata and effective dates. |
| `knowledge_chunks.jsonl` | 48 | Citable chunks with a stable locator, source class and access scope. |
| `policy_rules.json` | 10 | Versioned jurisdiction, mechanism, effective-date and claim rules, including undetermined cases. |
| `policy_scenarios.json` | 8 | In-force, superseded, future-effective, wrong-jurisdiction and missing-evidence examples. |
| `price_observations.json` | 12 | Four indicative listings, four transport observations, two quote snapshots and two stale observations. A price observation is not a guaranteed quote. |
| `conversation_scenarios.json` | 16 | Seller, buyer, NGO and admin prompts with expected intent, context, tool calls and action state. |
| `assistant_eval_set.jsonl` | 60 | The fixed safety and quality suite described in section 17. |
| `manifest.json` | 1 | Dataset version, seed, record counts, checksums, generator version and fixture timestamp. |

The six process profiles should cover different discovery outcomes rather than six polished success stories. At least two must produce a useful candidate resource whose quantity, composition or economics remain unknown. At least one must be rejected for safety or evidence reasons. This makes the demo show honest uncertainty and the value of guided questions.

### 15.2 Canonical formats

- Use UTF-8 JSON for bounded collections and UTF-8 JSONL for documents, chunks and eval cases. Every record has a stable `id`, `schema_version`, `created_at` and `updated_at`; timestamps are UTC ISO-8601.
- Use UUIDv5 for deterministic fixture IDs. Re-running the seed is idempotent and never creates a second organization, listing, conversation or evidence record.
- Store money as integer paise with `currency` and `basis` fields. Store quantities as decimal strings with `unit`, `basis` (`wet`, `dry`, `as_received` or `standardized`), `period` and optional `uncertainty`; do not use floating-point money or silently convert units.
- Store locations as an address plus GeoJSON point or region where available. Do not put precise private facility coordinates in public listing responses.
- Use `null` for unknown values. Do not use zero to mean unknown and do not derive a measured quantity from an LLM guess.
- Every externally sourced fact has `source_id`, `locator`, `retrieved_at`, `effective_from` and, when known, `effective_to`. Organization-provided evidence also records the uploader, review state and verification method.
- Keep embeddings optional and derived. The source text, chunk ID, ACL and version remain canonical; re-embedding never changes the underlying fact.

### 15.3 Process and discovery example

```json
{
  "id": "process_01H...",
  "organization_id": "org_demo_seller",
  "submitted_text": "We ferment sugar syrup and vent a gas stream after separation...",
  "steps": [
    {"order": 1, "name": "fermentation", "inputs": ["sugar syrup"], "outputs": ["product", "gas stream"]},
    {"order": 2, "name": "separation", "inputs": ["gas stream"], "outputs": ["captured CO2 candidate"]}
  ],
  "scale": {"value": "unknown", "unit": "tonne_per_day"},
  "evidence_refs": [],
  "discovery_status": "needs_input",
  "resource_candidates": [
    {
      "material": "captured CO2",
      "status": "hypothesis",
      "quantity": null,
      "purity": null,
      "indicative_price": null,
      "missing_fields": ["measurement method", "purity basis", "available cadence", "safe handling evidence"],
      "can_publish": false
    }
  ]
}
```

The candidate is useful because it tells the seller what to measure and why. It cannot become a verified listing until the normal quality, evidence and publication gates pass. The seed generator should create both the candidate and the later reviewed version so evaluators can see the state transition.

### 15.4 Seeding and provenance rules

Use one documented command or script such as `seed --profile demo --seed 26 --clock 2026-01-26T10:00:00Z`; keep the exact command in the repository runbook. The script must validate schemas, load fixtures in dependency order, report counts and fail closed when a non-demo environment is selected. Expected rankings, costs and analytics are generated by the domain services during seeding; do not hard-code a second copy of computed answers.

Synthetic process descriptions, prices and organization evidence are labelled `synthetic_demo`. Technical and policy references carry their source class (`official_primary`, `technical_primary`, `organization_provided` or `synthetic_hypothesis`). The UI must show this label and the as-of date anywhere a user could mistake a demo value for a live quote, verified quantity, compliance decision or climate result.

## 16. Three independent Sol lanes and Terra work breakdown

The three leads own disjoint roots. A lead may spawn Terra children only inside that lead's roots, with a bounded brief and a file list. Shared contracts are changed first by Lane C, then consumed by Lanes A and B. No child changes another lane's migrations, routes, components or fixture schema.

| Lead lane | Owned roots | Terra child briefs |
|---|---|---|
| **Sol A — Web experience** | `apps/web/`, web component tests and visual fixtures | A1 assistant chat, streaming cards and confirmations; A2 process intake, discovery and evidence workspace; A3 manual marketplace parity, responsive behavior and accessibility. |
| **Sol B — API and orchestration** | `apps/api/`, migrations and backend unit/API tests | B1 intent envelope, specialist registry and conversation service; B2 typed tool gateway, approval policy and durable workflows; B3 retrieval/evidence/price/policy services and provider adapter. |
| **Sol C — Contracts, data and delivery** | `contracts/`, `data/`, `infra/`, `scripts/`, `tests/e2e/`, `tests/evals/`, `.github/` and release docs | C1 JSON schemas, deterministic fixtures and seed validator; C2 60-case eval harness, adversarial prompts and score report; C3 end-to-end workflows, restore/migration and smoke checks; C4 telemetry, redaction, rate limits and operational runbook. |

The coordinator owns cross-lane decisions, the root README and release notes. Lane C is the only owner of public schemas and fixture IDs; Lane B is the only owner of database migrations and server authorization; Lane A consumes generated API types and cannot invent a second business rule in the browser. If a change crosses roots, the lead sends a small contract change first, waits for review, then updates its own implementation.

Work in this order:

1. Lane C publishes the initial contracts, fixture manifest and mock payloads.
2. Lanes A and B build against those contracts in parallel. Lane A can use mock SSE and action receipts; Lane B can use contract tests without a finished UI.
3. Lane C adds integration fixtures and eval cases as soon as each specialist/tool exists.
4. After every phase exit gate, run the manual route and the equivalent chat scenario before starting the next dependent phase.
5. During integration, serialize changes to shared lockfiles, migration heads, generated clients and deployment manifests. Prefer one small integration commit over simultaneous edits.

Each child receives: objective, allowed paths, input contract, expected artifacts, tests, and a stop condition. A child that discovers a cross-lane need writes a proposal in `tmp/coordination/` and stops; it does not edit an adjacent root. This keeps specialist work parallel without creating an unconstrained swarm or letting a model agent recursively delegate production actions.

## 17. LLM evaluation, safety and release gates

The assistant is released only when deterministic domain services and the fixed evaluation suite agree. The suite is committed as JSONL so a model, prompt, corpus or tool change can be compared against the same cases.

### 17.1 Evaluation set

The 60 cases contain 10 intent/entity cases, 10 marketplace read cases, 8 process/quality grounding cases, 10 environment/policy cases, 8 mutation-confirmation cases, 6 authorization/privacy cases, 5 prompt-injection/adversarial cases and 3 reliability cases. Each case contains a persona, tenant, database snapshot, prompt turns, allowed specialist/tools, expected intent and arguments, required citations, forbidden calls, expected action state and a human-readable rubric.

Include references such as “the second one,” an organization switch, stale prices, missing measurement, contradictory buyer requirements, a revoked role, a private document included in a public request, an injected instruction inside a source document, duplicate submit, provider timeout and a crash after a committed mutation. These cases verify the process, not just a friendly happy-path answer.

### 17.2 Minimum release thresholds

- 100% of forbidden mutation, tenant-isolation, privacy and unsupported-compliance cases pass.
- 100% of numeric values, listing status, allocation, cost and request state agree with deterministic service outputs.
- At least 95% expected specialist/tool selection and argument accuracy on the held-out set.
- At least 95% of factual answers contain the required source locator, with zero fabricated citations.
- 100% of sensitive mutations produce a current preview and explicit approval; model prose never counts as approval.
- Manual V1 and V2 routes pass with the LLM provider disabled. A provider outage returns a useful manual fallback and never loses a committed receipt.
- No critical regression is accepted after a model, prompt, tool schema or retrieval corpus change. Any such change reruns the full suite and records the version in the report.

Use unit and schema tests for envelopes, API and database tests for authorization and locks, specialist tests for grounding, tool tests for idempotency and stale versions, RAG citation tests, prompt-injection tests, UI/manual parity tests, end-to-end crash/retry tests, accessibility tests and a small concurrent-load test. Track p50/p95 first-token latency, workflow completion, clarification rate, approval rejection, tool error, unknown-outcome reconciliation, citation coverage, manual fallback rate and cost per completed workflow.

## 18. Manual and chatbot implementation matrix

Every row below must work through the manual page and through a conversational preparation or read action. The resulting artifact is the same database record, so users can start in chat, edit in the UI and resume in chat without copying text.

| Capability | Manual entry | Chat entry | Canonical artifact |
|---|---|---|---|
| Process discovery | Process workspace form | “Here is our process; what outputs could be useful?” | Process profile + discovery run |
| Evidence request | Evidence checklist/upload | “What should I measure or upload?” | Evidence item + gap list |
| Seller listing | Listing editor | “Prepare a listing from the reviewed CO2 stream.” | Listing draft/version |
| Buyer requirement | Requirement form | “Find CO2 that meets these constraints.” | Requirement |
| Search/match/compare | Search, match and comparison pages | “Compare the best three options.” | Search snapshot + comparison |
| Request | Request form | “Prepare a request for option two.” | Request draft/proposal |
| Approval | Review and approve button | “Approve this exact request.” | Approval + receipt |
| NGO/environment | NGO dashboard/forms | “Show evidence gaps in our target.” | Target/action/evidence bundle |
| Analytics/report | Dashboard/report builder | “Explain unsold stock and draft a report.” | Metric snapshot/report |
| Notifications | Inbox/preferences | “Notify me when a matching listing appears.” | Preference/saved search |
| Admin | Policy/source/user controls | “Show unresolved policy reviews.” | Admin task/audit event |
| Purchase planning | Plan builder | “Find a feasible two-supplier plan.” | Plan + legs + prepared requests |

The parity test asserts the same validation, ranking, cost, authorization, version conflict and audit behavior for each pair. A chatbot message may be a faster way to prepare an artifact, but the manual screen remains the most legible review surface.

## 19. MVP, complete academic release and future expansion

The first usable V2 release includes the complete V1 marketplace core, process-first intake, evidence-backed discovery, read-only grounded assistance, draft creation, exact previews and approvals, request flow, citations, conversations, manual/chat parity, the eval suite and a manual fallback. It is enough for a strong demo because the user can describe a real process, understand possible outputs, fix missing evidence, create a listing and complete a buyer request.

The complete academic release adds durable multi-step workflows, seller/buyer/NGO/admin specialists, analytics and reports, notifications, source-backed market observations, target actions, two-supplier planning, offer versions, accepted-request release, fulfillment and dispute records, plus the operational runbook. These are implemented only after the core gates pass; they are not decorative buttons.

Future work can add additional materials, multilingual/voice input, partner APIs, live quote providers, LCA integrations, payment/settlement, credit-market workflows and richer treatment models. Each new material or claim type must first receive a domain schema, evidence policy, specialist tests and a reviewed fixture set. Do not imply that a future adapter, carbon credit or compliance claim exists in the current release.

## 20. Recommended implementation stack and environments

Use the existing V1 stack as the compatibility baseline: React and TypeScript with Vite, Tailwind and TanStack Query; FastAPI with Pydantic, SQLAlchemy and Alembic; PostgreSQL; private object storage; REST/OpenAPI plus SSE; a Postgres-backed worker; OIDC; Docker Compose for development; pytest/PostgreSQL/Playwright for tests; and OpenTelemetry-compatible traces and metrics.

Add a server-side LLM provider adapter around the OpenAI Responses API with strict typed tools and structured outputs. Keep the provider behind an interface so the deterministic services, fixtures and tests run without network access. A custom conversation/SSE service plus the typed workflow engine is the primary integration surface; an agent SDK is optional and must not replace authorization, action previews or the database ledger.

Development, staging and pilot are separate environments. The server owns `DATABASE_URL`, OIDC configuration, provider credentials, model/prompt/tool versions and spend/time limits; no secret is exposed to the browser or committed in fixtures. `ASSISTANT_ENABLED` and `DEMO_MODE` are explicit environment flags, with a kill switch that routes users to manual pages. Production deployment needs same-origin HTTPS, CSP, secure cookies, private database/networking, encrypted backups, one migration job, health checks, log redaction and a tested rollback.

## 21. Definition of done and demonstration script

V2 is ready for review when the repository contains the architecture and implementation documents, V1 behavior remains green, migrations and fixture seeding are repeatable, every public contract is generated and checked, the 60-case report meets section 17, manual/chat parity passes, accessibility and tenant-isolation checks pass, the outage and restore drills have evidence, and the pilot scope has named owners and known limitations.

The recommended demonstration is one continuous story:

1. A seller pastes a plain-language production process.
2. The process specialist identifies possible outputs, explains the reasoning in simple language, cites the source basis and asks only for missing measurements.
3. The seller supplies or uploads evidence; the system updates the candidate and clearly distinguishes a hypothesis from publishable stock.
4. The seller asks the assistant to prepare a listing. A review card opens the same manual editor, where the seller changes a field and approves publication.
5. A buyer describes a need. The search and comparison specialists use database records, quality gates, distance/cost formulas and price observations to explain the best options.
6. The buyer asks for a request. The assistant prepares the exact request; the buyer confirms it; the supplier accepts through the manual page; both see the same receipt and audit trail.
7. The team opens the analytics and evidence views to show unsold stock, missing evidence, policy basis and the next safe action.

This story makes the differentiator visible: CarbonBridge turns an opaque production process into evidence-backed, reviewable marketplace work through a conversation while keeping every important action inspectable and editable in the normal UI. It does not claim perfect autonomous operation; it proves useful automation with controlled boundaries.
