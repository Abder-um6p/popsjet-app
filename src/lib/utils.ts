import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

/** Fusionne les classes Tailwind sans conflits */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formate une date ISO en français */
export function formatDate(date?: string | null): string {
  if (!date) return '—'
  return format(new Date(date), 'dd MMM yyyy', { locale: fr })
}

/** Formate une date en relatif (ex. "il y a 2 heures") */
export function timeAgo(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })
}

/** Formate un montant en MAD */
export function formatMAD(amount: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 0,
  }).format(amount)
}

/** Formate un montant dans une devise donnée (MAD par défaut) */
export function formatAmount(amount: number, currency: string = 'MAD'): string {
  const validCurrencies = ['MAD', 'EUR', 'USD']
  const cur = validCurrencies.includes(currency) ? currency : 'MAD'
  const locale = cur === 'MAD' ? 'fr-MA' : cur === 'EUR' ? 'fr-FR' : 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 0,
  }).format(amount)
}

/** Formate une taille de fichier */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

/** Retourne les initiales d'un nom */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/** Couleur de badge par statut de projet */
export function projectStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    archived: 'bg-orange-100 text-orange-700',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-700'
}

/** Couleur de badge par statut de tâche */
export function taskStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending_acceptance: 'bg-purple-100 text-purple-700',
    todo:               'bg-gray-100 text-gray-700',
    in_progress:        'bg-blue-100 text-blue-700',
    review:             'bg-yellow-100 text-yellow-700',
    done:               'bg-green-100 text-green-700',
    cancelled:          'bg-red-100 text-red-700',
    blocked:            'bg-orange-100 text-orange-700',
    refused:            'bg-red-100 text-red-700',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-700'
}

/** Couleur par priorité */
export function taskPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  }
  return colors[priority] ?? 'bg-gray-100 text-gray-600'
}

/** Libellés en français */
export const LABELS = {
  project_type: {
    workshop: 'Workshop',
    hackathon: 'Hackathon',
    bootcamp: 'Bootcamp',
    incubation: 'Incubation',
    meeting: 'Réunion',
    other: 'Autre',
    structured: 'Projet structuré',
    flexible: 'Projet flexible',
  },
  project_status: {
    draft: 'Brouillon',
    active: 'Actif',
    completed: 'Terminé',
    delayed: 'En retard',
    archived: 'Archivé',
  },
  project_structure: {
    structured: 'Projet structuré',
    flexible: 'Projet générique',
  },
  confidentiality: {
    public_internal: 'Public interne',
    restricted: 'Restreint',
    confidential: 'Confidentiel',
  },
  participant_option: {
    form: 'Formulaire d\'inscription',
    import: 'Import Excel',
    none: 'Aucun participant',
  },
  task_status: {
    pending_acceptance: 'En attente d\'acceptation',
    todo:               'À faire',
    in_progress:        'En cours',
    review:             'En révision',
    done:               'Terminé',
    cancelled:          'Annulé',
    blocked:            'Bloqué',
    refused:            'Refusé',
  },
  task_priority: {
    low: 'Faible',
    medium: 'Moyen',
    high: 'Élevé',
    urgent: 'Urgent',
  },
  user_role: {
    admin: 'Administrateur',
    directeur: 'Directeur',
    chef_projet: 'Chef de projet',
    membre: 'Membre',
  },
  expense_category: {
    transport: 'Transport',
    hebergement: 'Hébergement',
    restauration: 'Restauration',
    materiel: 'Matériel',
    logiciel: 'Logiciel',
    formation: 'Formation',
    communication: 'Communication',
    autre: 'Autre',
  },
  expense_status: {
    pending: 'En attente',
    approved: 'Approuvée',
    rejected: 'Rejetée',
  },
} as const
