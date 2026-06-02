/**
 * Types TypeScript générés depuis le schéma Supabase (database_schema.sql)
 * À remplacer par les types auto-générés via : npx supabase gen types typescript
 */

export type UserRole = 'admin' | 'directeur' | 'chef_projet' | 'membre'
export type ProjectType = 'workshop' | 'hackathon' | 'structured' | 'flexible'
export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived'
export type TaskStatus = 'pending_acceptance' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled' | 'blocked' | 'refused'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ExpenseCategory =
  | 'transport' | 'hebergement' | 'restauration' | 'materiel'
  | 'logiciel' | 'formation' | 'communication' | 'autre'
export type ExpenseStatus = 'pending' | 'approved' | 'rejected'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  avatar_url?: string
  bio?: string
  skills: string[]
  languages: string[]
  linkedin_url?: string
  onboarding_completed: boolean
  disabled_at?: string | null
  invited_by?: string | null
  invite_note?: string | null
  created_at: string
  updated_at: string
}

export interface Program {
  id: string
  name: string
  description?: string
  start_date?: string
  end_date?: string
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  code: string
  program_id: string
  title: string
  description?: string
  type: ProjectType
  status: ProjectStatus
  start_date?: string
  end_date?: string
  budget: number
  completion_pct: number
  chef_projet_id?: string
  created_by: string
  deleted_at?: string | null
  deleted_by?: string | null
  is_deleted?: boolean
  created_at: string
  updated_at: string
  // Relations
  program?: Program
  chef_projet?: Profile
  members?: ProjectMember[]
  tasks?: Task[]
}

export interface ProjectMember {
  id: string
  project_id: string
  profile_id: string
  role: 'chef_projet' | 'membre' | 'observateur'
  joined_at: string
  profile?: Profile
}

export interface Task {
  id: string
  project_id: string
  title: string
  description?: string
  assigned_to?: string
  assigned_by?: string
  status: TaskStatus
  priority: TaskPriority
  due_date?: string
  estimated_hours?: number
  actual_hours?: number
  sort_order: number
  created_by: string
  deleted_at?: string
  // v1.6 — soft delete + undo audit columns
  deleted_by?: string | null
  acceptance_reset_at?: string | null
  refusal_override_at?: string | null
  // v1.7 — référence budgétaire optionnelle
  budget_reference_id?: string | null
  created_at: string
  updated_at: string
  // Acceptance flow
  pending_acceptance?: boolean
  accepted_at?: string | null
  refused_at?: string | null
  refused_reason?: string | null
  refused_by?: string | null
  // Relations
  assignee?: Profile
  assigner?: Profile
  comments?: TaskComment[]
  budget_reference?: BudgetReference | null
}

export interface TaskComment {
  id: string
  task_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  author?: Profile
}

export interface Participant {
  id: string
  anonymous_id: string
  project_id: string
  gender?: 'M' | 'F' | 'Other'
  age_range?: string
  city?: string
  education_level?: string
  skills: string[]
  participation_count: number
  notes?: string
  consent_given: boolean
  consent_date?: string
  deleted_at?: string
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  project_id: string
  title: string
  amount: number
  category: ExpenseCategory
  status: ExpenseStatus
  receipt_url?: string
  receipt_path?: string
  submitted_by: string
  approved_by?: string
  approved_at?: string
  rejection_note?: string
  notes?: string
  expense_date: string
  // v1.7 — référence budgétaire optionnelle
  budget_reference_id?: string | null
  created_at: string
  updated_at: string
  submitted_by_profile?: Profile
  approved_by_profile?: Profile
  budget_reference?: BudgetReference | null
}

export interface BudgetReference {
  id: string
  program_id: string
  code: string
  designation: string
  notes?: string | null
  is_active: boolean
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  project_id: string
  title: string
  description?: string
  file_url: string
  file_path: string
  file_name: string
  file_size: number
  mime_type: string
  bucket_name: string
  version: number
  is_latest: boolean
  uploaded_by: string
  created_at: string
  updated_at: string
  uploader?: Profile
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  is_read: boolean
  created_at: string
}

export type DocumentTag = 'proof' | 'invoice' | 'deliverable' | 'report' | 'screenshot' | 'other'

export interface TaskDocument {
  id: string
  task_id: string
  project_id: string
  uploaded_by: string | null
  file_name: string
  file_url: string
  file_path: string
  file_size: number
  mime_type: string
  document_tag: DocumentTag
  uploaded_at: string
  uploader?: Profile | null
}

export interface Pop {
  id: string
  author_id: string
  project_id?: string
  content: string
  created_at: string
  updated_at: string
  author?: Profile
  reactions?: PopReaction[]
}

export interface PopReaction {
  id: string
  pop_id: string
  user_id: string
  emoji: string
  created_at: string
}

// ─── Supabase Database type ────────────────────────────────────────────────
// Manually maintained to match the actual schema.
// To regenerate: npx supabase gen types typescript --project-id <id> > src/types/database.ts
//
// NOTE: Insert/Update types are defined inline (not via Omit<Database[...]>)
// to avoid circular type references that cause TypeScript to resolve to `never`.

