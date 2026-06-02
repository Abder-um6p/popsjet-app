-- Migration: Password reset requests
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  reviewed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_note   TEXT
);

CREATE INDEX IF NOT EXISTS idx_prr_status    ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_prr_user_id   ON password_reset_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_prr_requested ON password_reset_requests(requested_at DESC);

-- RLS
ALTER TABLE password_reset_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "Users can view own reset requests"
  ON password_reset_requests FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own requests
CREATE POLICY "Users can create reset requests"
  ON password_reset_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins and directors can see all requests
CREATE POLICY "Admins can view all reset requests"
  ON password_reset_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'directeur')
    )
  );

-- Admins can update (approve/reject) requests
CREATE POLICY "Admins can update reset requests"
  ON password_reset_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'directeur')
    )
  );
