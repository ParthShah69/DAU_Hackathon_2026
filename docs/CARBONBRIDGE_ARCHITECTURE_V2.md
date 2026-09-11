# CarbonBridge Architecture Plan - Version 2

Version 2.0 | 12 September 2026 | Complete design specification; implementation and production validation remain to be performed

Read this architecture first, then the [Implementation Plan V2](CARBONBRIDGE_IMPLEMENTATION_PLAN_V2.md). Baseline: [Architecture V1](CARBONBRIDGE_ARCHITECTURE.md) and [Implementation Plan V1](CARBONBRIDGE_IMPLEMENTATION_PLAN.md), committed as `192b3c5424a182b6666ea61cce7069136025b128`.

## 1. Upgrade contract and product direction

**CarbonBridge V2 = the complete V1 marketplace + a conversational orchestration layer + evidence-backed process/resource discovery.** Users can describe their business, discover potentially valuable outputs, prepare listings or requirements, compare options, manage requests and obtain explanations using ordinary language. Every operational capability also has a manual interface.

The user has removed the 12-hour limit. Delivery is now organized around capability and quality gates, not a hackathon clock. The goal is an achievable academic product with a credible path to a real pilot. More development time is used for better evidence, reliability and usability, rather than additional infrastructure without a need.

The repository currently contains plans, not an implemented V1 application. Therefore, preserving V1 means retaining its complete design and building missing modules, not claiming a working system already exists. If implementation exists elsewhere when development starts, inventory and adapt it before changing anything. Original V1 documents remain unchanged as the baseline.

### What V1 already designed

React/TypeScript manual marketplace, FastAPI modular backend, PostgreSQL; supplier streams and bounded supply periods; buyer requirements; unit-aware quality checks; deterministic matching and delivered estimates; compare, gap explanations, alternative buyers, what-if scenarios and decision receipts; requests and atomic reservations; organization permissions; NGO/projects and material-flow accounting; evidence, notifications, bidding, fulfillment and production operations as staged extensions.

### What changes in V2

Add a persistent assistant, process discovery workspace, specialist agents, tool registry, durable workflow coordinator, scoped retrieval, source-backed market/policy knowledge, action previews and confirmations, agent evaluation and synchronized chat/UI updates. Promote assisted explanations from an optional V1 extension into the main experience. Fully design the environmental/policy and deferred commercial modules while retaining a staged release plan.

### What stays unchanged

All V1 roles, manual screens, APIs, tables, business invariants and existing scoring/cost formula versions remain supported. The chatbot never replaces authorization, quality logic, inventory accounting, monetary calculation or legal review. V1 API paths remain available under `/api/v1`; V2 document version does not require breaking the HTTP API version.

### Scope of materials

Captured CO2 remains the first fully supported tradable material and preserves HackOut statement 8 alignment. Discovery may identify other potentially useful outputs from a process. Those become evidence-linked **resource opportunities**, not automatic CO2 listings. Additional materials require explicit category adapters for quality, quantity, commercial basis and trade eligibility; unsupported categories remain research opportunities. This expands the user's process-discovery idea without treating ash, heat, gases and liquid residues as interchangeable commodities.

No device integration is part of this plan. Inputs are natural-language descriptions, manual forms, uploaded documents, reviewed source material and partner-approved data APIs.

## 2. Version 1 versus Version 2

| Area | Version 1 | Version 2 |
|---|---|---|
| User interaction | Forms, buttons and dashboards | Same controls plus conversational task execution |
| Marketplace | Captured-CO2 supply and demand | Preserved; discovery can prepare evidence-linked drafts |
| Search | Structured filters | Same search service accepts validated natural-language parameters |
| Recommendations | Deterministic matching, gaps and alternatives | Same calculations plus grounded explanation and next-step coordination |
| Carbon analysis | Quality/material-flow design; limited calculations | Adds process hypotheses and versioned estimation methods, separate from measurements |
| Compliance | No universal limit; production review boundary | Scoped policy library, reviewed rules, screening results and human review |
| NGO interaction | Projects and separate participation records | Same records managed manually or through the environment specialist |
| Reports | Dashboards and decision receipt | Grounded conversational analytics and reproducible report jobs |
| Automation | User initiates each workflow | Durable multi-step workflows with permissions, approvals and recovery |
| AI | Optional explanation layer | Intent/extraction, discovery, retrieval, specialist reasoning and tool selection |
| Backend | Modular monolith and shared services | Same core plus orchestration, knowledge, actions and job modules |
| Database | Relational marketplace, audit and snapshots | Additive conversation, discovery, source, action and policy tables |
| Security | Tenant/role checks, idempotency, audit | Same checks plus tool scopes, prompt-injection defenses and bound approvals |
| User experience | Requires users to know which fields matter | Helps identify missing information and lets users review/edit it visually |
| Production claim | Design and release gates | Still requires implementation, partner validation and operational evidence |

## 3. Complete system diagram

```text
 BUYER / SELLER / ORG ADMIN / NGO EDITOR / REVIEWER / PLATFORM ADMIN
                              |
                    HTTPS + OIDC session
                              v
 +---------------------------------------------------------------------+
 | REACT WEB APPLICATION                                               |
 | Marketplace | Buyer/Seller dashboards | Forms/Search/Compare         |
 | Processes/Discovery | Evidence | Policies | NGO projects | Reports    |
 | Requests/Offers/Fulfillment | Admin | Assistant panel + full chat      |
 +-------------------------+------------------------+------------------+
                           | Manual REST            | Chat REST + SSE
                           v                        v
 +---------------------------------------------------------------------+
 | FASTAPI API: identity, tenant scope, validation, limits, request IDs  |
 +---------------------+-----------------------------------------------+
                       |                  |
                       |       +----------v---------------------------+
                       |       | CONVERSATION + WORKFLOW LAYER         |
                       |       | Message/context store                 |
                       |       | Intent + entity extraction            |
                       |       | Orchestrator + durable workflow state |
                       |       | Specialist registry + LLM gateway     |
                       |       | Scoped retrieval + prompt versions    |
                       |       | Typed tool gateway + action policy    |
                       |       | Preview/approval + result renderer     |
                       |       +-----------------+--------------------+
                       |                         | controlled calls
                       v                         v
 +---------------------------------------------------------------------+
 | SHARED APPLICATION SERVICES - SAME RULES FOR CHAT AND MANUAL UI       |
 | Identity/Organizations | Catalog/Materials | Buyer requirements       |
 | Seller management | Search | Quality | Matching | Logistics           |
 | Requests/Reservations | Bids/Offers | Fulfillment/Disputes             |
 | Process discovery | Evidence | Market intelligence | Policies         |
 | NGO/Environmental action | Material flows/Claims | Analytics/Reports  |
 | Moderation/Admin | Notifications | Audit | Action execution           |
 +-------------------------+-----------------------+-------------------+
                           |                       |
              +------------v-----------+    +------v------------------+
              | POSTGRESQL             |    | PRIVATE OBJECT STORAGE  |
              | All V1 tables          |    | Reports, lab documents  |
              | V2 additive tables     |    | Reviewed source assets  |
              | Full-text retrieval    |    | Scanned uploads         |
              | Jobs/outbox/checkpoints|    +-------------------------+
              +------------+-----------+
                           |
              +------------v------------------------------------------+
              | WORKER: ingestion, workflow steps, expiry, reports,   |
              | notifications; bounded retries + idempotency          |
              +-------------------------------------------------------+

 ADAPTERS (server only, scoped data, timeouts, provenance):
 OIDC provider | LLM API | approved knowledge/price/policy sources
 route/quote provider | optional email | malware scanning

 CROSS-CUTTING: role/tenant checks, approved actions, encryption,
 source lineage, audit, tracing, evaluation, backups and release gates
```