export type DbJson = string | number | boolean | null | { [key: string]: DbJson } | DbJson[]

// ── Row types (standalone, no circular references) ──────────────────────────

type ProfileRow = {
  id: string; full_name: string; email: string; role: string
  avatar_url: string | null; bio: string | null; skills: string[]
  languages: string[]; linkedin_url: string | null
  onboarding_completed: boolean; disabled_at: string | null
  invited_by: string | null; invite_note: string | null
  // Clés IA personnelles (cf. add_ai_api_key.sql + add_multi_ai_keys.sql + add_groq_key.sql + add_huggingface_key.sql)
  ai_api_key: string | null
  ai_gemini_key: string | null
  ai_openai_key: string | null
  ai_claude_key: string | null
  ai_groq_key: string | null
  ai_huggingface_key: string | null
  ai_active_provider: 'gemini' | 'openai' | 'claude' | 'groq' | 'huggingface' | null
  created_at: string; updated_at: string
}
type ProgramRow = {
  id: string; code: string; name: string; description: string | null
  color: string | null; is_active: boolean; start_date: string | null
  end_date: string | null; created_by: string
  // v1.8 — soft delete (ajouté par add_global_soft_delete.sql)
  deleted_at: string | null; deleted_by: string | null
  created_at: string; updated_at: string
  // v2 — intégrations Drive/SharePoint
  google_folder_id:      string | null
  google_folder_url:     string | null
  sharepoint_folder_id:  string | null
  sharepoint_folder_url: string | null
}
type ProjectRow = {
  id: string; code: string; program_id: string; title: string
  description: string | null; type: string; status: string
  start_date: string | null; end_date: string | null; budget: number | null
  budget_currency: string | null
  completion_pct: number
  chef_projet_id: string | null
  responsible_id: string | null
  is_structured: boolean | null
  metadata: Record<string, unknown> | null
  created_by: string; deleted_at: string | null; deleted_by: string | null
  is_deleted: boolean; created_at: string; updated_at: string
  // v2 — intégrations Microsoft SharePoint + Google Drive
  sharepoint_folder_id:  string | null
  sharepoint_folder_url: string | null
  forms_url:             string | null
  google_folder_id:      string | null
  google_folder_url:     string | null
}
type ProjectMemberRow = {
  id: string; project_id: string; profile_id: string
  role: string; joined_at: string
}
type TaskRow = {
  id: string; project_id: string; title: string; description: string | null
  assigned_to: string | null; assigned_by: string | null; status: string; priority: string
  due_date: string | null; estimated_hours: number | null; actual_hours: number | null
  sort_order: number; created_by: string; deleted_at: string | null
  pending_acceptance: boolean; accepted_at: string | null; refused_at: string | null
  refused_reason: string | null; refused_by: string | null
  // v1.6 — soft delete + undo audit columns (optionnelles, ajoutées par add_task_undo_delete.sql)
  deleted_by?: string | null
  acceptance_reset_at?: string | null
  refusal_override_at?: string | null
  // v1.7 — référence budgétaire (optionnelle, ajoutée par add_budget_references.sql)
  budget_reference_id?: string | null
  created_at: string; updated_at: string
  // v2 — intégration Microsoft SharePoint
  sharepoint_folder_id?: string | null
  sharepoint_folder_url?: string | null
  // v2.1 — améliorations tâches (migration 006)
  label?: string | null
  ref_number?: string | null
  is_draft?: boolean
  google_folder_id?: string | null
  google_folder_url?: string | null
}
type TaskCommentRow = {
  id: string; task_id: string; author_id: string; content: string
  created_at: string; updated_at: string
}
type ExpenseRow = {
  id: string; project_id: string; title: string; amount: number
  category: string; status: string; receipt_url: string | null
  receipt_path: string | null; submitted_by: string; approved_by: string | null
  approved_at: string | null; rejection_note: string | null; notes: string | null
  expense_date: string
  // v1.7 — référence budgétaire (optionnelle, ajoutée par add_budget_references.sql)
  budget_reference_id?: string | null
  // v1.8 — soft delete (ajouté par add_global_soft_delete.sql)
  deleted_at?: string | null; deleted_by?: string | null
  created_at: string; updated_at: string
}
type BudgetReferenceRow = {
  id: string; program_id: string; code: string; designation: string
  notes: string | null; is_active: boolean; created_by: string | null
  // v1.8 — soft delete (ajouté par add_global_soft_delete.sql)
  deleted_at?: string | null; deleted_by?: string | null
  created_at: string; updated_at: string
}
type DocumentRow = {
  id: string; project_id: string; title: string; description: string | null
  file_url: string; file_path: string; file_name: string; file_size: number
  mime_type: string; bucket_name: string; version: number; is_latest: boolean
  uploaded_by: string
  // v1.8 — soft delete (ajouté par add_global_soft_delete.sql)
  deleted_at?: string | null; deleted_by?: string | null
  created_at: string; updated_at: string
}
type NotificationRow = {
  id: string; user_id: string; type: string; title: string; message: string
  data: DbJson | null; is_read: boolean; created_at: string
}
type PopRow = {
  id: string; author_id: string; project_id: string | null; content: string
  // v1.8 — soft delete (ajouté par add_global_soft_delete.sql)
  deleted_at?: string | null; deleted_by?: string | null
  created_at: string; updated_at: string
}
type PopReactionRow = {
  id: string; pop_id: string; user_id: string; emoji: string; created_at: string
}
type AuditLogRow = {
  id: string; user_id: string | null; user_email: string | null
  action: string; entity_type: string | null; entity_id: string | null
  entity_name: string | null; old_data: DbJson | null; new_data: DbJson | null
  ip_address: string | null; user_agent: string | null; created_at: string
}
type TaskActivityLogRow = {
  id: string; task_id: string; user_id: string | null; action: string
  old_value: string | null; new_value: string | null; note: string | null
  created_at: string
}
type TaskDocumentRow = {
  id: string; task_id: string; project_id: string; uploaded_by: string | null
  file_name: string; file_url: string; file_path: string
  file_size: number; mime_type: string; document_tag: string
  uploaded_at: string
}
type ParticipantRow = {
  id: string; anonymous_id: string; project_id: string; gender: string | null
  age_range: string | null; city: string | null; education_level: string | null
  skills: string[]; participation_count: number; notes: string | null
  consent_given: boolean; consent_date: string | null; deleted_at: string | null
  created_at: string; updated_at: string
}
type IntegrationSettingsRow = {
  id: string
  provider: string
  enabled: boolean
  config: Record<string, unknown>
  options: Record<string, unknown>
  tested_at: string | null
  created_at: string
  updated_at: string
}

