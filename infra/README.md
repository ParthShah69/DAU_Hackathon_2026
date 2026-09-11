# Local platform wiring

`docker-compose.demo.yml` provides only a local PostgreSQL service for the future FastAPI lane. It intentionally does not include an application container, model provider or external connector while those interfaces are still being implemented.

The compose file reads `CARBONBRIDGE_DEMO_DB_PASSWORD` from the local environment. Do not reuse a local value outside the demo or place production credentials in this repository. A pilot deployment must use a private managed database, a non-owner application role, encrypted backups and a separate secret store.

The platform checks do not require Docker or PostgreSQL:

```text
npm run check:platform
npm run seed:demo
```

When the API lane is ready, the expected local sequence is:

1. Start the PostgreSQL service with the compose file.
2. Run the one-time Alembic migration job.
3. Run the demo seed adapter with `--profile demo` and the committed seed/clock.
4. Start the API and worker with `ASSISTANT_ENABLED=false` first.
5. Enable the assistant only after the provider-independent API, authorization and manual UI checks pass.

The seed adapter is deliberately dry-run and dependency-free today. It validates the fixture graph and emits the ordered operation plan so the backend migration/seed implementation can adopt the same contracts without duplicating business calculations.
