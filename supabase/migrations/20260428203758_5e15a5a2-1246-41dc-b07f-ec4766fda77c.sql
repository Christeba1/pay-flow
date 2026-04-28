UPDATE public.profiles
SET email = lower(trim(email))
WHERE email IS NOT NULL
  AND email <> lower(trim(email));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_lower_idx
ON public.profiles (lower(email));