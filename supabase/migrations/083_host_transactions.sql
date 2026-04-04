CREATE TABLE IF NOT EXISTS public.host_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'subscription_payment', 'boost_purchase', 'boost_credit_use',
    'agent_verification', 'extra_claim_purchase', 'booking_confirmed'
  )),
  amount_cents INTEGER NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_host_transactions_host ON host_transactions(host_id, created_at);

ALTER TABLE host_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts can view own transactions"
  ON host_transactions FOR SELECT
  USING (host_id = auth.uid());

CREATE POLICY "Hosts can insert own transactions"
  ON host_transactions FOR INSERT
  WITH CHECK (host_id = auth.uid());
