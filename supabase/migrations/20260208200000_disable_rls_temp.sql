-- TEMPORARY: Disable RLS on profiles table to test if that's the issue
-- This will help us confirm if RLS is the problem

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Note: This is TEMPORARY for testing only
-- Once we confirm updates work, we'll re-enable RLS with proper policies
