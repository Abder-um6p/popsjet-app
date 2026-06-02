-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,  -- task_assigned | expense_approved | expense_rejected | deadline_warning | project_update
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  data       JSONB,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read    ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own notifications" ON public.notifications;
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);

-- Function to create a notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type    TEXT,
  p_title   TEXT,
  p_message TEXT,
  p_data    JSONB DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_data)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Auto-cleanup: keep only last 100 notifications per user
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id FROM public.notifications
      WHERE user_id = NEW.user_id
      ORDER BY created_at DESC
      LIMIT 100
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_notifications ON public.notifications;
CREATE TRIGGER trg_cleanup_notifications
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_old_notifications();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
