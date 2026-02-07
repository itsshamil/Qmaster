-- Staff Dashboard Setup
-- Run this to set up your staff member with a service

-- 1. Check available services
SELECT id, name, icon FROM public.services;

-- 2. Assign your staff to a service (pick a service_id from above)
-- Replace 'ad515c6f-ea84-4465-a8ad-7e5f78a1f626' with your user ID
-- Replace the service_id with an actual service ID from step 1

UPDATE public.staff
SET service_id = (SELECT id FROM public.services LIMIT 1),
    is_available = true,
    approved = true
WHERE id = 'ad515c6f-ea84-4465-a8ad-7e5f78a1f626';

-- 3. Verify your staff record
SELECT 
  s.id,
  s.is_available,
  s.approved,
  srv.name as service_name,
  p.full_name,
  p.email
FROM public.staff s
JOIN public.profiles p ON s.id = p.id
LEFT JOIN public.services srv ON s.service_id = srv.id
WHERE s.id = 'ad515c6f-ea84-4465-a8ad-7e5f78a1f626';

-- 4. Check RLS policies for tokens (staff need to read/update tokens)
DROP POLICY IF EXISTS "Staff can read tokens for their service" ON public.tokens;
CREATE POLICY "Staff can read tokens for their service" ON public.tokens
FOR SELECT TO authenticated
USING (
  service_id IN (
    SELECT service_id FROM public.staff WHERE id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Staff can update tokens for their service" ON public.tokens;
CREATE POLICY "Staff can update tokens for their service" ON public.tokens
FOR UPDATE TO authenticated
USING (
  service_id IN (
    SELECT service_id FROM public.staff WHERE id = auth.uid()
  )
)
WITH CHECK (
  service_id IN (
    SELECT service_id FROM public.staff WHERE id = auth.uid()
  )
);

-- 5. Allow customers to read their own tokens
DROP POLICY IF EXISTS "Customers can read own tokens" ON public.tokens;
CREATE POLICY "Customers can read own tokens" ON public.tokens
FOR SELECT TO authenticated
USING (customer_id = auth.uid());

-- 6. Verify policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'tokens'
ORDER BY policyname;
