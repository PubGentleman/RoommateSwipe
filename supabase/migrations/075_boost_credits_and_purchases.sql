ALTER TABLE host_subscriptions ADD COLUMN IF NOT EXISTS boost_credits JSONB DEFAULT '{"quick": 0, "standard": 0, "extended": 0}';

CREATE TABLE IF NOT EXISTS boost_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  pack_id VARCHAR(20) NOT NULL,
  boost_type VARCHAR(20) NOT NULL,
  quantity INT NOT NULL,
  price_per_boost DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boost_purchases_user ON boost_purchases(user_id);
