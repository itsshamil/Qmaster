-- Add daily_limit to services for session limits
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS daily_limit INTEGER NULL;

-- Optional: set default limits for existing services (uncomment to set)
-- UPDATE public.services SET daily_limit = 100 WHERE daily_limit IS NULL;

CREATE INDEX IF NOT EXISTS idx_services_daily_limit ON public.services(daily_limit);
