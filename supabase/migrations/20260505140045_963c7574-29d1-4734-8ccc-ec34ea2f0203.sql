ALTER TABLE public.transactions ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN receiver_id DROP NOT NULL;
ALTER TABLE public.transactions DROP CONSTRAINT transactions_sender_id_fkey;
ALTER TABLE public.transactions DROP CONSTRAINT transactions_receiver_id_fkey;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.profiles(id) ON DELETE SET NULL;