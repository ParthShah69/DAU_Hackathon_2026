# CarbonBridge V2 contracts

The files in `contracts/v2/` are the shared boundary between the web lane, API lane and platform lane. They describe the small, deterministic records used by the process-first demo and the messages exchanged with the conversational orchestrator.

The contract rules are intentionally conservative:

- `schema_version` is explicit on every record and changes only through an additive migration or a reviewed version bump.
- IDs in generated fixtures are UUIDv5 values derived from a stable namespace and logical key. Re-running the generator produces the same IDs.
- Timestamps are UTC ISO-8601 strings.
- Money is an integer amount in minor units with an explicit currency and basis.
- Quantities are decimal strings with an explicit unit and basis. `null` means unknown; zero is a measured zero.
- Facts returned to the model carry source references and scope. A model cannot write a record by inventing a missing fact.
- Action proposals are previews. Only the API can approve and execute a proposal after a fresh permission and version check.

`records.schema.json` is the JSON Schema bundle for fixture collections. `intent-envelope.schema.json`, `action-proposal.schema.json` and `sse-event.schema.json` cover the orchestration boundary. The dependency-free validator in `scripts/validate-v2-fixtures.mjs` checks cross-file references and invariants that a generic JSON Schema validator cannot express.

The generated fixture package lives in `data/fixtures/v2/`. Run `npm run generate:fixtures` to recreate it, then `npm run check:platform` to validate it and run the Node test suite.
