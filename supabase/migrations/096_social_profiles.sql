-- Public profile settings
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS public_profile_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_slug TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_tagline TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_stats JSONB DEFAULT '{}';

-- Testimonials
CREATE TABLE IF NOT EXISTS public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  relationship TEXT NOT NULL,
  content TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  traits TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(author_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_testimonials_recipient ON public.testimonials(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_testimonials_author ON public.testimonials(author_id);

-- Profile share tracking
CREATE TABLE IF NOT EXISTS public.profile_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  shared_via TEXT NOT NULL,
  platform TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_shares_user ON public.profile_shares(user_id);

-- RLS
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved testimonials"
  ON public.testimonials FOR SELECT
  USING (status = 'approved' OR auth.uid() = recipient_id OR auth.uid() = author_id);

CREATE POLICY "Users can write testimonials"
  ON public.testimonials FOR INSERT
  WITH CHECK (auth.uid() = author_id AND auth.uid() != recipient_id);

CREATE POLICY "Recipients can update testimonial status"
  ON public.testimonials FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id AND status IN ('approved', 'hidden'));

CREATE POLICY "Users can track own shares"
  ON public.profile_shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own share stats"
  ON public.profile_shares FOR SELECT
  USING (auth.uid() = user_id);

-- Generate slug from name
CREATE OR REPLACE FUNCTION generate_profile_slug()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  IF NEW.profile_slug IS NULL AND NEW.full_name IS NOT NULL THEN
    base_slug := lower(regexp_replace(NEW.full_name, '[^a-zA-Z0-9]', '-', 'g'));
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    final_slug := base_slug;

    WHILE EXISTS (SELECT 1 FROM public.users WHERE profile_slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;

    NEW.profile_slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_slug
  BEFORE INSERT OR UPDATE OF full_name ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION generate_profile_slug();
