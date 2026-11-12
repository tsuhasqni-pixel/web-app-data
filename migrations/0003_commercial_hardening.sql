-- Commercial hardening: Stripe webhook idempotency and legal acceptance evidence.
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_created INTEGER,
  livemode INTEGER NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS stripe_webhook_events_unprocessed
  ON stripe_webhook_events(processed_at, received_at);

CREATE TABLE IF NOT EXISTS checkout_acceptances (
  stripe_checkout_session_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  user_id TEXT NOT NULL,
  product_key TEXT NOT NULL,
  tier TEXT NOT NULL,
  legal_version TEXT NOT NULL,
  accepted_at INTEGER NOT NULL,
  livemode INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS checkout_acceptances_user
  ON checkout_acceptances(user_id, accepted_at);
