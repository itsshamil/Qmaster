-- Ensure authenticated users can view their own tokens (explicitly)
-- This supplements the public read policy and ensures useActiveToken works for logged in users
-- policies are OR'd, so this ensures access even if public read is disabled later.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tokens' AND policyname = 'Users can view own tokens'
  ) THEN
    CREATE POLICY "Users can view own tokens" ON public.tokens
    FOR SELECT
    TO authenticated
    USING (auth.uid() = customer_id);
  END IF;
END
$$;

-- Also ensure we have an index on customer_id and status for faster filtering of active tokens
CREATE INDEX IF NOT EXISTS idx_tokens_customer_active ON public.tokens(customer_id, status) WHERE status IN ('waiting', 'serving');
