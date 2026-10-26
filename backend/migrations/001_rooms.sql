-- Private application state. No browser role can read full hands or deck order.
CREATE SCHEMA IF NOT EXISTS slay_private;
REVOKE ALL ON SCHEMA slay_private FROM PUBLIC;
CREATE TABLE IF NOT EXISTS slay_private.rooms (
    code text PRIMARY KEY,
    state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE slay_private.rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE slay_private.rooms FROM PUBLIC;
