-- Emergency Fix: Check and Fix Staff Table
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Check what columns exist in staff table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'staff'
ORDER BY ordinal_position;

-- 2. Check current staff records
SELECT * FROM public.staff;

-- 3. Check RLS policies on staff table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'staff';

-- 4. Temporarily disable RLS on staff table (for testing)
ALTER TABLE public.staff DISABLE ROW LEVEL SECURITY;

-- 5. Check if profiles table has RLS issues
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles';

-- 6. Allow authenticated users to insert into profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- 7. Check auth.users to see if accounts are being created
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;
