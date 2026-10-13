-- Spec Q11, Q20 point 3: one Web Push subscription per device (browser), from Réglages' toggle.
-- Not versioned: a device's subscription isn't family data, and 404/410 deletes it for good.

CREATE TABLE push_subscriptions (
  id         TEXT PRIMARY KEY,                       -- UUID v7
  user_id    TEXT NOT NULL REFERENCES users(id),     -- whoever subscribed the device last
  endpoint   TEXT NOT NULL UNIQUE,                   -- the push service URL: a secret, never logged
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX push_subscriptions_user_id ON push_subscriptions (user_id);
