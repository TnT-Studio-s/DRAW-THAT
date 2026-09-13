CREATE TABLE IF NOT EXISTS drawduo_room_listings (
  room_id text PRIMARY KEY,
  listing jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drawduo_room_invites (
  room_id text PRIMARY KEY,
  room_code text NOT NULL UNIQUE,
  owner_player_id uuid REFERENCES players(player_id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS drawduo_room_invites_active_idx ON drawduo_room_invites (room_code, expires_at) WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS drawduo_presence_kv (
  key text PRIMARY KEY,
  value text NOT NULL,
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS drawduo_presence_sets (
  key text NOT NULL,
  member text NOT NULL,
  PRIMARY KEY (key, member)
);

CREATE TABLE IF NOT EXISTS drawduo_presence_hashes (
  key text NOT NULL,
  field text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (key, field)
);

CREATE TABLE IF NOT EXISTS drawduo_presence_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drawduo_presence_messages_created_at_idx ON drawduo_presence_messages (created_at);
