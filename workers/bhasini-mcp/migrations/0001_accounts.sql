-- Translation API accounts, prepaid credits and Razorpay payments. See src/accounts.ts, src/billing.ts.
-- Apply: npx wrangler d1 migrations apply bhasini-api --remote   (or --local for wrangler dev)

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,               -- acct_…
  email TEXT NOT NULL UNIQUE,        -- lower-cased
  name TEXT,
  key_hash TEXT NOT NULL UNIQUE,     -- SHA-256 of the API key; the key itself is never stored
  key_prefix TEXT NOT NULL,          -- first characters of the key, to recognise it in the dashboard
  credits INTEGER NOT NULL,          -- characters left
  created_at TEXT NOT NULL,
  signup_ip_hash TEXT NOT NULL       -- to limit sign-ups per client; a hash, not the address
);
CREATE INDEX accounts_signup_ip ON accounts (signup_ip_hash, created_at);

-- One row per Razorpay order we create. paid = 1 once its credits were added (exactly once).
CREATE TABLE orders (
  id TEXT PRIMARY KEY,               -- Razorpay order id (order_…)
  account_id TEXT NOT NULL REFERENCES accounts (id),
  pack TEXT NOT NULL,
  amount_paise INTEGER NOT NULL,
  chars INTEGER NOT NULL,
  paid INTEGER NOT NULL DEFAULT 0,
  payment_id TEXT,                   -- Razorpay payment id (pay_…), once paid
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX orders_account ON orders (account_id, created_at);

-- Characters and requests per account per day (India time), for the dashboard and invoices.
CREATE TABLE usage_daily (
  account_id TEXT NOT NULL REFERENCES accounts (id),
  day TEXT NOT NULL,
  chars INTEGER NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, day)
);
