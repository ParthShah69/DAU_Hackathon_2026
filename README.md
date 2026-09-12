# CarbonBridge V2

CarbonBridge turns a plain-language production process into evidence-backed resource opportunities and reviewable marketplace work. A seller can describe a process, see what may be useful, learn which measurements are missing, prepare a private listing and connect it to a buyer. Buyers can describe a need, compare compatible supply and prepare a request. The same records remain editable from the normal marketplace UI.

The differentiator is the process, not a generic chatbot: potential outputs stay hypotheses until quantity, quality and ownership evidence are available; market values are dated observations; matching and delivered economics are deterministic; and every external action shows an exact preview before confirmation. The prototype is software-only and includes no IoT integration.

## Run the prototype

Requirements: Node.js 20 or newer. The demo checks do not require Python, Docker, a database or an LLM provider.

```text
npm run check:all
npm run seed:demo

cd apps/api
npm start

# In another terminal
cd apps/web
npm run dev
```

Open `http://127.0.0.1:4173`. The API listens on `http://127.0.0.1:8080`. The web preview is dependency-free so the experience can be reviewed on a clean machine; the retained React/TypeScript draft in `apps/web/src/App.tsx` documents the intended migration when a full frontend toolchain is available.

The first screen is registration and sign-in. Create a **production house** (supplier), **buyer**, or **NGO** organization, or pick a seeded demo workspace:

| Role | Demo email | Password |
|---|---|---|
| Production house | `seller@demo.carbonbridge.local` | `demo-pass-2026` |
| Buyer | `buyer@demo.carbonbridge.local` | `demo-pass-2026` |
| NGO | `reviewer@demo.carbonbridge.local` | `demo-pass-2026` |

Production houses list captured streams and can ask an NGO for labor (planting / greening), funding, or appreciation when they have surplus carbon. That support is **not** a carbon credit or offset. Buyers search the marketplace, filter listings, and request compatible supply. NGOs publish projects, offer them against open balance requests, and send appreciation.

The web shell uses the same-origin `/api/v1` proxy by default. If the API is stopped, it falls back to CarbonStone / GreenBuild seed copies labeled as degraded demo data. You can still switch a demo actor with `?user=user-seller` or pass an explicit API base through `window.__CARBONBRIDGE_CONFIG__` before loading the module. Live sessions use `Authorization: Bearer` plus an HttpOnly cookie; `x-demo-user` remains for automated tests.

## What is included

- `apps/web/`: process-first dashboard, API-backed discovery, evidence-aware marketplace, buyer requirement form, request controls, deep links and assistant approval cards.
- `apps/api/`: Node service for process discovery, evidence-aware deterministic matching, delivered-cost estimates, typed assistant intents, action previews, confirmations, manual request lifecycle, reservations and SSE progress.
- `contracts/v2/`: JSON Schemas for records, intent envelopes, actions, tools, SSE events and capability parity.
- `data/fixtures/v2/`: 222 deterministic records across 16 files, including six process profiles, twelve process scenarios, eight buyer specifications, source documents/chunks, policy examples, market observations and sixty assistant evaluation cases.
- `scripts/`: fixture generation/validation, dry-run seed planning and platform checks.
- `infra/`: local PostgreSQL wiring for the future persistent API lane.
- `docs/CARBONBRIDGE_ARCHITECTURE_V2.md`: complete architecture and domain rules.
- `docs/CARBONBRIDGE_IMPLEMENTATION_PLAN_V2.md`: phased implementation, data formats, Sol/Terra lane ownership, evaluation thresholds and release gates.
- `docs/CARBONBRIDGE_REMAINING_WORK.md`: inventory of what is still left against the V2 plan (phases, UI, API, data, tests and suggested build order).

## Important boundary

The current prototype uses an in-memory store and a heuristic assistant provider so it runs without external credentials. It is a tested demonstration and contract reference, not a production deployment. The production path replaces those adapters with PostgreSQL, OIDC sessions, private object storage, durable jobs, an approved LLM provider adapter, prompt-injection defenses, operational monitoring, backups and partner-reviewed evidence. No quantity, purity, price, compliance status or climate claim is certified by the demo data.

## Useful checks

```text
npm run check:platform
npm run test:api
npm run check:web
npm run check:all
```

The platform suite validates provenance, stable IDs, uncertainty, policy/source scopes, schemas and the 60-case evaluation set. The API suite covers the buyer-to-supplier journey, action confirmation, tenant isolation, reservations and SSE. The web check validates the clean preview build and process-first interaction markers.
