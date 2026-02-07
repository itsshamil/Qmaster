-- 1. TRIGGER: Auto-create profile on signup
-- This ensures we don't need a separate client-side call to create the profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'customer'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Safely recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. TRIGGER: Enforce One Ticket Per User Per Day
-- Prevents overbooking by checking if a non-cancelled ticket exists for the user today
CREATE OR REPLACE FUNCTION public.check_daily_ticket_limit()
RETURNS trigger AS $$
BEGIN
  -- Only check for customers (authenticated users)
  IF new.customer_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.tokens
      WHERE customer_id = new.customer_id
        AND created_at >= CURRENT_DATE
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
        AND status IN ('waiting', 'serving') -- only count truly active tickets
    ) THEN
      RAISE EXCEPTION 'Daily Limit Reached: You can only generate one active ticket per day.';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_daily_limit ON public.tokens;
CREATE TRIGGER enforce_daily_limit
  BEFORE INSERT ON public.tokens
  FOR EACH ROW EXECUTE PROCEDURE public.check_daily_ticket_limit();


-- 3. RLS: strictly enforce auth for tokens
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;

-- Remove broad policies if they exist (clean slate approach safe for this file?)
-- Better to just ensuring the specific policy exists or creating it if not.
-- Since we can't easily check existence in SQL without complex logic, we'll try to create it.
-- If it fails due to existence, that's fine, but to be clean:

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tokens' AND policyname = 'Users can create their own tokens'
  ) THEN
    CREATE POLICY "Users can create their own tokens" ON public.tokens
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = customer_id);
  END IF;
END
$$;
