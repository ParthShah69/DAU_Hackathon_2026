# CarbonBridge API prototype

This is a dependency-free Node 20 prototype of the CarbonBridge V2 backend spine. It keeps the implementation small enough to run in a fresh checkout while preserving the important boundaries from the architecture: process discovery creates hypotheses, matching is deterministic, and assistant writes require an exact approval action.

The prototype uses an in-memory store and fictional demo records. It is useful for the frontend contract and the end-to-end demo flow; it is not a production deployment. The V2 architecture remains the production target: a modular API with PostgreSQL, migrations, OIDC sessions, private object storage, durable jobs and an approved LLM provider adapter.

## Run it

```text
npm test
npm start
```

The server listens on `http://localhost:8080`. Every response is wrapped as `{ data, requestId }`. Demo identity is selected with headers:

```text
x-demo-user: user-buyer       # default
x-demo-user: user-seller
x-demo-user: user-reviewer
```

These headers are a local demo stand-in for a verified OIDC session. They must be removed before any shared or production deployment.

## Demo flow

1. `POST /api/v1/conversations` as `user-buyer`.
2. `POST /api/v1/conversations/{id}/messages` with `Find the best supply options for my requirement`.
3. Ask `Compare the options`.
4. Ask `Prepare a request for the best option`. The response contains an `action_preview` card.
5. Reply `confirm`. The exact request is created with status `pending_supplier`.
6. Start a seller conversation as `user-seller`, send `accept request {requestId}`, then `confirm`. The API creates one reservation and updates the request atomically in the prototype store.

The process-first flow starts with:

```json
{
  "description": "Our cement kiln uses amine capture on flue gas and stores the captured carbon dioxide.",
  "structured": {
    "inputs": ["limestone", "fuel"],
    "steps": ["kiln", "capture", "compression"],
    "outputs": ["captured carbon dioxide"]
  }
}
```

Send that to `POST /api/v1/processes/discover`. The response contains candidate opportunities with `quantity: null`, `purity: null`, `price: null`, evidence requirements and `canPublish: false`. The assistant can then prepare a private listing draft, but publication remains blocked until the manual evidence and quality workflow is complete.

## Important endpoints

| Endpoint | Purpose |
|---|---|
| `GET /healthz` | Health and seed provenance |
| `GET /api/v1/me` | Current demo identity and organization capabilities |
| `GET /api/v1/health/live` / `/api/v1/health/ready` | Liveness and readiness probes |
| `POST /api/v1/demo/seed` | Reset fictional records in local non-production mode |
| `GET /api/v1/marketplace/listings` | Public-safe listing summaries |
| `POST/PATCH /api/v1/listings` | Create and edit private listings with version checks |
| `POST /api/v1/listings/{id}/publish` | Publish only when bounded quantity and unexpired quality evidence exist |
| `POST /api/v1/processes/discover` | Process extraction and output-opportunity discovery |
| `POST/PATCH /api/v1/requirements` | Manual requirement creation and editing |
| `POST /api/v1/matches/run` | Deterministic hard checks, economics and ranking |
| `GET /api/v1/matches/{id}/receipt` | Immutable decision receipt |
| `POST /api/v1/conversations/{id}/messages` | Intent routing and typed assistant cards |
| `GET /api/v1/actions/{id}` | Inspect an exact pending action |
| `POST /api/v1/actions/{id}/approve` | Execute the exact action after authorization |
| `GET/POST /api/v1/requests` | Buyer or supplier request timeline and manual submission |
| `POST /api/v1/requests/{id}/accept|decline|cancel` | Versioned manual request transitions |

## Seed data contract

`data/demo/marketplace.json` is UTF-8 JSON with a `schemaVersion`, `source` provenance block and relational arrays. IDs are stable demo identifiers, timestamps are UTC ISO strings, quantities are decimal strings, and money is integer paise. Unknown measurements are `null`; they are never replaced with zero. The dataset intentionally includes two compatible options, one option needing evidence, and one option that fails quality checks so the UI can demonstrate all three states.

The matching formula is the documented demo formula:

```text
logistics_paise_per_t = handling_paise_per_t + distance_km * rate_paise_per_t_km
delivered_paise_per_t = listed_paise_per_t + logistics_paise_per_t
```

The values are fictional and do not represent a quote, route commitment, quality certificate or carbon claim.

## Implementation boundaries

- `src/domain/matching.js` is the deterministic source for compatibility, gap explanations, delivered economics and ranking.
- `src/domain/process-discovery.js` is the safe discovery catalog. It identifies possibilities but never creates verified inventory.
- `src/domain/assistant.js` is the bounded orchestrator. Its demo intent provider is replaceable with an LLM adapter that emits the same typed intent envelope.
- `src/app.js` keeps route/authentication/error handling separate from domain services and exposes the same services to manual and chat paths.
- `src/infra/store.js` is the in-memory adapter. A PostgreSQL repository and transaction boundary should replace it before pilot use.
- `tests/api.test.js` exercises the complete buyer-to-seller flow, tenant isolation, action approval and evidence states.

No arbitrary SQL, shell, URL or code execution capability is exposed to the assistant. A production version must add OIDC, CSRF protection for cookie sessions, persistent audit/outbox records, database locking for reservations, rate limits, attachment scanning, LLM provider timeouts, prompt-injection tests and an evaluation set before it is described as production-ready.
