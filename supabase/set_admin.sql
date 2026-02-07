-- Helper script to set a user as admin
-- Run this in Supabase SQL Editor or via psql

-- Replace 'admin@example.com' with the actual admin email
UPDATE public.profiles
SET is_admin = true
WHERE email = 'admin@example.com';

-- Verify the update
SELECT id, email, full_name, is_admin 
FROM public.profiles 
WHERE is_admin = true;
