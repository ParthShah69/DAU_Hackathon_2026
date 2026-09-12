# Local platform wiring

`docker-compose.demo.yml` provides a local PostgreSQL 16 service. On its first
start it creates separate migration and runtime roles, a JSONB record ledger,
and an outbox table. The Node prototype continues to use its deterministic
in-memory adapter until the asynchronous database adapter is completed; this
database is therefore an opt-in local development dependency, not an implied
production deployment.

The compose file reads `CARBONBRIDGE_DEMO_DB_PASSWORD` from the local environment. Do not reuse a local value outside the demo or place production credentials in this repository. A pilot deployment must use a private managed database, a non-owner application role, encrypted backups and a separate secret store.

The platform checks do not require Docker or PostgreSQL:

```text
npm run check:platform
npm run seed:demo
```

To initialize the local database:

```text
Copy-Item .env.example .env
# edit .env and replace CARBONBRIDGE_DEMO_DB_PASSWORD
docker compose --env-file .env -f infra/docker-compose.demo.yml up -d
docker compose --env-file .env -f infra/docker-compose.demo.yml ps
```

The init SQL runs only for a fresh `carbonbridge_demo_pgdata` volume. Do not
remove a volume that contains work you need. The normal local application
sequence is:

1. Start the PostgreSQL service with the compose file when database work is needed.
2. Run the demo seed adapter with `--profile demo` and the committed seed/clock.
3. Start the API and web preview with `ASSISTANT_ENABLED=false` first.
4. Enable an assistant provider only after the provider-independent API, authorization and manual UI checks pass.

The seed adapter is deliberately dry-run and dependency-free today. It validates the fixture graph and emits the ordered operation plan so the backend migration/seed implementation can adopt the same contracts without duplicating business calculations.
