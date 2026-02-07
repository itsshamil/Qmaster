-- FINAL FIX - Staff Registration
-- Run these commands in Supabase SQL Editor in ORDER

-- 1. Check current state
SELECT 'Auth Users:' as info, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'Profiles:', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'Staff:', COUNT(*) FROM public.staff;

-- 2. Disable email confirmation (CRITICAL)
-- Go to Supabase Dashboard > Authentication > Settings
-- Turn OFF "Enable email confirmations"
-- OR run this trigger:

CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS trigger AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = NOW()
  WHERE id = NEW.id AND email_confirmed_at IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();

-- 3. Fix RLS policies on profiles table
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4. Fix RLS policies on staff table
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can insert own record" ON public.staff;
CREATE POLICY "Staff can insert own record" ON public.staff
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Staff can read own record" ON public.staff;
CREATE POLICY "Staff can read own record" ON public.staff
FOR SELECT TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Staff can update own record" ON public.staff;
CREATE POLICY "Staff can update own record" ON public.staff
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. For your existing user, manually create records:
-- Replace with your actual user ID: ad515c6f-ea84-4465-a8ad-7e5f78a1f626

-- Insert profile if not exists
INSERT INTO public.profiles (id, email, full_name, role)
VALUES ('ad515c6f-ea84-4465-a8ad-7e5f78a1f626', 'itsshamilhere@gmail.com', 'shamil', 'staff')
ON CONFLICT (id) DO UPDATE SET role = 'staff';

-- Insert staff record (profile must exist first due to foreign key)
INSERT INTO public.staff (id, is_available, service_id, approved)
VALUES ('ad515c6f-ea84-4465-a8ad-7e5f78a1f626', false, NULL, false)
ON CONFLICT (id) DO NOTHING;

-- 6. Verify it worked
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  p.full_name,
  p.role,
  s.is_available,
  s.approved
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
LEFT JOIN public.staff s ON u.id = s.id
WHERE u.email = 'itsshamilhere@gmail.com';

-- 7. If you see your record above, you're done!
-- Now try signing in at /staff/login
