CREATE TABLE IF NOT EXISTS session_evidence (
  session_id text NOT NULL,
  turn_id text NOT NULL,
  sequence integer NOT NULL,
  event jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (session_id, turn_id, sequence)
);

CREATE INDEX IF NOT EXISTS session_evidence_expiry_idx ON session_evidence (expires_at);

CREATE TABLE IF NOT EXISTS evidence_access_log (
  access_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_subject text NOT NULL,
  session_id text NOT NULL,
  turn_id text NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now()
);
