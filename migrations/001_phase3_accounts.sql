CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS players (
  player_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject text NOT NULL UNIQUE,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'suspended')),
  terms_version text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  deletion_requested_at timestamptz
);

CREATE TABLE IF NOT EXISTS account_links (
  player_id uuid NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_subject text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_subject),
  UNIQUE (player_id, provider)
);

CREATE TABLE IF NOT EXISTS wallets (
  player_id uuid PRIMARY KEY REFERENCES players(player_id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_gameplay_coins integer NOT NULL DEFAULT 0 CHECK (lifetime_gameplay_coins >= 0),
  revision bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
  ledger_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  item_id text,
  turn_id text,
  idempotency_key text NOT NULL,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS duos (
  player_a uuid NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  player_b uuid NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  rules_version text NOT NULL,
  current_streak integer NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
  best_streak integer NOT NULL DEFAULT 0 CHECK (best_streak >= 0),
  successful_turns integer NOT NULL DEFAULT 0,
  completed_sessions integer NOT NULL DEFAULT 0,
  revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_a, player_b, rules_version),
  CHECK (player_a < player_b)
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id text PRIMARY KEY,
  player_a uuid NOT NULL REFERENCES players(player_id),
  player_b uuid NOT NULL REFERENCES players(player_id),
  entry_context text NOT NULL,
  protocol_major integer NOT NULL,
  rules_version text NOT NULL,
  content_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'completed', 'abandoned', 'server_error')),
  final_team_score integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS turns (
  session_id text NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  turn_index integer NOT NULL,
  drawer uuid NOT NULL REFERENCES players(player_id),
  prompt_key text,
  outcome text,
  points integer NOT NULL DEFAULT 0,
  resolution_id text UNIQUE,
  PRIMARY KEY (session_id, turn_index)
);

CREATE TABLE IF NOT EXISTS turn_resolutions (
  resolution_id text PRIMARY KEY,
  turn_id text NOT NULL UNIQUE,
  player_a uuid NOT NULL REFERENCES players(player_id),
  player_b uuid NOT NULL REFERENCES players(player_id),
  outcome text NOT NULL,
  wallet_a integer NOT NULL,
  wallet_b integer NOT NULL,
  current_streak integer NOT NULL,
  best_streak integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cosmetic_catalog (
  item_id text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('avatar_frame', 'ui_theme', 'profile_title', 'celebration')),
  name text NOT NULL,
  price integer NOT NULL CHECK (price >= 0),
  enabled boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS player_cosmetics (
  player_id uuid NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  item_id text NOT NULL REFERENCES cosmetic_catalog(item_id),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  equipped boolean NOT NULL DEFAULT false,
  PRIMARY KEY (player_id, item_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id uuid NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
  report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES players(player_id),
  subject_id uuid NOT NULL REFERENCES players(player_id),
  session_id text,
  turn_id text,
  category text NOT NULL,
  evidence_pointer text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES reports(report_id),
  staff_subject text NOT NULL,
  action text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO cosmetic_catalog (item_id, type, name, price) VALUES
  ('frame-sunrise', 'avatar_frame', 'Sunrise Frame', 20),
  ('theme-paper', 'ui_theme', 'Paper Theme', 40),
  ('title-sketcher', 'profile_title', 'Sketcher', 80)
ON CONFLICT (item_id) DO NOTHING;
