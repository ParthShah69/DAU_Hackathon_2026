# CarbonBridge: three-lane implementation plan

Version 1.0 | 12 September 2026 | One 12-hour build day; three simultaneous lanes

Authority: [Architecture and data design](CARBONBRIDGE_ARCHITECTURE.md). If an earlier research note disagrees on units, states, formulas or paths, this final pair of documents takes precedence. This plan covers implementation to a tested demo, followed by explicit pilot/production work. The application has not yet been implemented.

## 1. Outcome, staffing and budget

By hour 12, demonstrate a persisted buyer journey: supplier publishes CO2 supply → buyer saves requirements → system explains matches and failures → buyer compares delivery estimates → buyer submits → supplier accepts → available quantity decreases once. Show an alternate buyer if P1 is complete. Preserve the last two hours for testing and rehearsal.

Use **three independent Sol leads**:

| Lane | Lead model | Mission |
|---|---|---|
| A: Product interface | `gpt-5.6-sol` | Build the intuitive frontend and its local component tests |
| B: Domain backend | `gpt-5.6-sol` | Build API, authorization, database and deterministic business rules |
| C: Contracts, data, delivery | `gpt-5.6-sol` | Own shared interfaces, seed artifacts, local environment, CI and cross-system tests |

Each lead may delegate bounded tasks to `gpt-5.6-terra` workers, with exclusive child-owned subdirectories. These are simultaneous lanes within a single day, not three consecutive days. Thirty-six nominal lane-hours do not mean 36 hours of human attention or guaranteed output; agent speed is uncertain, and the 12-hour wall-clock cutoff remains binding. The human handles short product decisions and the final demo, not every implementation detail.

**Runtime limit:** this session offers four concurrent slots including the coordinator. Coordinator + three Sol leads fills the slots. Therefore, do not promise three Sol leads plus several Terra workers simultaneously here. Use waves: complete a Sol research/handoff task, release its slot, run a bounded Terra review, then resume the lead if needed. In an environment with a higher configured limit, each Sol may run its children concurrently. An idle/interrupted agent may still consume capacity; use the runtime's actual slot accounting, and queue delegation if no slot is free. No agent should spin waiting for capacity.

For this planning task, three Sol specialists produced disjoint frontend, backend and data/platform notes; a Terra reviewer checked quality semantics, transport assumptions, capacity and carbon claims after a slot became available. The final architecture resolves their differing suggestions into one contract.

## 2. File ownership: no overlapping writers

| Owner | Exclusive paths | Explicit exclusions |
|---|---|---|
| A | `apps/web/**` including frontend manifest/lockfile and unit tests | No edits in API, shared contracts, root config or E2E tests |
| B | `apps/api/**`, including Alembic migrations, database loader adapter and API tests | No shared-contract, fixture-data, CI or root infrastructure edits |
| C | `contracts/**`, `data/**`, `infra/**`, `scripts/**`, `tests/e2e/**`, `.github/**`, root `.gitignore`, root `README.md`, root environment example | No edits to frontend/backend source or migrations |
| Coordinator | `docs/**`, conflict arbitration and serial integration commits | Does not modify lane-owned implementation while its owner is active |

Only B authors database migrations. C supplies the PostgreSQL service and runs B's migration entrypoint. Only C authors shared schema files and generated client artifacts under `contracts/generated/**`. A imports the generated TypeScript client rather than hand-copying types; B implements typed Python schemas and verifies its exported OpenAPI against the agreed contract.

Avoid a root JavaScript workspace lockfile shared by two lanes. For this small build, frontend dependencies and lockfile stay under `apps/web`; E2E dependencies and lockfile stay under `tests/e2e`. Python dependency/lock files stay under `apps/api`. Root scripts orchestrate their commands. C owns root composition and deployment scaffolding.

### Contract-change protocol

At hour 0-1, agree API routes, fields, enums, numeric formats, fixture keys and errors from the architecture. C publishes `contracts/openapi.yaml`, reusable JSON Schemas, success/error examples and a version. A uses these examples via a visibly development-only mock adapter while B implements endpoints. By hour 4, the frontend must use the real API for the main journey.

