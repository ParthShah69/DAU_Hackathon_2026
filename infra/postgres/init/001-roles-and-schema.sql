-- CarbonBridge local development database bootstrap.
-- This file is run only when the named development volume is first created.
-- It deliberately contains no production credentials or seed data.

REVOKE ALL ON DATABASE carbonbridge_demo FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE ROLE carbonbridge_migrator NOLOGIN;
CREATE ROLE carbonbridge_runtime NOLOGIN;

GRANT CONNECT ON DATABASE carbonbridge_demo TO carbonbridge_migrator, carbonbridge_runtime;
GRANT USAGE ON SCHEMA public TO carbonbridge_migrator, carbonbridge_runtime;

CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A typed relational migration replaces this development ledger before pilot
-- deployment.  It provides an immediately useful, auditable persistence
-- target without letting the application role create arbitrary schema.
CREATE TABLE application_records (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  organization_id TEXT,
  version INTEGER,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, id)
);

CREATE INDEX application_records_collection_org_idx
  ON application_records (collection, organization_id);

CREATE TABLE outbox_events (
  id UUID PRIMARY KEY,
  organization_id TEXT,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_expires_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX outbox_events_available_idx
  ON outbox_events (available_at) WHERE delivered_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON application_records, outbox_events TO carbonbridge_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON schema_migrations, application_records, outbox_events TO carbonbridge_migrator;

INSERT INTO schema_migrations (version) VALUES ('001_roles_and_schema');
