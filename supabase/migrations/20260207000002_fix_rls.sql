-- Enable RLS on tokens (security best practice)
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;

-- 1. PUBLIC READ ACCESS
-- Required so users can see their own status via link (even if not logged in)
-- Required so clients can calculate 'people ahead' by counting other waiting tokens
DROP POLICY IF EXISTS "Public read access" ON public.tokens;
CREATE POLICY "Public read access" ON public.tokens
FOR SELECT USING (true);

-- 2. USER UPDATE ACCESS (Cancellation)
-- Allow users to update (cancel) ONLY their own tokens
DROP POLICY IF EXISTS "Users can update own tokens" ON public.tokens;
CREATE POLICY "Users can update own tokens" ON public.tokens
FOR UPDATE USING (auth.uid() = customer_id);

-- 3. STAFF UPDATE ACCESS (Serving, Completing)
-- Allow staff members to update ANY token
-- Checks if the current user's ID exists in the staff table
DROP POLICY IF EXISTS "Staff can update tokens" ON public.tokens;
CREATE POLICY "Staff can update tokens" ON public.tokens
FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM public.staff)
);