Deploy one API application and one worker from the same codebase, with PostgreSQL and private object storage. Specialists are logical modules with different prompts, tools and typed outputs; they are not ten separately deployed microservices. Core transactions run without LLM dependencies. Avoid Kafka, Kubernetes, a separate vector database and multiple overlapping agent frameworks initially.

## 4. User experience: process first, two equal interaction modes

### 4.1 Seller discovery journey

1. User selects **Describe my process** or types into the assistant. The same intake exists as an editable process form: product, inputs, steps, energy, outputs, collection method, scale and period.
2. The discovery specialist extracts a structured process and asks only for missing details that affect the answer. It does not demand every industrial field upfront.
3. It retrieves relevant reviewed process references and returns possible outputs with evidence, uncertainty, possible use categories and required checks. It may explicitly say the available description is insufficient.
4. The user selects an opportunity. CarbonBridge creates a resource record and an evidence checklist. Potentially generated CO2, recoverable CO2, actually captured CO2, available inventory and certified quality are distinct states.
5. Market intelligence retrieves comparable listings or sourced price observations. Estimates show material/form/grade, quantity basis, location, date, currency, price type and exclusions. If comparables are absent, it says **Price evidence unavailable**.
6. The seller supplies actual quantity/quality data or uploads evidence, then asks the assistant to prepare a listing. The manual editor shows the identical fields and missing information.
7. A valid draft is reviewed and published under the action policy. Unsupported or insufficiently evidenced resources remain opportunities; discovery never fabricates available inventory.
8. Seller dashboard shows incoming requests, remaining availability, evidence gaps and eligible buyer opportunities. All can be explored through chat.

### 4.2 Buyer journey

User describes application, quantity, dates and budget. The buyer specialist extracts a draft, identifies missing approved quality specifications, and offers editable fields. It must not invent a buyer's safety/quality requirements from an industry name. Once saved, the existing matcher returns compatible, incompatible and needs-evidence groups. The comparison specialist explains stored checks and costs, including what-if and two-supplier plans when enabled. User reviews exact request terms, submits and follows the same V1 timeline.

### 4.3 NGO, environmental and admin journeys

NGO editor creates a project; reviewer checks evidence and scope; company records participation. Policy guidance cites applicable sources and identifies missing facts. Internal targets remain distinct from regulation. Admins moderate reported listings, curate knowledge and approve rule versions using explicit capabilities and audit. None of these actions can be obtained merely by asking the assistant to act as an admin.

### 4.4 Presentation components and navigation

Preserve `/marketplace`, `/requirements/new`, `/requirements/:id`, `/matches/:runId`, `/compare`, `/listings/:id`, `/supplier/listings/new`, `/requests`, `/requests/:id`, `/dashboard`, `/projects`, `/review`.

Add `/assistant`, `/processes`, `/processes/:id`, `/opportunities/:id`, `/evidence`, `/policies`, `/screenings/:id`, `/reports`, `/activity`, `/settings/automation`; later `/purchase-plans/:id`, `/offers/:id`, `/fulfillment/:id`. User and organization settings remain accessible outside chat. Every launched feature must have both a manual route/control and supported chat action or a safe handoff to its manual control.

Use a persistent assistant side panel beside the current page and a full-screen chat route on small screens. Render typed cards: process summary, opportunity, missing-field checklist, quality matrix, comparison, action diff, approval, job progress and receipt. The LLM cannot generate executable HTML or invent navigation targets. Chat-generated forms are normal reusable UI components with validated data.

Both paths use the same service responses. Successful writes return affected entity IDs and versions; client query caches invalidate those records. Server events announce commits to other tabs. A dirty manual form is not overwritten; show a conflict/review banner. Follow-ups like "the second one" resolve against a saved result-set ID and ordered entity IDs, then recheck current versions. Membership changes or switching organizations invalidates old context and pending actions.

Every view needs loading/empty/error/stale/permission-denied states. Chat additionally distinguishes preparing, waiting for information, waiting for approval, running, partially completed, completed and failed. Preserve keyboard navigation, semantic labels, focus management, non-color status, reduced motion and 390 px responsive layouts from V1. Display operational summaries, not hidden model reasoning. Voice and additional languages are optional later inputs to the same text/task pipeline.

## 5. AI responsibilities and specialist contracts

### 5.1 Three execution modes

| Mode | Appropriate tasks | Source of truth |
|---|---|---|
| LLM | Intent, language understanding, process extraction, explanation and drafts | Model output is a proposal, never verified industrial data |
| LLM + context | Discovery using reviewed sources; compare database results; explain policy or analytics | Authorized retrieved records with IDs, versions and citations |
| Deterministic service/database | Permissions, validation, arithmetic, hard quality gates, ranking, reservation and writes | Application services, versioned rules and committed database records |

