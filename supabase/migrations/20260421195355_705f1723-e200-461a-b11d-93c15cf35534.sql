-- Table pour stocker les codes OTP
CREATE TABLE public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_codes_email ON public.otp_codes(email);
CREATE INDEX idx_otp_codes_expires ON public.otp_codes(expires_at);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Personne ne peut lire/écrire directement (seulement via service role / RPC)
CREATE POLICY "No direct access to otp_codes"
ON public.otp_codes FOR ALL
USING (false) WITH CHECK (false);

-- Fonction pour créer un code OTP (hashed) - appelée par service role
CREATE OR REPLACE FUNCTION public.create_otp_code(_email TEXT, _plain_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Invalider les anciens codes pour cet email
  UPDATE public.otp_codes
  SET used = true
  WHERE email = lower(_email) AND used = false;

  -- Créer le nouveau code (hashé avec bcrypt)
  INSERT INTO public.otp_codes (email, code_hash, expires_at)
  VALUES (
    lower(_email),
    extensions.crypt(_plain_code, extensions.gen_salt('bf', 8)),
    now() + interval '10 minutes'
  );
END;
$$;

-- Fonction pour vérifier un code OTP
CREATE OR REPLACE FUNCTION public.verify_otp_code(_email TEXT, _plain_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
BEGIN
  SELECT * INTO rec
  FROM public.otp_codes
  WHERE email = lower(_email)
    AND used = false
    AND expires_at > now()
    AND attempts < 5
  ORDER BY created_at DESC
  LIMIT 1;

  IF rec IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.otp_codes SET attempts = attempts + 1 WHERE id = rec.id;

  IF extensions.crypt(_plain_code, rec.code_hash) = rec.code_hash THEN
    UPDATE public.otp_codes SET used = true WHERE id = rec.id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;