# CarbonBridge V2 demo data

The committed package under `fixtures/v2/` is a bounded, synthetic dataset for local development, contract tests and the hackathon demonstration. It is not an industrial measurement dataset and it does not certify a material, price, climate result or legal status.

The package includes five demo organizations, six production-process profiles, twelve process descriptions, eight buyer specifications, seven qualitative treatment pathways, twelve source records, twelve citable documents, forty-eight chunks, ten policy rules, eight policy cases, twelve market observations, one marketplace snapshot, sixteen conversation scenarios and sixty assistant evaluation cases.

Use the following commands from the repository root:

```text
npm run generate:fixtures
npm run check:fixtures
npm run test:platform
npm run seed:demo
```

The generator uses a fixed UTC clock and UUIDv5 IDs. It may be run repeatedly without changing the result. The seed command is a dry-run adapter until the API lane supplies migrations and a database writer; it prints the dependency order and idempotency key that the real adapter must preserve.

JSON collections use one array per file. JSONL collections use one object per line for source documents, citable chunks and evaluation cases. Every record carries `id`, `schema_version`, `created_at`, `updated_at` and a provenance label where appropriate. Use `null` for unknown quantity, purity, moisture or price. Money uses integer minor units, and quantities use decimal strings with a unit and basis.

All process outputs are candidates until evidence and publication checks pass. The draft food-grade CO2 record intentionally lacks quality evidence. The stale price observations remain in the data so the comparison assistant can explain freshness instead of silently using old values. No IoT device or live connector is required by this package.
