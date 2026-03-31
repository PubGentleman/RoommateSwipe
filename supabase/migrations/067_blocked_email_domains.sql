CREATE TABLE IF NOT EXISTS blocked_email_domains (
  domain text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

INSERT INTO blocked_email_domains (domain) VALUES
  ('gmail.com'), ('googlemail.com'),
  ('outlook.com'), ('hotmail.com'), ('live.com'), ('msn.com'),
  ('yahoo.com'), ('ymail.com'), ('rocketmail.com'),
  ('icloud.com'), ('me.com'), ('mac.com'),
  ('aol.com'), ('aim.com'),
  ('protonmail.com'), ('proton.me'), ('pm.me'),
  ('zoho.com'), ('zohomail.com'),
  ('mail.com'), ('email.com'), ('inbox.com'),
  ('gmx.com'), ('gmx.net'), ('yandex.com'),
  ('tutanota.com'), ('tuta.io'), ('fastmail.com'),
  ('hushmail.com'), ('mailfence.com'), ('runbox.com'),
  ('posteo.de'), ('hey.com')
ON CONFLICT (domain) DO NOTHING;

ALTER TABLE blocked_email_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_email_domains_read_all"
  ON blocked_email_domains FOR SELECT
  USING (true);

CREATE TABLE IF NOT EXISTS whitelisted_emails (
  email text PRIMARY KEY,
  verified_by text,
  verification_notes text,
  license_number text,
  company_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE whitelisted_emails ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_agent_company_email_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  email_domain text;
  host_type text;
  user_role text;
  is_blocked boolean;
  is_whitelisted boolean;
BEGIN
  user_email := lower(trim(new.email));
  user_role := coalesce(new.raw_user_meta_data->>'role', 'renter');
  host_type := new.raw_user_meta_data->>'host_type';

  IF user_role = 'host' AND (host_type = 'agent' OR host_type = 'company') THEN
    SELECT EXISTS(
      SELECT 1 FROM public.whitelisted_emails WHERE lower(trim(email)) = user_email
    ) INTO is_whitelisted;

    IF NOT is_whitelisted THEN
      email_domain := split_part(user_email, '@', 2);

      SELECT EXISTS(
        SELECT 1 FROM public.blocked_email_domains WHERE domain = email_domain
      ) INTO is_blocked;

      IF is_blocked THEN
        RAISE EXCEPTION 'Agent and company accounts require a business email address. Please contact support for manual verification.';
      END IF;
    END IF;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS check_agent_company_email ON auth.users;
CREATE TRIGGER check_agent_company_email
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.check_agent_company_email_domain();
