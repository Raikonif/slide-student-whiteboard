CREATE TABLE participants (
  id          INTEGER PRIMARY KEY,
  first_name  TEXT NOT NULL,
  last_name   TEXT NOT NULL,
  email       TEXT,
  learning    TEXT NOT NULL,               -- what they learned in class
  x           REAL NOT NULL DEFAULT 0.5,  -- fraction of board width (0..1)
  y           REAL NOT NULL DEFAULT 0.5,  -- fraction of board height (0..1)
  edit_token  TEXT NOT NULL UNIQUE,       -- lets the registering browser edit and move its own slide
  created_at  INTEGER NOT NULL            -- unix ms
);

CREATE TABLE admins (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,            -- pbkdf2$<iterations>$<salt b64>$<hash b64>
  created_at    INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,           -- sha-256 of the cookie value
  admin_id    INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);

-- Single-row-per-key settings; 'access_code' holds the one currently valid code.
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE login_attempts (
  ip  TEXT NOT NULL,
  at  INTEGER NOT NULL
);
CREATE INDEX login_attempts_ip_at ON login_attempts (ip, at);
