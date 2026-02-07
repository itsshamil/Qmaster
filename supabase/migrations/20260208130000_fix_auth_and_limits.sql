-- Fix permissions for get_service_metrics
-- This function is used by the frontend to get wait times, so it needs to be accessible
-- Removed 'volume_user' as it does not exist.
GRANT EXECUTE ON FUNCTION public.get_service_metrics(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_service_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_service_metrics(UUID) TO service_role;

-- Ensure the function is SECURITY DEFINER to bypass RLS on the underlying tables if needed
-- (The logic filters by CURRENT_DATE and available staff, which should be public info anyway)
ALTER FUNCTION public.get_service_metrics(UUID) SECURITY DEFINER;