// ── Database type ────────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Partial<ProfileRow> & { id: string }
        Update: Partial<ProfileRow>
        Relationships: []
      }
      programs: {
        Row: ProgramRow
        Insert: Partial<ProgramRow> & { name: string; code: string; created_by: string }
        Update: Partial<ProgramRow>
        Relationships: []
      }
      projects: {
        Row: ProjectRow
        Insert: Partial<ProjectRow> & { title: string; type: string; program_id: string; created_by: string }
        Update: Partial<ProjectRow>
        Relationships: []
      }
      project_members: {
        Row: ProjectMemberRow
        Insert: { project_id: string; profile_id: string; role: string; id?: string }
        Update: Partial<ProjectMemberRow>
        Relationships: []
      }
      tasks: {
        Row: TaskRow
        Insert: Partial<TaskRow> & { title: string; project_id: string; created_by: string }
        Update: Partial<TaskRow>
        Relationships: []
      }
      task_comments: {
        Row: TaskCommentRow
        Insert: Partial<TaskCommentRow> & { task_id: string; author_id: string; content: string }
        Update: Partial<TaskCommentRow>
        Relationships: []
      }
      task_documents: {
        Row: TaskDocumentRow
        Insert: Partial<TaskDocumentRow> & { task_id: string; project_id: string; file_name: string; file_url: string; file_path: string }
        Update: Partial<TaskDocumentRow>
        Relationships: []
      }
      task_activity_logs: {
        Row: TaskActivityLogRow
        Insert: Partial<TaskActivityLogRow> & { task_id: string; action: string }
        Update: Partial<TaskActivityLogRow>
        Relationships: []
      }
      expenses: {
        Row: ExpenseRow
        Insert: Partial<ExpenseRow> & { title: string; amount: number; project_id: string; submitted_by: string; expense_date: string }
        Update: Partial<ExpenseRow>
        Relationships: []
      }
      documents: {
        Row: DocumentRow
        Insert: Partial<DocumentRow> & { title: string; project_id: string; file_url: string; file_path: string; file_name: string; file_size: number; mime_type: string; bucket_name: string; uploaded_by: string }
        Update: Partial<DocumentRow>
        Relationships: []
      }
      notifications: {
        Row: NotificationRow
        Insert: Partial<NotificationRow> & { user_id: string; type: string; title: string; message: string }
        Update: Partial<NotificationRow>
        Relationships: []
      }
      pops: {
        Row: PopRow
        Insert: Partial<PopRow> & { author_id: string; content: string }
        Update: Partial<PopRow>
        Relationships: []
      }
      pop_reactions: {
        Row: PopReactionRow
        Insert: { pop_id: string; user_id: string; emoji: string; id?: string }
        Update: Partial<PopReactionRow>
        Relationships: []
      }
      participants: {
        Row: ParticipantRow
        Insert: Partial<ParticipantRow> & { anonymous_id: string; project_id: string }
        Update: Partial<ParticipantRow>
        Relationships: []
      }
      audit_logs: {
        Row: AuditLogRow
        Insert: Partial<AuditLogRow> & { action: string }
        Update: Partial<AuditLogRow>
        Relationships: []
      }
      budget_references: {
        Row: BudgetReferenceRow
        Insert: Partial<BudgetReferenceRow> & { program_id: string; code: string; designation: string }
        Update: Partial<BudgetReferenceRow>
        Relationships: []
      }
      integration_settings: {
        Row: IntegrationSettingsRow
        Insert: Partial<IntegrationSettingsRow> & { provider: string }
        Update: Partial<IntegrationSettingsRow>
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
  }
}
