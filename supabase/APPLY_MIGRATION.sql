-- Quick Fix: Apply Staff Approval Migration
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Add approval columns to staff table
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- 2. Add is_admin column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 3. Enable RLS on staff table
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Staff can read own record" ON public.staff;
DROP POLICY IF EXISTS "Admins can read all staff" ON public.staff;
DROP POLICY IF EXISTS "Admins can update staff" ON public.staff;
DROP POLICY IF EXISTS "Authenticated users can insert staff" ON public.staff;
DROP POLICY IF EXISTS "Staff can update own availability" ON public.staff;

-- 5. Create RLS policies

-- Staff can read own record
CREATE POLICY "Staff can read own record" ON public.staff
FOR SELECT USING (auth.uid() = id);

-- Admins can read all staff
CREATE POLICY "Admins can read all staff" ON public.staff
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Authenticated users can insert staff (for signup)
CREATE POLICY "Authenticated users can insert staff" ON public.staff
FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Staff can update own availability
CREATE POLICY "Staff can update own availability" ON public.staff
FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Admins can update staff (for approval)
CREATE POLICY "Admins can update staff" ON public.staff
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 6. Auto-approve existing staff (prevents lockout)
UPDATE public.staff 
SET approved = true, approved_at = NOW()
WHERE approved IS NULL OR approved = false;

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS idx_staff_approved ON public.staff(approved);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);

-- 8. Verify setup
SELECT 'Migration applied successfully!' as status;
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'staff' AND column_name IN ('approved', 'approved_at', 'approved_by');
