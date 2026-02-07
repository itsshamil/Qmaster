-- Fix Staff Registration Issues
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Fix RLS on profiles table - Allow authenticated users to create their own profile
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
CREATE POLICY "Users can create own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

-- 2. Check if staff table has 'name' column, if not, it might be using a different schema
-- First, let's see what columns exist in staff table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'staff' 
ORDER BY ordinal_position;

-- 3. Disable email confirmation requirement (for development)
-- This needs to be done in Supabase Dashboard > Authentication > Settings
-- Set "Enable email confirmations" to OFF

-- Alternatively, if you want to keep email confirmation enabled,
-- you can auto-confirm users with this function (not recommended for production):
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = NEW.id AND email_confirmed_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-confirm (optional, for development only)
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();
