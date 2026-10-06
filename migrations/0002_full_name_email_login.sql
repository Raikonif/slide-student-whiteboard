-- Single full-name field, and email becomes the participant's sign-in identity.
-- Existing rows are kept: first + last name are merged, emails are lowercased.
-- Email stays nullable for rows created before it was required (UNIQUE allows many NULLs);
-- the API requires it for every new registration or edit.
CREATE TABLE participants_new (
  id          INTEGER PRIMARY KEY,
  full_name   TEXT NOT NULL,
  email       TEXT UNIQUE,                 -- lowercased; used with the access code to sign back in
  learning    TEXT NOT NULL,               -- what they learned in class
  x           REAL NOT NULL DEFAULT 0.5,   -- fraction of board width (0..1)
  y           REAL NOT NULL DEFAULT 0.5,   -- fraction of board height (0..1)
  edit_token  TEXT NOT NULL UNIQUE,        -- lets the owner's browser edit and move its slide
  created_at  INTEGER NOT NULL             -- unix ms
);

INSERT INTO participants_new (id, full_name, email, learning, x, y, edit_token, created_at)
SELECT id,
       trim(first_name || ' ' || last_name),
       -- If two old rows share an email, only the earliest keeps it.
       CASE WHEN email IS NOT NULL AND id = (SELECT MIN(p2.id) FROM participants p2 WHERE lower(p2.email) = lower(participants.email))
            THEN lower(email) END,
       learning, x, y, edit_token, created_at
  FROM participants;

DROP TABLE participants;
ALTER TABLE participants_new RENAME TO participants;