If a lead needs a change, send C: affected endpoint/type, reason, example payload, backward compatibility and consumers. C edits shared files once and announces the new version. A/B update only their own consumers. No lead changes a shared enum independently. CI compares B's exported OpenAPI to canonical paths, request/response types and enums; formatting differences are normalized before comparison. Do not build a custom schema framework or generate ORM models from API DTOs.

## 3. First 60 minutes: what to start with

1. Coordinator freezes the demo story and P0/P1/P2 cut line. Confirm contained-CO2 tonnes, dry/wet quality bases, October supply window, INR paise and the five-state v1 request flow.
2. C checks local Node/Python/container availability and publishes the shared contract/examples. If local containers cannot run, use an available development PostgreSQL instance with equivalent isolation; do not spend the day learning orchestration.
3. B creates API health checks, migration foundation and one end-to-end listing/requirement schema. Begin with the eight exact fixture cases, not a broad industrial taxonomy.
4. A builds the shell and requirement → result navigation against the canonical examples. Sketch the result card and explanation panel first, because they carry the pitch.
5. All lanes confirm one command can start the development stack, even if only health endpoints and an empty UI exist. Contract and startup problems discovered at hour 8 are much more expensive.

Do not start with authentication branding, an elaborate homepage, a large map, animated charts, an NGO module or a chatbot.

## 4. One-day schedule and integration gates

| Time | A: Frontend | B: Backend | C: Contracts/data/platform | Gate |
|---|---|---|---|---|
| 0-1 h | Shell, routes, form/result sketch | App/settings, health, schema skeleton | Contract v1, runtime check, fixture spec | Shared names/units/states frozen |
| 1-2 h | Listing and buyer forms | Org permissions, core migrations, create/publish/read | PostgreSQL stack, seed schemas/reference fixtures | Valid listing persists |
| 2-3 h | Marketplace/search, details, form errors | Requirements and listing filters | Seed adapter coordination, schema/reference validation | Buyer requirement persists |
| 3-4 h | Results, hard-rule explanations | Pure matcher, unknown/failure states, snapshots | Golden outcomes; API/client drift checks | Real UI → API → DB → match |
| 4-5 h | Delivered-price card and result order | Cost/rank functions, period checks | Distance matrix/rate fixture, arithmetic checks | S01/S04/S06 order reproducible |
| 5-6 h | Request review, submit and timeline | Create request, party checks, idempotency | Seed request histories; E2E first pass | Request persists after refresh |
| 6-7 h | Supplier accept/decline; buyer cancel | Atomic acceptance, stale/conflict handling | Concurrent-capacity and tenant test harness | Complete P0 spine works |
| 7-8 h | Compare and gap next actions | Alternate-buyer evaluation; exact gap reasons | E2E failure cases and no-external-network run | One failed stream gets useful next step |
| 8-9 h | Decision receipt and optional what-if UI | Authorized receipt; separate scenario runs | Clean database migration/seed verification | Repeatable receipt and reset |
| 9-10 h | Responsive/accessibility polish; tiny P2 only if green | Fix invariants; P2 only if green | CI, safe demo config, startup/release notes | Feature freeze at hour 10 |
| 10-11 h | Fix UI blockers, keyboard/viewport pass | Fix correctness blockers only | Full integration suite and clean-start rehearsal | Demo candidate tested |
| 11-12 h | Rehearse four-minute story | Support rehearsal; freeze API | Capture evidence, reset and tag candidate | No new features; handoff |

At hour 4, if the UI is still entirely mocked, all lanes prioritize real integration. At hour 7, if acceptance cannot safely reserve supply, drop every P1/P2 item until P0 passes. At hour 9, cut what-if and receipt styling before cutting correctness tests. At hour 10, no features enter scope.

## 5. Lane A work packages and Terra delegation

**Sol A owns** app composition, routing, API adapter, frontend dependencies, integration and UX consistency.

