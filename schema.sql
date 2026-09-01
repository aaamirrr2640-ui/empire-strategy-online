CREATE TABLE IF NOT EXISTS empire_users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  state JSONB,
  last_seen BIGINT NOT NULL DEFAULT 0
);
