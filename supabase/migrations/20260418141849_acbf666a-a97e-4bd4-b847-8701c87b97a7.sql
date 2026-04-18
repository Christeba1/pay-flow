-- Activer pgcrypto pour le hashage sécurisé des PINs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================
-- RPC: set_pin_code
-- Permet à l'utilisateur de définir/changer son PIN
-- =========================================
CREATE OR REPLACE FUNCTION public.set_pin_code(_new_pin TEXT, _current_pin TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  current_hash TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  IF _new_pin IS NULL OR length(_new_pin) < 4 OR length(_new_pin) > 6 OR _new_pin !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'invalid_pin: PIN must be 4 to 6 digits' USING ERRCODE = '22023';
  END IF;

  SELECT pin_code_hashed INTO current_hash FROM public.profiles WHERE id = uid;

  -- Si un PIN existe déjà, on doit fournir l'ancien
  IF current_hash IS NOT NULL THEN
    IF _current_pin IS NULL OR crypt(_current_pin, current_hash) <> current_hash THEN
      RAISE EXCEPTION 'invalid_current_pin' USING ERRCODE = '28000';
    END IF;
  END IF;

  UPDATE public.profiles
  SET pin_code_hashed = crypt(_new_pin, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = uid;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- =========================================
-- RPC: execute_transfer
-- Transfert atomique avec vérifications complètes
-- =========================================
CREATE OR REPLACE FUNCTION public.execute_transfer(
  _receiver_handle TEXT,
  _amount NUMERIC,
  _pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_uid UUID := auth.uid();
  sender_balance NUMERIC;
  sender_pin_hash TEXT;
  receiver_uid UUID;
  fee_amount NUMERIC;
  total_debit NUMERIC;
  new_tx_id UUID;
  new_receipt UUID;
  clean_handle TEXT;
BEGIN
  -- 1. Auth
  IF sender_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  -- 2. Validation montant
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  -- 3. Calcul frais 1%
  fee_amount := round(_amount * 0.01, 2);
  total_debit := _amount + fee_amount;

  -- 4. Récupération expéditeur (verrou ligne pour éviter race condition)
  SELECT balance, pin_code_hashed INTO sender_balance, sender_pin_hash
  FROM public.profiles WHERE id = sender_uid
  FOR UPDATE;

  IF sender_pin_hash IS NULL THEN
    RAISE EXCEPTION 'pin_not_set' USING ERRCODE = '28000';
  END IF;

  -- 5. Vérification PIN (bcrypt via pgcrypto)
  IF crypt(_pin, sender_pin_hash) <> sender_pin_hash THEN
    RAISE EXCEPTION 'invalid_pin' USING ERRCODE = '28000';
  END IF;

  -- 6. Recherche destinataire (verrou ligne)
  clean_handle := upper(trim(both ' @' from _receiver_handle));
  SELECT id INTO receiver_uid
  FROM public.profiles WHERE handle = clean_handle
  FOR UPDATE;

  IF receiver_uid IS NULL THEN
    RAISE EXCEPTION 'receiver_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF receiver_uid = sender_uid THEN
    RAISE EXCEPTION 'self_transfer_forbidden' USING ERRCODE = '22023';
  END IF;

  -- 7. Vérification solde
  IF sender_balance < total_debit THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = '23514';
  END IF;

  -- 8. Transfert atomique (debit + credit + insert).
  -- Si une de ces 3 opérations échoue (ex: contrainte balance >= 0),
  -- Postgres annule TOUTE la fonction => rollback complet.
  UPDATE public.profiles
  SET balance = balance - total_debit, updated_at = now()
  WHERE id = sender_uid;

  UPDATE public.profiles
  SET balance = balance + _amount, updated_at = now()
  WHERE id = receiver_uid;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, fee, status)
  VALUES (sender_uid, receiver_uid, _amount, fee_amount, 'success')
  RETURNING id, receipt_code INTO new_tx_id, new_receipt;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', new_tx_id,
    'receipt_code', new_receipt,
    'amount', _amount,
    'fee', fee_amount,
    'total_debited', total_debit
  );
END;
$$;

-- =========================================
-- Permissions: les utilisateurs authentifiés peuvent appeler ces RPCs
-- =========================================
REVOKE ALL ON FUNCTION public.execute_transfer(TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_transfer(TEXT, NUMERIC, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.set_pin_code(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_pin_code(TEXT, TEXT) TO authenticated;