| Bounded Terra task | Exclusive subtree | Done condition |
|---|---|---|
| A1 forms | `apps/web/src/features/catalog-forms/**` | Listing/requirement fields, unit hints, inline validation and saved-input errors |
| A2 match experience | `apps/web/src/features/matches/**` | Compatible/fail/unknown tabs, explanations, estimates and compare |
| A3 request experience | `apps/web/src/features/requests/**` | Request review/timeline, accept/decline/cancel states, 409 recovery |

Parent supplies typed props, route context and canonical client usage before delegation. Children do not edit router, global CSS or dependencies; they return required exports and any integration notes. Parent wires exports only after each child handoff. If slots are constrained, execute one child at a time or have Sol implement directly.

Frontend acceptance:

- Quantity and purity remain separate inputs; units and exact period always visible.
- Unknown measurements are not colored/ranked as compatible.
- Result details display actual vs required values and a readable reason.
- Duplicate-submit UI prevention supplements backend idempotency.
- A 409 preserves context and offers refresh, rather than silently changing price or quantity.
- All main states are usable with keyboard and at 390 px width; status is never color-only.
- Demo mode, synthetic values and estimates remain visible in the normal journey.

## 6. Lane B work packages and Terra delegation

**Sol B owns** application assembly, transaction conventions, migrations, authorization foundation, integration and Python dependencies.

| Bounded Terra task | Exclusive subtree | Done condition |
|---|---|---|
| B1 pure matching | `apps/api/app/modules/matching/engine/**`, `apps/api/tests/matching/**` | All hard-check cases and deterministic score vectors pass |
| B2 catalog services | `apps/api/app/modules/catalog/**`, `apps/api/tests/catalog/**` | Draft/publish/search with field and ownership rules; no child migrations |
| B3 request services | `apps/api/app/modules/requests/**`, `apps/api/tests/requests/**` | Authorized state machine, idempotency and atomic reservation |

Parent publishes database interfaces and DTO boundaries before assigning work. Children propose needed migration changes to Sol B; only the parent authors them. The matching child receives immutable input types and does not access database sessions. The request child implements within the parent's transaction/lock-order convention.

Backend acceptance:

- Validate values and units at API and database boundaries; unknown is explicit.
- Matching hard gates execute before scoring; rejected candidates cannot leak into ranked matches.
- Every persisted run includes inputs, observed values, source versions, policy, costs and factors.
- Two concurrent accepts for 60 t against 100 t leave exactly one success and 60 t reserved.
- Same-key same-body replay returns the original request; different-body replay returns conflict.
- Listing changes preserve old decisions and block stale acceptance until reviewed.
- Tenant X cannot read tenant Y's private requirement, accept its request or export its snapshot.

## 7. Lane C work packages and Terra delegation

**Sol C owns** canonical contracts, root configuration, seed orchestration, CI integration and final test evidence.

| Bounded Terra task | Exclusive subtree | Done condition |
|---|---|---|
| C1 data/provenance | `data/fixtures/**`, `data/schemas/**` | Exact architecture fixture inventory validates, all synthetic assumptions labeled |
| C2 local delivery | `infra/local/**` | Web/API/DB health/start wiring with no embedded secrets; migration runs once |
| C3 independent E2E | `tests/e2e/**` | Real API-backed buyer/supplier journey and negative scenarios |

Parent retains `contracts/**`, `scripts/**`, `data/manifest.json`, root files and `.github/**`; do not give these paths to multiple children. The data worker cannot invent authoritative match outputs: expected outcomes are checked against hand-calculated invariants and the engine.

Platform/data acceptance:

- Seed files match JSON Schema, counts and foreign keys; repeated seed does not duplicate reservations.
- Demo reset refuses a non-demo database. No production deployment command seeds automatically.
- Contracts and generated clients match backend output.
- No external map/LLM API is needed for the demo. A provider failure is surfaced explicitly.
- Clean machine instructions specify prerequisites, environment setup, migration, seed, start and health verification.
- CI reports which tests ran and any skipped gate; a green lint check alone is not integration evidence.

