-- D1 schema
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY CHECK (id = 'singleton'),
  reset_monday INTEGER DEFAULT 0,
  notify_email TEXT,
  admin_pw_hint TEXT,
  last_reset TEXT
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  threshold INTEGER NOT NULL,
  uses INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_links_active ON links(active);
CREATE INDEX IF NOT EXISTS idx_links_order ON links(sort_order);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  acorns_status TEXT NOT NULL,
  payout_method TEXT NOT NULL,
  payout_handle TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  state TEXT,
  active_link_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now')),
  FOREIGN KEY(active_link_id) REFERENCES links(id)
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS proofs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  media_url TEXT NOT NULL,
  received_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
