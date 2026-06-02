-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email  TEXT,
  action      TEXT NOT NULL,    -- e.g. create_project, update_task, approve_expense, login, etc.
  entity_type TEXT,             -- e.g. project, task, expense, user
  entity_id   UUID,
  entity_name TEXT,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action       ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type  ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id    ON public.audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON public.audit_logs(created_at DESC);

-- RLS: only admins can read audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;
CREATE POLICY "Admins can read audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "System can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (TRUE);

-- Function to log an action
CREATE OR REPLACE FUNCTION public.log_audit(
  p_user_id     UUID,
  p_user_email  TEXT,
  p_action      TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id   UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_old_data    JSONB DEFAULT NULL,
  p_new_data    JSONB DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.audit_logs (user_id, user_email, action, entity_type, entity_id, entity_name, old_data, new_data)
  VALUES (p_user_id, p_user_email, p_action, p_entity_type, p_entity_id, p_entity_name, p_old_data, p_new_data)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Auto-cleanup: keep only last 90 days of audit logs
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;
