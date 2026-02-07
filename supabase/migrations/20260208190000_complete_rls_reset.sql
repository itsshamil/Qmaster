-- COMPLETE RLS RESET FOR PROFILES TABLE
-- This migration removes ALL existing policies and creates a fresh, working set

-- Step 1: Disable RLS temporarily
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies (comprehensive cleanup)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.profiles';
    END LOOP;
END $$;

-- Step 3: Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Step 4: Create simple, working policies

-- Allow authenticated users to SELECT their own profile
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow authenticated users to INSERT their own profile (signup)
CREATE POLICY "profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow authenticated users to UPDATE their own profile
CREATE POLICY "profiles_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow authenticated users to DELETE their own profile
CREATE POLICY "profiles_delete_own"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- Allow anonymous/public to SELECT all profiles (for queue display with masked names)
CREATE POLICY "profiles_select_public"
ON public.profiles
FOR SELECT
TO anon, public
USING (true);

-- Step 5: Ensure proper grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;

-- Verification query (commented out, but you can run manually to verify)
-- SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE tablename = 'profiles' ORDER BY cmd, policyname;
