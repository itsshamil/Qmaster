-- Add staff_id to tokens so staff can be associated with serving tokens
ALTER TABLE public.tokens
ADD COLUMN IF NOT EXISTS staff_id UUID NULL;

-- Add foreign key reference to public.staff
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tokens_staff_id_fkey'
  ) THEN
    ALTER TABLE public.tokens
    ADD CONSTRAINT tokens_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Create an index to speed up staff queries
CREATE INDEX IF NOT EXISTS idx_tokens_staff_id ON public.tokens(staff_id);

-- OPTIONAL: refresh materialized views or other artifacts if needed
-- (No action required here)
