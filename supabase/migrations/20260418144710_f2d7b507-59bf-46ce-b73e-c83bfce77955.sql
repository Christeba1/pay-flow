CREATE OR REPLACE FUNCTION public.set_pin_code(_new_pin text, _current_pin text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF current_hash IS NOT NULL THEN
    IF _current_pin IS NULL OR extensions.crypt(_current_pin, current_hash) <> current_hash THEN
      RAISE EXCEPTION 'invalid_current_pin' USING ERRCODE = '28000';
    END IF;
  END IF;

  UPDATE public.profiles
  SET pin_code_hashed = extensions.crypt(_new_pin, extensions.gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = uid;

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.execute_transfer(_receiver_handle text, _amount numeric, _pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  IF sender_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '28000';
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;

  fee_amount := round(_amount * 0.01, 2);
  total_debit := _amount + fee_amount;

  SELECT balance, pin_code_hashed INTO sender_balance, sender_pin_hash
  FROM public.profiles WHERE id = sender_uid
  FOR UPDATE;

  IF sender_pin_hash IS NULL THEN
    RAISE EXCEPTION 'pin_not_set' USING ERRCODE = '28000';
  END IF;

  IF extensions.crypt(_pin, sender_pin_hash) <> sender_pin_hash THEN
    RAISE EXCEPTION 'invalid_pin' USING ERRCODE = '28000';
  END IF;

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

  IF sender_balance < total_debit THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = '23514';
  END IF;

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
$function$;