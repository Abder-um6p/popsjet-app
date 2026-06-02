-- ============================================================
-- Migration 004 — Plugin Intégrations (Microsoft 365, etc.)
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- ─── 1. Table integration_settings ───────────────────────────
-- Stocke la configuration de chaque intégration (credentials chiffrées en JSONB).
-- Une ligne par fournisseur (microsoft, google, slack...).
CREATE TABLE IF NOT EXISTS integration_settings (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    TEXT        NOT NULL UNIQUE,   -- 'microsoft', 'google', 'slack'
  enabled     BOOLEAN     NOT NULL DEFAULT false,
  config      JSONB       NOT NULL DEFAULT '{}',  -- credentials (tenant_id, client_id, etc.)
  options     JSONB       NOT NULL DEFAULT '{}',  -- feature flags (auto_folder, invite_members, etc.)
  tested_at   TIMESTAMPTZ,                         -- dernière connexion testée avec succès
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Colonnes SharePoint sur projects ─────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS sharepoint_folder_id  TEXT,
  ADD COLUMN IF NOT EXISTS sharepoint_folder_url TEXT,
  ADD COLUMN IF NOT EXISTS forms_url             TEXT;

-- ─── 3. Colonnes SharePoint sur tasks ────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS sharepoint_folder_id  TEXT,
  ADD COLUMN IF NOT EXISTS sharepoint_folder_url TEXT;

-- ─── 4. Colonnes SharePoint sur documents ────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS sharepoint_item_id TEXT,
  ADD COLUMN IF NOT EXISTS sharepoint_url     TEXT,
  ADD COLUMN IF NOT EXISTS sharepoint_edit_url TEXT,
  ADD COLUMN IF NOT EXISTS storage_backend    TEXT NOT NULL DEFAULT 'supabase'
  CHECK (storage_backend IN ('supabase', 'sharepoint', 'onedrive'));

-- ─── 5. RLS : seuls les admins peuvent lire/écrire integration_settings ───
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only — read integration_settings"
  ON integration_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin only — write integration_settings"
  ON integration_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ─── 6. Trigger updated_at ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_integration_settings_updated_at ON integration_settings;
CREATE TRIGGER set_integration_settings_updated_at
  BEFORE UPDATE ON integration_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 7. Données initiales ─────────────────────────────────────
INSERT INTO integration_settings (provider, enabled, config, options)
VALUES (
  'microsoft',
  false,
  '{}',
  '{
    "auto_create_folder": true,
    "auto_invite_members": true,
    "create_task_subfolder": true,
    "generate_sharing_links": true,
    "link_type": "view"
  }'
)
ON CONFLICT (provider) DO NOTHING;
