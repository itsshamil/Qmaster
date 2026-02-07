-- Create sessions table for tracking staff sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  marked BOOLEAN DEFAULT FALSE,
  marked_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sessions_service_id ON public.sessions(service_id);
CREATE INDEX IF NOT EXISTS idx_sessions_staff_id ON public.sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON public.sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_marked ON public.sessions(marked);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at);

-- Add session_id column to tokens if it doesn't exist
ALTER TABLE public.tokens
ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES public.sessions(session_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tokens_session_id ON public.tokens(session_id);

-- RLS Policies for sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Staff can view their own sessions
CREATE POLICY "staff_can_view_own_sessions" ON public.sessions
  FOR SELECT
  USING (auth.uid() = staff_id);

-- Staff can mark/unmark their own sessions
CREATE POLICY "staff_can_update_own_sessions" ON public.sessions
  FOR UPDATE
  USING (auth.uid() = staff_id)
  WITH CHECK (auth.uid() = staff_id);

-- Staff can create sessions
CREATE POLICY "staff_can_create_sessions" ON public.sessions
  FOR INSERT
  WITH CHECK (auth.uid() = staff_id);

-- Admin can view all sessions
CREATE POLICY "admin_can_view_all_sessions" ON public.sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
