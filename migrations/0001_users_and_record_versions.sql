-- Spec Q1, Q7, Data model. Ids are UUID v7 text (Q20 point 1); timestamps ISO UTC text.

CREATE TABLE users (
  id                    TEXT    PRIMARY KEY,
  email                 TEXT    NOT NULL UNIQUE CHECK (email = lower(email)),
  name                  TEXT    NOT NULL,
  role                  TEXT    NOT NULL CHECK (role IN ('admin', 'parent', 'child')),
  colour_key            TEXT    NOT NULL CHECK (colour_key IN
    ('tomato', 'tangerine', 'mustard', 'sage', 'turquoise', 'cornflower', 'lavender', 'raspberry')),
  last_duration_minutes INTEGER,
  update_count          INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT    NOT NULL,
  updated_at            TEXT    NOT NULL,
  deleted_at            TEXT,                -- deactivated
  deleted_by_user_id    TEXT    REFERENCES users(id)
);

-- One row per change to a versioned table, written by saveWithVersion() in the same batch.
CREATE TABLE record_versions (
  id                   TEXT    PRIMARY KEY,
  table_name           TEXT    NOT NULL,          -- 'chores', 'users', 'chore_types'
  record_id            TEXT    NOT NULL,
  version_number       INTEGER NOT NULL,          -- 0 = created; = update_count after the change
  change_kind          TEXT    NOT NULL CHECK (change_kind IN ('created', 'updated', 'deleted')),
  changed_by_user_id   TEXT    NOT NULL REFERENCES users(id),
  changed_at           TEXT    NOT NULL,
  record_snapshot_json TEXT    NOT NULL CHECK (json_valid(record_snapshot_json)), -- full row after the change
  UNIQUE (table_name, record_id, version_number)
);
