-- Staff Approval System Migration
-- Adds approval workflow and RLS security to staff table

-- 1. Add approval columns to staff table
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);

-- 2. Add is_admin column to profiles for admin management
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- 3. Enable RLS on staff table
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Staff can read own record" ON public.staff;
DROP POLICY IF EXISTS "Admins can read all staff" ON public.staff;
DROP POLICY IF EXISTS "Admins can update staff" ON public.staff;
DROP POLICY IF EXISTS "Authenticated users can insert staff" ON public.staff;
DROP POLICY IF EXISTS "Admins can approve staff" ON public.staff;

-- 5. Create RLS policies for staff table

-- Staff members can read their own record
CREATE POLICY "Staff can read own record" ON public.staff
FOR SELECT
USING (auth.uid() = id);

-- Admins can read all staff records
CREATE POLICY "Admins can read all staff" ON public.staff
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Allow authenticated users to insert staff records (for signup)
CREATE POLICY "Authenticated users can insert staff" ON public.staff
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Staff can update their own availability
CREATE POLICY "Staff can update own availability" ON public.staff
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can update any staff record (for approval)
CREATE POLICY "Admins can update staff" ON public.staff
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- 6. Create function to check if staff is approved
CREATE OR REPLACE FUNCTION public.is_staff_approved(staff_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = staff_id AND approved = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Update existing staff records to be approved (migration safety)
-- This ensures existing staff members aren't locked out
UPDATE public.staff 
SET approved = true, 
    approved_at = NOW()
WHERE approved IS NULL OR approved = false;

-- 8. Create index for performance
CREATE INDEX IF NOT EXISTS idx_staff_approved ON public.staff(approved);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin);