## 8. Ready-to-use lead briefs

### Sol A brief

> Implement Lane A from docs/CARBONBRIDGE_ARCHITECTURE.md and this plan. Own only apps/web/**. Consume contracts without editing them. Build the requirement → explanation → estimate → request flow first, then supplier acceptance UI. Use server-calculated outcomes. Cover loading, empty, error, unknown and stale states. Delegate bounded Terra work only within explicitly assigned subtrees and available runtime capacity. Do not modify backend, shared contracts or Git history. Report changed paths, checks and unresolved contract needs.

### Sol B brief

> Implement Lane B from the final architecture. Own only apps/api/**, including all migrations and API tests. Use PostgreSQL, explicit units, bounded supply periods, deterministic matching and immutable decisions. Implement party authorization, idempotent requests and row-locked acceptance. All edits to shared contracts go through Lane C. Delegate pure matching/catalog/request Terra subtasks with disjoint paths; retain schema migrations and transaction integration yourself. No Git history operations. Report invariant test evidence and endpoint gaps.

### Sol C brief

> Implement Lane C from the final architecture. Own contracts/**, data/**, infra/**, scripts/**, tests/e2e/**, .github/** and the named root files. Publish contracts early, maintain the exact synthetic fixture inventory and provenance, wire the local stack, and test the real end-to-end journey. Backend migrations remain Lane B's. Delegate bounded Terra work for fixtures, local delivery and E2E only where capacity permits. Keep secrets and original PDFs out of commits. Report reproducible startup, test results and deployment limitations.

### Terra child brief template

> Complete [bounded task] using architecture version 1.0. You may edit only [exclusive paths]. Inputs are [DTO/service interfaces] and expected exports are [names]. Do not edit shared dependencies, routes, migrations, fixtures or configuration outside your assignment. Test [specific invariant]. If the contract is insufficient, report the exact needed change to your Sol lead rather than editing another owner's files. Return changed paths, test result and any remaining issue.

## 9. Verification that matters

| Check | Expected evidence | Owner |
|---|---|---|
| Baseline ranking | S01, S04, S06 compatible; order A → D → F at equal evidence age | B + C |
| High-purity shortage | S02 fails by 20 t despite 99% purity | B |
| Purity gap | S03 reports 3 percentage points; alternate R02 passes only after all checks | B + A |
| Impurity violation | S05 water 200 vs 100 ppmv wet fails | B |
| Unknown / expired | S07/S08 separate from ranked results; no fabricated zero | B + A |
| Comparable basis | Dry/wet mismatch or unsupported mass-to-mole conversion returns unknown | B |
| Delivered economics | A 2,120; D 2,240; F 2,300 INR/t; all exclusions visible | B + A |
| Rule boundaries | Exactly-at-limit purity/impurity, MOQ, zero/negative values, date boundaries | B |
| Concurrency | Two 60 t accepts against 100 t yield one success and one 409 | B + C |
| Idempotency | Retry and double-click produce one request/allocation | B + C |
| Stale snapshot | Changed price/quality/version requires refresh; old receipt unchanged | B + C |
| Privacy | Unrelated tenant cannot read/mutate/export private records | B + C |
| Seed safety | Empty DB load, second load and disposable reset behave as specified | C |
| Core UI | Browser refresh, keyboard flow, error recovery, narrow screen | A + C |
| Claim integrity | No accepted request shown as reused or avoided emissions | A + C |

Concurrency and migrations must run on PostgreSQL; SQLite is not a substitute for these checks. Test pure arithmetic with Decimal, service behavior at the database boundary, and the core journey in a real browser. Do not spend the last hour writing trivial tests that only mirror presentation code.

## 10. Integration, Git and review rules

Prefer isolated branches/worktrees when the runtime supports them. Otherwise use one shared workspace with the exclusive ownership map and **one coordinator managing the Git index, commits and merges**. Agents never run simultaneous commits, rebases, resets or checkout operations in a shared worktree. A lane handoff states exact changed files, exported interfaces, tests and known gaps.

Integrate at hours 1, 4, 7 and 10 rather than at the end. Each gate checks contract compatibility and the existing demo spine. Later edits cannot break an earlier gate. If ownership must change, the old owner stops writing and acknowledges the handoff before the new owner edits.

This planning delivery commits only these two Markdown documents to the user-provided repository. It does not publish original PDFs, personal source metadata, research scratch notes or an unimplemented application scaffold. During implementation, use small reviewable commits for each integrated gate, and a release tag only after the demo checks pass.

## 11. Demo script and fallback

1. **0:00-0:40:** Open the demo buyer requirement: 100 t, min 95%, exact October period and explicit impurity limits.
2. **0:40-1:30:** Show S01 recommended. Explain required vs actual quality and remaining quantity.
3. **1:30-2:10:** Compare the listed/delivered values on S01 and S06's P0 result cards. Expand the formula. Use the dedicated P1 comparison route only if it is complete.
4. **2:10-2:50:** Show S02 quantity failure and S03 purity gap; show an eligible alternative buyer if implemented.
5. **2:50-3:40:** Submit a request, switch to a labeled supplier demo session, accept and show the updated reservation/timeline.
6. **3:40-4:00:** Open the decision receipt or unknown-evidence case. State that all commercial data is synthetic and production verification is future work.

Rehearse with the normal backend and persisted seed data. Keep the app local if no production-safe hosted environment is ready. If a live service fails, show a clearly labeled recording or screenshot of the tested flow; never pretend a static response is a successful transaction. Offline demo data removes map-provider dependency but must not conceal API failures.

## 12. Scope cuts and complete post-demo roadmap

| Stage | Features / necessary work | Exit condition |
|---|---|---|
| 12-hour P0 | Core marketplace, requirements, explainable matching, estimated cost, request/accept, permissions and consistency | Integrated demo and decisive tests pass |
| P1, if time | Compare, alternate buyer, JSON decision receipt, isolated what-if | Adds value without breaking P0; cut at hour 10 |
| Next feature increment | Finish any deferred P1, supplier edit/archive workflow, request expiry maintenance | All transitions and affected snapshots tested |
| Supporting sustainability | Projects, reviewer evidence scope, participation, optional material-flow events | No offset netting; captured/reused values require corresponding records |
| Pilot evidence and operations | Private lab documents, reviewed buyer specs, real OIDC, trusted facility data, live quote adapter, rate limiting, backup/restore, observability | Architecture release gates proven with partner data |
| Real commercial lifecycle | Buyer/supplier terms, post-accept cancellation/release, dispatch/receipt/dispute flows, notifications with outbox | Inventory and state invariants hold through fulfillment |
| Negotiated bidding | Bid expiry, versioned counteroffers, buyer acceptance, contract snapshots | No ambiguity over which terms reserve capacity |
| Optional assisted explanations | LLM summarizes stored rule facts; opt-in redaction and deterministic fallback | Cannot change gates, invent evidence or issue suitability claims |
| Impact assessment, only with experts | Reviewed lifecycle method, baseline, boundary and evidence | Separately assessed claims; no reuse=avoidance shortcut |
| Production launch | Security/access review, restore drill, load test, incident/rollback runbooks, partner acceptance | Named owner approves evidence for every production gate |

Post-demo stages are dependency ordered, not a promise they fit into another fixed day. Estimate them after reviewing the built baseline and partner needs. No architecture document or downloaded starter makes a real industrial marketplace production-ready automatically.

## 13. Definition of done for the planning package

The package provides a chosen product scope, page-by-page source grounding, architecture and workflow diagrams, screen inventory, module boundaries, roles, data entities, seed formats/provenance, matching formulas, API/state contracts, concurrency rules, production gates, an hourly schedule and disjoint Sol/Terra assignments. Implementation artifacts, runnable fixtures, security audits and passing application tests remain work for the implementation phase. The next action is to execute the hour-0 contract/startup gate, not redesign the entire product.
