-- User referral codes (simple, for every user — distinct from affiliate codes)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_credits INTEGER DEFAULT 0;

-- Referral tracking
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  referred_email TEXT,
  referred_phone TEXT,
  invite_method TEXT,
  status TEXT DEFAULT 'invited',
  reward_claimed BOOLEAN DEFAULT FALSE,
  reward_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  signed_up_at TIMESTAMPTZ,
  onboarded_at TIMESTAMPTZ,
  subscribed_at TIMESTAMPTZ
);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_referred ON public.referrals(referred_id);
CREATE INDEX idx_referrals_email ON public.referrals(referred_email);

-- Referral rewards configuration
CREATE TABLE public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone TEXT NOT NULL UNIQUE,
  reward_type TEXT NOT NULL,
  reward_value INTEGER,
  reward_description TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE
);

INSERT INTO public.referral_rewards (milestone, reward_type, reward_value, reward_description) VALUES
  ('first_signup', 'credits', 2, 'Earn $2 credit when your first friend signs up'),
  ('first_onboarded', 'credits', 3, 'Earn $3 credit when your first friend completes their profile'),
  ('first_subscribed', 'credits', 10, 'Earn $10 credit when your first friend subscribes'),
  ('5_referrals', 'feature_unlock', NULL, 'Unlock 5 extra daily swipes permanently'),
  ('10_referrals', 'plan_upgrade', 30, 'Free Plus plan for 30 days'),
  ('25_referrals', 'badge', NULL, 'Earn the Community Builder badge'),
  ('50_referrals', 'plan_upgrade', 90, 'Free Elite plan for 90 days');

-- Credit transactions log
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user ON public.credit_transactions(user_id);

-- RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "Users can create referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (referrer_id = auth.uid());

CREATE POLICY "Users can update own referrals"
  ON public.referrals FOR UPDATE
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "Anyone can view rewards config"
  ON public.referral_rewards FOR SELECT
  USING (active = TRUE);

CREATE POLICY "Users can view own credit transactions"
  ON public.credit_transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own credit transactions"
  ON public.credit_transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Auto-generate referral code for new users
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  code TEXT;
  attempts INT := 0;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      code := 'RHOME-' || upper(substr(md5(random()::text), 1, 6));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE referral_code = code);
      attempts := attempts + 1;
      EXIT WHEN attempts > 10;
    END LOOP;
    NEW.referral_code := code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION generate_referral_code();

-- Backfill referral codes for existing users
UPDATE public.users SET referral_code = 'RHOME-' || upper(substr(md5(id::text), 1, 6))
WHERE referral_code IS NULL;
