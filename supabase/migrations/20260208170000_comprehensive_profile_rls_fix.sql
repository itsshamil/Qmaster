-- Comprehensive fix for profiles RLS policies
-- This ensures authenticated users can update their profiles

-- First, disable RLS temporarily to clean up
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public can view masked profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policies

-- 1. Allow authenticated users to SELECT their own profile
CREATE POLICY "authenticated_users_select_own_profile" ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Allow authenticated users to UPDATE their own profile
CREATE POLICY "authenticated_users_update_own_profile" ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 3. Allow authenticated users to INSERT their own profile
CREATE POLICY "authenticated_users_insert_own_profile" ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 4. Allow public/anon to view all profiles (for queue display)
CREATE POLICY "public_select_all_profiles" ON public.profiles
FOR SELECT
TO anon, public
USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
