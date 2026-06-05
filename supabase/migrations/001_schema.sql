-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  date        DATE NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  merchant    TEXT NOT NULL,
  category    TEXT DEFAULT 'Uncategorized',
  description TEXT,
  source      TEXT DEFAULT 'import',
  dedup_hash  TEXT,
  embedding   VECTOR(384),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_dedup ON transactions(dedup_hash);
CREATE INDEX IF NOT EXISTS idx_tx_user_date     ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_user_category ON transactions(user_id, category);

-- Monthly summaries (pre-computed)
CREATE TABLE IF NOT EXISTS monthly_summaries (
  user_id   UUID REFERENCES auth.users NOT NULL,
  year      INT  NOT NULL,
  month     INT  NOT NULL,
  category  TEXT NOT NULL,
  total     NUMERIC(12,2),
  tx_count  INT,
  PRIMARY KEY (user_id, year, month, category)
);

-- Subscriptions (pre-computed)
CREATE TABLE IF NOT EXISTS subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users NOT NULL,
  merchant    TEXT NOT NULL,
  amount      NUMERIC(12,2),
  interval    TEXT,
  last_seen   DATE,
  UNIQUE(user_id, merchant)
);

-- Budgets
CREATE TABLE IF NOT EXISTS budgets (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES auth.users NOT NULL,
  category  TEXT NOT NULL,
  limit_amt NUMERIC(12,2) NOT NULL,
  period    TEXT DEFAULT 'monthly',
  UNIQUE(user_id, category)
);

-- User context (persistent memory)
CREATE TABLE IF NOT EXISTS user_context (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID REFERENCES auth.users NOT NULL,
  key      TEXT NOT NULL,
  value    TEXT NOT NULL,
  UNIQUE(user_id, key)
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users NOT NULL,
  messages   JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_context      ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_transactions"      ON transactions      FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_summaries"         ON monthly_summaries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_subscriptions"     ON subscriptions     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_budgets"           ON budgets           FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_user_context"      ON user_context      FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_conversations"     ON conversations     FOR ALL USING (auth.uid() = user_id);
