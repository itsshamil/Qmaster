-- Fix RLS policies for profiles table to allow users to update their own profiles

-- Enable RLS on profiles if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow users to insert their own profile (for signup)
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Also allow public read for masked names (for queue display)
DROP POLICY IF EXISTS "Public can view masked profiles" ON public.profiles;
CREATE POLICY "Public can view masked profiles" ON public.profiles
FOR SELECT
TO anon
USING (true);
