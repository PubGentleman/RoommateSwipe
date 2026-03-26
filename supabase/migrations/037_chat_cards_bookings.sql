ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES public.users(id),
  renter_id UUID NOT NULL REFERENCES public.users(id),
  move_in_date DATE NOT NULL,
  lease_length TEXT NOT NULL,
  monthly_rent NUMERIC NOT NULL,
  security_deposit NUMERIC,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled_by_host','cancelled_by_renter')),
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host and renter can read their bookings"
  ON public.bookings FOR SELECT
  USING (host_id = auth.uid() OR renter_id = auth.uid());

CREATE POLICY "Host or renter can insert bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (host_id = auth.uid() OR renter_id = auth.uid());

CREATE POLICY "Host can update own bookings"
  ON public.bookings FOR UPDATE
  USING (host_id = auth.uid() OR renter_id = auth.uid());
