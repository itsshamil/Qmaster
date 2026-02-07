-- Fix profile update by adding policy for public role
-- The Supabase client uses 'public' role for authenticated requests

-- Add UPDATE policy for public role (in addition to authenticated)
DROP POLICY IF EXISTS "public_update_own_profile" ON public.profiles;

CREATE POLICY "public_update_own_profile" ON public.profiles
FOR UPDATE
TO public
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Ensure public role has UPDATE permission
GRANT UPDATE ON public.profiles TO public;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO anon;