Use structured outputs for intent/parameters and strict tool schemas where supported. Schema validity does not establish factual correctness or authorization; server validation remains mandatory. Function calling connects the model to application-owned execution rather than granting database access. [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

### 5.2 Specialist registry

| Specialist | Inputs and permitted tools | Output and boundary |
|---|---|---|
| Process discovery | Process text/steps, scoped process references, evidence | Candidate outputs, cited rationale, questions and prerequisites; cannot publish |
| Market intelligence | Resource/form/quality/location/date; price observations and published comparable offers | Comparable range or unavailable result; no invented live price |
| Seller manager | Owned listings/periods, evidence, incoming request summaries | Listing drafts, validated patches and opportunity tips; writes through action gateway |
| Buyer manager | Owned requirements and approved use specifications | Requirement drafts/edits, missing constraints and saved searches |
| Matching/comparison | Requirement/listing IDs, match service, cost/quality snapshots | Explained deterministic ranking, gaps, alternatives and scenario results |
| Commercial workflow | Requests, offers, allocation/fulfillment services | Prepared requests and permitted transitions; no unilateral counterparty action |
| Evidence/quality assistant | Lab document extraction, quality services, document provenance | Proposed fields and missing evidence; reviewer approval distinct from extraction |
| Environment/policy | Approved policies/rules, site facts, targets, NGO/projects | Scoped screening, guidance and project options; never legal certification |
| Analytics/reporting | Approved aggregate queries, match receipts, flow events | Cited metrics, charts, summaries and reproducible reports; no arbitrary SQL |
| Admin assistant | Curator/moderator tools available only to authorized admin/reviewer | Proposed moderation or knowledge changes with audited approval |

The orchestrator owns the user conversation and final result. Specialists return schema-constrained data to it; they do not message one another indefinitely or inherit expanded permissions. A supervisor may select several specialists for a task, but a server workflow defines valid dependencies. Start with discovery, seller, buyer, matching and environment/reporting tool groups; splitting prompts further is a quality/maintenance choice, not a need for more infrastructure.

### 5.3 Intent and context

An intent envelope contains schema version, intent enum, referenced entities, extracted fields with units, missing fields, requested operations and an ambiguity flag. Support multiple intents as a bounded ordered plan. Examples: `discover_process_outputs`, `prepare_listing`, `update_listing`, `create_requirement`, `find_matches`, `compare_options`, `prepare_request`, `accept_request`, `screen_policy`, `find_projects`, `generate_report`.

The server resolves actor, organization and capabilities from the authenticated session. These are not model-supplied arguments. Record context as entity pointers plus versions, active result sets, explicit preferences and workflow state. Recent chat and a source-linked summary assist interpretation but never replace current database reads. Do not carry another tenant's context into a new organization session. Persistent preferences are editable; user conversations do not become cross-tenant knowledge.

### 5.4 Full message flow

1. Authenticate and authorize access to the conversation; persist message with a client idempotency ID and tenant.
2. Build minimal context from permitted entity references and recent turns. Scan attachments in an isolated ingestion job before retrieval.
3. Model returns intent/entities or a clarification. Backend validates the envelope and resolves ambiguous IDs through scoped lookup.
4. Orchestrator creates a bounded workflow and selects tool groups allowed for this user and task. Store prompt/model/tool versions.
5. Relevant specialist retrieves scoped data and calls read-only calculation/search services. Independent reads may run in parallel.
6. A proposed mutation is sent to the action gateway. It validates fields, ownership, business constraints and resource versions, then creates a canonical preview.
7. Execute explicitly authorized low-risk work or pause for a required approval. The preview is rendered from server data, not LLM prose.
8. On execution, recheck permissions and versions, apply a short database transaction, append audit/outbox records and return a committed receipt.
9. Orchestrator synthesizes a response from tool outputs. Values, result IDs and citations come from receipts; a failed/unknown operation is never described as completed.
10. Stream typed progress/result events to the UI, invalidate affected queries, and preserve the workflow for follow-up or recovery.

Example: "List the useful outputs from this process and find buyers" may complete discovery and buyer-category research while pausing listing publication because actual captured quantity is missing. It returns the completed work and one specific question, rather than guessing or abandoning the task.

## 6. Durable orchestration and controlled actions

### 6.1 Tool gateway

Every tool has name/version, typed input/output, required capability, risk class, read/write designation, timeout, idempotency behavior and permitted entity scope. No tools named `execute_sql`, `run_shell`, `call_any_url`, `update_any_table` or arbitrary code execution are exposed to the product assistant. Tool handlers call existing service functions in-process or through authenticated internal endpoints. They do not bypass routes' business rules.

An action record stores actor/org, originating conversation/workflow, operation, canonical arguments, entity versions, before/after summary, risk class, authorization basis, payload hash, expiry and result. Sensitive approval binds **actor + organization + operation + exact payload + versions + expiry**. A natural-language "yes" only approves one unambiguous pending card in that conversation; otherwise ask which action. The commit tool does not let the model fabricate an approval token.

### 6.2 Action policy

| Class | Examples | Default behavior |
|---|---|---|
| Read/calculation | Search, compare, retrieve own history, explain a policy | Execute within access scope; no confirmation |
| Reversible private work | Save draft, update an unshared note, prepare requirement | Execute on explicit user instruction or bounded opt-in preference; show receipt and versioned undo |
| Externally visible change | Publish listing/requirement, change public price/quantity, send a request/message | Canonical preview and explicit approval; batch approval allowed for a bounded enumerated set |
| Commercial/privileged change | Accept/reserve supply, counteroffer acceptance, release reservation, approve evidence, admin moderation | Exact preview and approval; capability checks and stronger authentication where appropriate |
| Unsupported/prohibited | Invent lab data, waive a required quality gate, act for another tenant, issue legal certification | Reject action; explain missing authority/evidence or supported alternative |

Avoid repeated confirmations for the same approved payload. Low-risk preferences have explicit scope, limits and revocation; no blanket "do everything" policy grants commercial authority. A new payload, changed resource version or expired approval requires a fresh preview. User cancellation stops future steps; completed side effects remain visible and use explicit compensating actions where supported.

### 6.3 State and recovery

Workflow states: `queued -> running -> waiting_for_input | waiting_for_approval -> running -> completed | partially_completed | failed | cancelled`. Steps store dependencies, status, attempts, lease owner/expiry, checkpoint, input/output references and idempotency key. Action states: `prepared -> awaiting_approval -> approved -> executing -> succeeded | failed | unknown_outcome`; also `rejected`, `expired`, `superseded` before execution. Private authorized actions may pass directly from prepared to executing after policy validation.

Use PostgreSQL-backed jobs with short leases and `FOR UPDATE SKIP LOCKED`. Do not hold a database transaction while waiting for an LLM, approval or external service. Persist step results before scheduling dependents. Reads may retry with bounded backoff. Writes use stable operation keys; after a timeout query the action ledger/provider status before retrying. Unknown external outcomes remain blocked from blind re-execution. Exactly-once delivery across networks is not promised; idempotent business effects and reconciliation are the goal.

Initial configurable limits: maximum 6 model turns, 10 tool calls and 3 concurrent read tools per interactive workflow; synchronous provider timeout 30 seconds; long jobs continue asynchronously with visible progress. Writes affecting shared records are serial. Exceeding limits pauses with a useful partial result and resume option. Measure model tokens, cost and latency per run; budget limits do not cause an unreported tool change or skipped approval.

### 6.4 Manual and conversational equivalence

Manual flow: user form/button -> authenticated API -> prepare/validate action where needed -> shared service -> transaction/database -> receipt -> UI refresh.

Chat flow: message -> intent/context -> orchestrator/specialist -> typed tool -> same preparation/policy -> same service/transaction -> receipt -> assistant card and UI refresh.

For mutation equivalence, the same canonical command, actor and resource version must produce the same state transition through either path. Existing V1 endpoints remain valid; a manual form can carry explicit reviewed terms as authorization. Chat approvals are additional evidence of user intent, not an alternate authorization system.

## 7. Application services and preserved domain rules

| Service/module | Responsibilities retained or added |
|---|---|
| Identity and organizations | OIDC sessions, users, memberships, buyer/supplier capabilities, invitations and account recovery |
| Catalog and materials | Draft/publish/edit/archive listings, supplier profiles, quality versions, supply periods and category adapters |
| Buyer requirements | Draft/publish/edit requirements, application context, impurity limits, discovery opt-in and saved searches |
| Search and filters | Typed filters, bounded pagination, tenant/public-field projections; no LLM-generated SQL |
| Quality | Unit/basis validation, evidence freshness, impurity checks and missing-data reasons |
| Matching and logistics | Deterministic compatibility, ranking, delivered estimates, comparison, gap analysis, alternative buyers, receipts and scenarios |
| Requests and reservations | Authorized fixed-terms requests, accept/decline/cancel/expiry, idempotency and transactional capacity |
| Commercial extensions | Versioned bids/offers, post-accept release, dispatch/receipt/disputes; staged independently of the V1 state machine |
| Process discovery | Structured processes, candidate outputs, opportunity readiness and reviewed promotion into catalog drafts |
| Knowledge and evidence | Approved source ingestion, document extraction, access filtering, evidence review and provenance |
| Market intelligence | Comparable observations, price basis/date/source and opportunity analysis; no fictitious current market rates |
| Policies and screening | Versioned jurisdiction-specific rules, applicability facts, explicit unknowns and review workflow |
| Sustainability | NGO projects, participation, targets, corrective-action plans, material-flow records and separate impact claims |
| Analytics and reports | Authorized aggregate queries, metric definitions, snapshots, exports and report lineage |
| Notifications and jobs | In-app activity, opt-in external delivery, durable jobs, outbox and reconciliation |
| Admin and moderation | Scoped moderation, reported-content queue, knowledge/rule approval, suspension and audited overrides |

### 7.1 V1 compatibility invariants

Keep UUID IDs, UTC timestamps, integer paise for money and decimal strings/NUMERIC for quantities. Dates use explicit half-open intervals. Quantity is contained CO2 mass in tonnes for the CO2 adapter; purity is a separate measured property. Retain dry/wet mol-percent and ppmv distinctions; an unknown analyte is null, not zero. A dry/wet or mass/mole conversion without necessary input remains incomparable. Preserve all V1 detection-limit, composition, report-expiry and physical-form checks.

Eligibility remains: any known hard failure -> `incompatible`; otherwise missing critical evidence -> `needs_evidence`; all required checks pass -> `compatible`. Evaluate publication state, covering period, form, minimum purity, each required impurity, evidence, MOQ, remaining quantity, cadence and configured distance/budget limits. No chatbot instruction can relax a safety/quality limit automatically.

Retain the V1 cost formula `linear-road-demo-v1`: handling per tonne + distance × rate per tonne-km, added to listed price. Decimal calculations round monetary outputs half-up. Show excluded taxes/conditioning/equipment/transport feasibility; a synthetic matrix is never a real route quote. Production quote adapters are separate versioned methods.

Retain V1 ranking exactly: `100 × (0.45 cost_fit + 0.20 distance_fit + 0.15 quantity_headroom + 0.20 evidence_freshness)`, with cost scale INR 4,000/t, distance scale 600 km, capped remaining-minus-required headroom and a 30-day demo freshness scale. These remain demo policy, not standards. Keep tie-breaking by delivered cost, distance, then UUID. A new ranking policy gets a new version and side-by-side validation; it does not reinterpret saved receipts.

V1 request states remain `submitted`, `accepted`, `declined`, `cancelled`, `expired`. Acceptance locks the supply-period and request records in consistent order, rechecks terms/evidence/capacity, inserts a unique reservation and commits state/audit atomically. An accepted request is not delivery or a legal contract. Effective expiry is derived on reads and persisted on mutation/maintenance. Current versions and idempotency checks apply equally to chat and manual actions. PostgreSQL documents the row-locking behavior used for these transactions. [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html).

### 7.2 Process analysis and economics

Represent a process as ordered steps with input/output relations, scale, period, units, collection status and evidence. Discovery records have states `hypothesis`, `needs_information`, `evidence_supplied`, `reviewed`, `promoted_to_draft`, `rejected`. State refers to the discovery workflow, not an unconditional material-quality approval.

For quantitative estimates, use only approved methods with applicability conditions, parameters, source, unit conversion and uncertainty. For example, an activity-based emission estimate is activity × an applicable factor; it is not automatically captured or saleable mass. Capture/recovery/storage losses need separate supporting inputs. Missing values stay missing. EPA describes emission factors as representative estimates often based on category averages, which is why they cannot replace site measurements. [EPA AP-42 FAQ](https://www.epa.gov/air-emissions-factors-and-quantification/ap-42-frequent-questions).

Economic cards distinguish gross sales estimate, delivered cost, known treatment/handling cost, and unknown costs. No profit/payback number is shown without the required inputs. Indicative ranges cite comparable observations and sample count. List prices, indicative quotes and executed transaction prices are distinct types; private transaction observations cannot leak across tenants. A stale observation may appear in a historical report but cannot be labeled current.

### 7.3 Extended deal planning and commercial lifecycle

Retain single-supplier requests as the initial transaction path. An advanced `purchase_plan` may allocate demand across at most two individually compatible suppliers. Each leg obeys MOQ, date/form, remaining capacity and quality; the buyer explicitly enables separate deliveries. Do not average impurity profiles or represent this as gas blending. Calculate plan costs deterministically, compare to the single-supplier baseline and explain uncovered demand. Re-running with an excluded supplier creates a new scenario, not a silent order change.

Initially, converting a plan prepares separate requests. Plan status distinguishes `proposed`, `partially_confirmed`, `fully_confirmed`, `unavailable`; it never claims all inventory is secured when only one supplier has accepted. Cross-supplier all-or-none allocation is a later reviewed workflow, not an accidental consequence of multiple tool calls.

Preserve the V1 roadmap for negotiation and fulfillment through separate entities: `offers` with immutable `offer_versions` and expiry; buyer-approved accepted terms reference a new request snapshot. `release_requests` require both parties' recorded agreement before releasing accepted reservations. `fulfillments` track dispatch, receipt, loss/rejection and dispute independently of the V1 request state. Partial deliveries consume remaining reserved quantity; invariants enforce dispatched ≤ reserved and received/reused values consistent with evidence. No actual funds move in the initial or academic extended release. Payments and legal-contract execution require separate business integration and approval.

### 7.4 Environmental and policy logic

Store internal goals separately from regulatory criteria. Applicability requires jurisdiction, site, sector/process, reporting period, relevant classification and authoritative effective rule version. The LLM may explain text; only reviewed deterministic rules produce a bounded screening outcome. Return `in_scope`, `out_of_scope`, `undetermined`, `source_conflict` or `source_stale` for applicability, plus `within_reviewed_limit`, `outside_reviewed_limit` or `not_evaluated` for supported numerical comparisons. Neither is a blanket legal compliance certificate.

For India-related material, begin with curated official BEE sources and applicable official notifications, then add state/site-specific requirements after review. BEE describes distinct compliance and offset mechanisms with defined applicability and procedures; a marketplace transaction is not an automatic entitlement to a carbon certificate. [BEE Indian Carbon Market](https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=189).

Maintain captured, reserved, dispatched, received and reused mass separately. Unallocated inventory is not residual plant emissions. NGO participation is a separate record and is never netted automatically against emissions or a legal limit. `avoided_emissions_tco2e` and `removed_co2_t` remain null unless a reviewed assessment supports them. Lifecycle benefits require boundaries, baseline, origin, energy, transport, losses, retention and uncertainty. [IEA CO2 utilization analysis](https://www.iea.org/reports/putting-co2-to-use), [NETL CO2U lifecycle toolkit](https://www.netl.doe.gov/LCA/CO2U).

## 8. Knowledge, retrieval and evidence

Two retrieval paths serve different needs:

- **Structured records:** catalog, quantities, permissions, transactions and metrics are queried through typed database services. Exact numerical records do not rely on vector similarity.
- **Unstructured knowledge:** process descriptions, policies and approved technical documents use source-aware retrieval. Start with PostgreSQL full-text search; add pgvector only if a measured retrieval evaluation improves.

Ingestion pipeline: upload/allowlisted source -> size/type and malware checks -> immutable checksum/version -> isolated text extraction -> metadata/ACL classification -> reviewer acceptance -> chunking with page/section locators -> full-text index -> retrieval evaluation. Keep original document and extracted text links, parser version and access scope. OCR output is proposed data; it cannot directly approve a quality report or policy rule.

Filter **before retrieval** by tenant/document ACL, material/process, publication status, jurisdiction and effective date where relevant. Caches and embeddings inherit the same scope. Retrieve bounded passages, verify citation locators and return a structured evidence bundle. Recheck access before using a persisted bundle after membership changes. If evidence conflicts or is insufficient, show that state rather than making the model choose a convenient answer.

Store evidence labels separately: `user_reported`, `document_extracted`, `reviewer_checked`, `authoritative_source`, `system_calculated`, `assistant_hypothesis`, `synthetic_demo`. Reviewer checks state what was checked; they do not certify a facility. User-uploaded evidence is not promoted into a global corpus without permission and review.

Prompts are version-controlled templates with immutable deployed versions, required schemas, permitted tools and eval results. Treat source documents, marketplace notes, uploads and tool text as untrusted data; none may change the system prompt or tool permissions. Structured node outputs and isolation reduce prompt-injection exposure but do not eliminate it. [OpenAI agent safety guidance](https://developers.openai.com/api/docs/guides/agent-builder-safety).

## 9. Data architecture: preserve first, add explicitly

### 9.1 V1 tables retained without changing their meaning

`organizations`, `users`, `memberships`, `sites`, `streams`, `quality_reports`, `analyte_results`, `supply_periods`, `requirements`, `requirement_limits`, `rate_cards`, `distance_estimates`, `match_runs`, `match_results`, `supply_requests`, `reservations`, `request_events`, `audit_events`, `idempotency_records`, `projects`, `participations`, `material_flow_events`, `impact_claims`, `evidence_documents`, `outbox_events`.

Retain V1 constraints, foreign keys, indexes, tenant projections and snapshot immutability. Add nullable links only after the owning extension exists, such as `streams.discovery_candidate_id`. A non-CO2 discovery candidate cannot be attached to a CO2 stream. Existing users/roles remain; new `ngo_editor`, `knowledge_curator`, `policy_reviewer` and scoped moderator grants are additive. No role is auto-upgraded by migration.

### 9.2 New entities and required fields

| Group / tables | Essential fields and constraints |
|---|---|
| `process_profiles`, `process_versions`, `process_steps` | Org/site, product, immutable submitted description/version, step inputs/outputs, quantity/unit/period, source/evidence pointers |
| `discovery_runs`, `resource_candidates` | Process version, material category, hypothesis/quantity range, evidence status, supporting/contradicting sources, missing fields, method version, promotion target |
| `material_categories`, `estimation_methods` | Supported adapter/schema version, allowed unit/basis/form, method applicability and reviewer state; no arbitrary executable formulas from LLM |
| `conversations`, `conversation_members`, `messages` | Org, allowed participants, role/content references, client message ID, retention state; unique conversation/client ID |
| `conversation_contexts` | Selected entity/result-set pointers and versions, explicit preferences, summary references; scoped to org/conversation |
| `workflow_runs`, `workflow_steps` | Origin message, intent, state, plan version, dependencies, lease/checkpoint, attempts, cancellation, input/output references |
| `agent_runs`, `tool_invocations` | Specialist, model/prompt/tool versions, duration/token cost, validated argument hash, result IDs, error class; no hidden chain-of-thought |
| `action_proposals`, `action_approvals` | Actor/org, canonical payload/hash, versions, risk, authority evidence, expiry, approval/commit state; single business execution key |
| `knowledge_sources`, `knowledge_documents`, `knowledge_chunks` | Publisher/title/URL, trust/reuse status, version/checksum, page/section, scope/ACL, jurisdiction, effective/review dates, search vector |
| `evidence_links`, `evidence_reviews` | Entity/field to document/location relationship, extracted versus confirmed value, reviewer/scope/time |
| `price_observations` | Material/form/grade, geography, quantity/basis, currency/unit, range/point, listed/quoted/executed type, tax/delivery basis, observed/valid dates, source, ACL |
| `policy_documents`, `policy_rules`, `policy_screenings` | Knowledge document/version, jurisdiction, scope/facts/schema, reviewed parameters, effective interval, result/missing facts, immutable evidence snapshot |
| `organization_targets`, `environmental_action_plans` | Internal/regulatory-source distinction, metric/unit/boundary/period, suggested/approved steps and evidence; no automatic offset math |
| `notifications`, `notification_preferences`, `report_jobs` | Actor/org, committed event, channel/delivery state, opted-in preference; report inputs/query/source versions and output metadata |
| `saved_searches`, `recommendation_runs`, `assistant_feedback` | Owner, versioned criteria, scoped opportunities, rationale/result IDs, feedback not used as an unreviewed fact |
| `eval_cases`, `eval_runs`, `eval_results` | Versioned test input/state, expected tools/constraints, actual trace, scored metrics and release verdict |
| `purchase_plans`, `purchase_plan_legs` | Later: parent scenario, requirement/versions, per-supplier allocations, cost snapshot, linked requests and partial confirmation |
| `offers`, `offer_versions`, `release_requests`, `fulfillments`, `disputes` | Later: negotiated terms, counterparties/expiry, recorded approvals, delivered quantity/events and dispute state |

All tenant-owned rows require org scope; relationship constraints must prohibit mismatched tenant references except explicitly modeled buyer/supplier sharing. Audit hashes do not replace source retention. No blanket `ON DELETE CASCADE` from conversations to marketplace records: deleting a chat must not delete a reservation, receipt or project participation.

### 9.3 Additive migration sequence

Migrate V1 core unchanged -> add knowledge/process tables -> policy/environment extensions -> conversation/workflow/action tables -> optional commercial tables. Use expand/backfill/validate, then feature enablement. Keep new relationships nullable for historical records; a historic manually created listing does not need a conversation. Never manufacture provenance for old rows. Snapshot/rule versions stay immutable. Test upgrade from an actual V1 seeded database, not only empty schema creation.

## 10. API and tool catalog

### 10.1 Retained V1 surface

Keep `GET /me`; listing GET/POST, detail GET/PATCH and publish; requirements GET/POST and detail GET/PATCH; match-runs POST/GET, scenarios POST and receipt GET; alternative-buyers POST; requests GET/POST/detail and accept/decline/cancel POST; dashboard GET; projects GET/POST; participations POST; health live/ready GET. All are under `/api/v1` with V1 error conventions, cursor pagination, UUIDs, decimal strings and explicit versions. Archive/unpublish/project review details may be added as new operations, never by changing existing meanings.

### 10.2 Additive endpoints

| Endpoint group under `/api/v1` | Main operations and service |
|---|---|
| `/capabilities` | GET manual-route/tool/permission manifest for current user |
| `/processes`, `/processes/{id}` | POST/GET/PATCH structured process; append process versions |
| `/processes/{id}/discoveries`, `/discoveries/{id}` | POST discovery job / GET structured outcomes |
| `/resource-candidates/{id}/listing-draft` | POST validated CO2 draft preparation, not publication |
| `/evidence/uploads`, `/evidence/{id}/review` | POST scoped upload metadata / authorized field review |
| `/knowledge/search`, `/price-observations` | POST scoped retrieval / GET comparable observations |
| `/policies/search`, `/policy-screenings` | POST dated retrieval / POST/GET reviewed-rule screening |
| `/organization-targets`, `/environmental-action-plans` | GET/POST/PATCH own targets and action plans |
| `/conversations`, `/conversations/{id}/messages` | POST/GET conversations and messages; owner/member checks |
| `/workflows/{id}`, `/workflows/{id}/events` | GET status / resumable SSE events with scoped access |
| `/workflows/{id}/resume`, `/workflows/{id}/cancel` | POST input/continuation or stop-future-steps request |
| `/actions/prepare`, `/actions/{id}/approve`, `/actions/{id}/execute` | Typed preview, authenticated approval and guarded execution |
| `/reports`, `/reports/{id}` | POST report job / GET status and authorized download |
| `/activity`, `/notification-preferences`, `/saved-searches` | GET events; GET/PATCH preferences; GET/POST/PATCH saved criteria |
| `/admin/knowledge`, `/admin/policy-rules` | Reviewed source/rule lifecycle with restricted capabilities |
| `/purchase-plans`, `/offers`, `/release-requests`, `/fulfillments`, `/disputes` | Later versioned plan and commercial workflows |

SSE event envelope: `{event_id, workflow_id, sequence, type, payload, occurred_at}` with types `step_started`, `needs_input`, `action_preview`, `action_committed`, `result_card`, `failed`, `completed`. Reconnection uses the last sequence; replaying an event must not repeat an action. Browser session auth applies to SSE; never put long-lived credentials in a URL. A polling fallback preserves functionality where streaming is unavailable.

### 10.3 Typed tools and outputs

Tools include `retrieve_process_sources`, `analyze_process`, `get_price_comparables`, `search_listings`, `get_listing`, `get_requirement`, `evaluate_requirement`, `compare_match_results`, `find_alternative_buyers`, `prepare_listing_draft`, `prepare_requirement_draft`, `prepare_record_change`, `prepare_supply_request`, `get_request_timeline`, `retrieve_policy`, `screen_policy`, `find_projects`, `get_metrics`, `prepare_report` and scoped admin equivalents.

The coordinator attaches trusted actor/org and execution limits; model arguments contain only business parameters. Separate preparations from execution. `execute_approved_action(action_id)` can execute only an already valid server-approved proposal for the actor; the LLM cannot approve it. Strict schemas allow nullable missing inputs where appropriate; required domain facts are validated before writes. Tool results use `ok`, `needs_input`, `needs_approval`, `conflict`, `forbidden`, `unavailable` or `error`, with entity/result references and structured next steps.

Illustrative discovery result (abbreviated wire example, not actual plant evidence):

```json
{
  "schema_version": "2.0",
  "status": "needs_input",
  "candidate": {
    "material_code": "CO2",
    "evidence_level": "assistant_hypothesis",
    "generation_status": "potential",
    "captured_quantity_t": null,
    "purity_mol_percent": null,
    "market_price_minor_per_t": null,
    "supporting_source_ids": ["reviewed-process-reference-01"],
    "missing_fields": ["collection_status", "quantity_period", "quality_report"]
  },
  "next_question": "Is the CO2 already collected, or is it currently released with the process exhaust?",
  "can_publish": false
}
```

## 11. Manual versus chatbot feature mapping

Every row is a preserved or additive capability. New features explicitly say "not in V1" rather than pretending they already existed. Planned V1 extensions remain staged, with parity required when released.

| Feature | Version 1 manual method | Version 2 manual method | Version 2 chatbot method | Backend service used |
|---|---|---|---|---|
| Organization/profile | Settings and membership UI | Same settings | "Prepare our profile update" | Organizations/actions |
| Process intake | Not in V1 | Process editor | "Here is our production process" | Process discovery |
| Output discovery | Not in V1 | Analyze process button/results | "What useful outputs might this generate?" | Discovery/knowledge |
| Market opportunity | Basic listing prices | Comparable-observation panel | "Who may use this, and what price evidence exists?" | Market intelligence |
| Create listing | Supplier form | Same editor, optional discovery prefill | "Draft a listing from this evidence" | Catalog/actions |
| Publish listing | Review/publish button | Same preview and publish | "Publish this reviewed draft" | Catalog/actions |
| Edit/archive supply | Listing edit/archive workflow | Same controls | "Update October availability" | Catalog/reservations/actions |
| Evidence/quality | Quality fields; upload/review planned | Fields, upload and evidence drawer | "Extract this report and show what is missing" | Evidence/quality |
| Buyer requirement | Requirement form | Same form, editable AI prefill | "I need 100 t in October with these limits" | Requirements/actions |
| Requirement edits | Saved form | Same form/version conflicts | "Change the quantity to 80 t" | Requirements/actions |
| Search/filter | Marketplace filters | Same filters | "Find suitable sellers within my budget" | Catalog/search |
| Compatibility | Match results/quality matrix | Same matrix | "Why does this supplier fail?" | Matching/quality |
| Delivered cost | Estimate card | Same breakdown/source | "Explain the delivered estimate" | Logistics |
| Compare | Three-column comparison | Same comparison | "Compare these three options" | Matching/logistics |
| Alternative buyers | Alternate-buyer action | Same authorized opportunities | "Find buyers for my remaining supply" | Matching/requirements |
| Treatment guidance | Gap explanation | Same evidence-linked guidance | "What must be checked or treated?" | Quality/knowledge |
| What-if | Scenario form | Same scenario editor | "What changes if I need 120 t?" | Matching/scenarios |
| Decision receipt | Receipt/export | Same saved receipt | "Show the evidence behind this decision" | Matching/reports |
| Request creation | Review/submit form | Same terms preview | "Prepare a request for this match" | Requests/actions |
| Accept/decline/cancel | Party-specific controls | Same controls and confirmations | "Accept request R after showing its terms" | Requests/reservations/actions |
| Request history/expiry | Timeline | Same effective status/timeline | "What is waiting for my response?" | Requests/activity |
| NGO projects | Project form/catalog | Same reviewed project screens | "Find projects relevant to our goals" | Sustainability |
| Project participation | Participation record | Same form | "Record our participation in this project" | Sustainability/actions |
| Captured/reused records | Material-flow forms planned | Evidence-linked event forms | "Record this receipt/reuse evidence" | Material flows/actions |
| Targets/corrective steps | Configurable target concept | Explicit scoped target/action-plan UI | "Explain our target gap and options" | Targets/policy/sustainability |
| Policy screening | Review boundary, no rule engine | Dated source and screening workspace | "Which reviewed requirements apply here?" | Policies/screening |
| Analytics | Dashboard | Same metric definitions/charts | "Summarize this month's requests" | Analytics |
| Reports | Receipts; later reporting | Report builder/history | "Generate a report from these records" | Reports/jobs |
| Notifications | Planned outbox/notifications | Inbox/preferences | "Show updates; change my notification preference" | Notifications |
| Admin/review | Moderation/evidence review | Same role-restricted console | "Prepare this moderation decision" | Admin/actions |
| Split purchase/outage | Not in V1 | Purchase-plan/scenario editor | "Combine suitable suppliers; exclude supplier B" | Purchase planning |
| Negotiated bids | Planned commercial extension | Offer/version review | "Prepare a counteroffer for these terms" | Offers/actions |
| Release/fulfillment/dispute | Planned commercial extension | Dedicated forms/timelines | "Prepare a release request / record this delivery" | Commercial/actions |
| Conversation/privacy | Not in V1 | Conversation history/delete/settings | "Start a new conversation / forget this preference" | Conversations/privacy |

## 12. MVP, complete V2 and future expansion

**V2 initial implementation:** all V1 core marketplace/search/quality/matching/logistics/request invariants; manual comparison, alternatives, receipts and what-if; basic projects/participation and evidence-backed material-flow entry; limited reviewed policy guidance; process intake and cited output discovery for a small curated set; seller/buyer draft creation and approved changes; conversation persistence, controlled tools, confirmations, traceable receipts and UI sync. Include essential security and evaluation before enabling writes.

**Complete academic V2:** expand the curated discovery/policy corpus, evidence extraction/review, market comparables, detailed analytics/reports, configurable targets/action plans, multi-step workflows, two-supplier planning/outage scenarios, notification worker, admin curation, post-accept release/fulfillment and versioned offers. Preserve all V1 planned capabilities in this scope; each gets a tested release increment. The initial release is a milestone, not deletion of deferred features.

**Future after validated demand:** additional tradable material adapters; broader languages/voice; partner ERP/lab/logistics APIs; stronger scheduling/optimization; approved lifecycle-assessment workflows; payment/legal-contract integration; semantic retrieval at scale; explicitly authorized recurring automation. Fully autonomous engineering decisions, automatic legal certification and fabricated quantities/prices remain outside supported behavior regardless of stage.

## 13. Security, privacy and operations

Retain OIDC authorization-code/PKCE with backend-managed HttpOnly Secure SameSite session, CSRF protection for writes, strict CORS, scoped organization membership, object-level checks, signed private downloads and server-managed secrets. The assistant receives no database credentials, unrestricted admin token or browser-side LLM key. Log acting user and source channel for every mutation; an agent is not an independent business principal.

Prevent prompt-driven privilege escalation with per-tool allowlists, input validation, tenant-scoped queries and execution-time permission checks. Retrieved text cannot grant authority or suppress confirmations. Render canonical action fields with controlled UI, not approval prose generated from untrusted text. Attack tests must cover malicious supplier descriptions, uploaded PDFs, retrieved policy text and forged tool results. OWASP identifies excessive functionality, permissions and autonomy as causes of damaging agent actions. [OWASP excessive agency](https://owasp.org/www-project-top-10-for-large-language-model-applications/2_0_vulns/LLM06_ExcessiveAgency.html).

Minimize industrial-process data sent externally; tell users what content goes to the configured model provider. Prefer application-owned context and `store:false` where supported; this is not a promise of zero provider retention. Review endpoint, caching and account data controls before processing real partner data. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data). No real partner corpus is used for fine-tuning without separate authorization.

Draft retention policy to approve before pilot: user-deletable chat, default 90-day inactive conversation retention, independently retained transaction/audit records according to agreed obligations, and evidence retention tied to its purpose. Delete/redact chat and derived context/index entries without deleting business records. Keep minimal audit facts separately; immutable means ordinary app roles cannot rewrite business history, not that privacy deletion is impossible. Retention periods are product proposals, not legal requirements.

Deployment: same-origin HTTPS frontend/API, private managed PostgreSQL, private object storage, one worker, server-only outbound adapters, separate dev/staging/production credentials, migration job and health probes. Use committed outbox events for notifications; do not send before a transaction commits. Provider circuit breakers leave manual UI usable and preserve pending work. No silent fabricated answers during outages.

Retain V1 operational targets as starting proposals: 99.5% monthly availability, API-read p95 under 300 ms, deterministic matching under 1 second at 1,000 candidates, RPO <=24 hours and RTO <=4 hours. Add measured assistant targets: acknowledge/queue under 1 second, typical interactive task under 15 seconds at p95 excluding user approvals; longer work visibly asynchronous. These are targets to test on documented workloads, not claims of current performance.

Monitor API/worker/database errors, invalid tool calls, denied actions, approval abandonment, stale conflicts, retries, provider failures, latency, token spend, citation gaps and manual/chat completion rates. Trace IDs connect message -> workflow -> tool -> service -> audit without recording hidden model reasoning. Release prompts and code together only after regression/evaluation gates; rollback prompts independently where schema compatibility permits. Run backup restore, worker-crash and migration rollback rehearsals before pilot.

## 14. Sources and design limits

The original supplied problem statement and CarbonBridge ideation submission were reviewed in V1; their feature scope and climate-accounting guardrails remain. This V2 also follows the user's subsequent process-discovery/orchestration explanation and supplied V2 requirements. The user explicitly removed the time limit.

Primary references accessed 12 September 2026: [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [agent safety](https://developers.openai.com/api/docs/guides/agent-builder-safety), [data controls](https://developers.openai.com/api/docs/guides/your-data), [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html), [OWASP excessive agency](https://owasp.org/www-project-top-10-for-large-language-model-applications/2_0_vulns/LLM06_ExcessiveAgency.html), [EPA AP-42 FAQ](https://www.epa.gov/air-emissions-factors-and-quantification/ap-42-frequent-questions), [BEE Indian Carbon Market](https://beeindia.gov.in/show_content.php?lang=1&level=1&lid=294&ls_id=189), [IEA CO2 utilization](https://www.iea.org/reports/putting-co2-to-use), [NETL CO2U toolkit](https://www.netl.doe.gov/LCA/CO2U).

These sources support design boundaries and implementation patterns. They do not establish the quality, price, legal status or saleability of a user's particular output. Those require scoped evidence and review. No live legal rules, emission factors or market prices are silently embedded by this planning document.

## 15. Recommended technology stack

| Layer | Recommended choice | Why / boundary |
|---|---|---|
| Frontend | React, TypeScript, Vite, Tailwind, React Router, TanStack Query, schema-backed forms | Preserve V1; reusable cards/forms for chat and manual pages |
| Backend | Python FastAPI, Pydantic, SQLAlchemy, Alembic | One typed modular application with existing transaction semantics |
| Database | PostgreSQL, NUMERIC, JSONB snapshots, full-text search | Relational business truth, durable jobs and curated retrieval |
| AI/LLM | OpenAI Responses API through a provider adapter; schema/tool-capable model selected by evaluation | Configure `ROUTER_MODEL` and `SPECIALIST_MODEL`; pin tested IDs, do not assume Codex model names imply API access |
| Chat/orchestration | Custom React chat cards + SSE; small Python workflow state machine and tool registry | No separate chatbot platform required; explicit, testable permissions and state |
| Agent framework | Optional OpenAI Agents SDK after a prototype proves benefit | Do not layer multiple frameworks over the same coordinator |
| Authentication | Standards-based managed OIDC; Keycloak if self-hosting is required | Reuse role/session rules; avoid inventing password/auth protocols |
| Files | S3-compatible private storage, upload scanner, Python document extraction | Evidence/source lifecycle independent from chat text |
| APIs | Versioned REST/OpenAPI + SSE; typed adapters for routes, prices and policy ingestion | Manual/UI/tool parity; no model-directed arbitrary URLs |
| Jobs | PostgreSQL-backed jobs/outbox + one Python worker | Resume, expiry, ingestion, reports and notifications without broker complexity |
| Deployment | Docker Compose locally; managed container host + managed DB/storage for pilot | One web/API/worker topology, private data services, explicit migration job |
| Testing | pytest, PostgreSQL integration, OpenAPI/JSON Schema checks, Playwright, accessibility checks, provider-independent replay + live-model evals | Test correctness, parity and actions as well as answer quality |
| Observability | Structured logs, metrics, OpenTelemetry-compatible traces, error reporting | Inspect workflow effects/cost without exposing sensitive source content |
| Optional future | pgvector, Redis/queue framework, voice, partner APIs, additional material adapters | Add only when retrieval/load or validated user demand justifies them |

Pin supported dependency versions at implementation, benchmark at least two suitable model configurations on the project's eval set, and choose the least costly configuration that meets safety and quality gates. “Best project” means users can understand, complete and trust their work; it does not require the maximum number of agents or services.
