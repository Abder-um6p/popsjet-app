'use client'

import { useMemo } from 'react'
import { Sparkles, AlertTriangle, CheckCircle2, Users, Lightbulb } from 'lucide-react'
import { differenceInDays } from 'date-fns'

// Stable "today" reference — captured once on client mount, never on server
// Prevents SSR/client date divergence causing hydration mismatches
const TODAY = typeof window !== 'undefined' ? new Date() : null

interface FormValues {
  title?: string
  type?: string
  project_structure?: string
  end_date?: string
  needs_logistique?: string[]
  needs_communication?: string[]
  needs_administratif?: string[]
  responsible_id?: string
  collaborator_ids?: string[]
  program_id?: string
}

interface Suggestion {
  type: 'task' | 'risk' | 'tip' | 'team'
  icon: React.ReactNode
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

function generateSuggestions(form: FormValues): Suggestion[] {
  const suggestions: Suggestion[] = []

  // Type-based task suggestions
  if (form.type === 'workshop' || form.type === 'hackathon' || form.type === 'bootcamp') {
    suggestions.push({
      type: 'task',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      title: 'Créer un formulaire d\'inscription',
      description: 'Indispensable pour les événements avec participants externes',
      priority: 'high',
    })
    suggestions.push({
      type: 'task',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      title: 'Réserver la salle ou le lieu',
      description: 'À faire en priorité pour bloquer les disponibilités',
      priority: 'high',
    })
  }

  if (form.type === 'hackathon') {
    suggestions.push({
      type: 'task',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      title: 'Préparer les critères de notation',
      description: 'Définir le jury et les critères avant le lancement',
      priority: 'medium',
    })
    suggestions.push({
      type: 'tip',
      icon: <Lightbulb className="w-3.5 h-3.5" />,
      title: 'Activer les réseaux sociaux',
      description: 'Un hackathon gagne en visibilité avec une communication digitale active',
      priority: 'medium',
    })
  }

  if (form.type === 'incubation') {
    suggestions.push({
      type: 'task',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      title: 'Préparer la convention de partenariat',
      description: 'Document administratif à valider avec les équipes RH/Juridique',
      priority: 'high',
    })
  }

  // Deadline risk analysis
  if (form.end_date && TODAY) {
    const daysLeft = differenceInDays(new Date(form.end_date), TODAY)
    if (daysLeft < 0) {
      suggestions.push({
        type: 'risk',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        title: 'Date dépassée',
        description: 'La date de fin est dans le passé. Vérifiez la date de clôture.',
        priority: 'high',
      })
    } else if (daysLeft < 7) {
      suggestions.push({
        type: 'risk',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        title: `Délai très court — ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
        description: 'Temps limité : priorisez les tâches critiques et mobilisez l\'équipe',
        priority: 'high',
      })
    } else if (daysLeft < 21) {
      suggestions.push({
        type: 'risk',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        title: `Délai serré — ${daysLeft} jours`,
        description: 'Planifiez rapidement pour éviter les blocages de dernière minute',
        priority: 'medium',
      })
    }
  }

  // Needs-based suggestions
  if (form.needs_logistique?.includes('transport') || form.needs_logistique?.includes('billets_avion')) {
    suggestions.push({
      type: 'task',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      title: 'Lancer les demandes de voyage tôt',
      description: 'Les validations transport prennent souvent 5-10 jours',
      priority: 'high',
    })
  }

  if (form.needs_logistique?.includes('hebergement')) {
    suggestions.push({
      type: 'task',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      title: 'Réserver les hébergements',
      description: 'Bloquer les chambres dès que les dates sont confirmées',
      priority: 'medium',
    })
  }

  if (form.needs_administratif?.includes('demande_achat')) {
    suggestions.push({
      type: 'risk',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      title: 'Délai achats : 10-15 jours',
      description: 'Soumettez les demandes d\'achat au moins 2 semaines avant la date',
      priority: 'medium',
    })
  }

  // Team suggestions
  if (!form.responsible_id) {
    suggestions.push({
      type: 'team',
      icon: <Users className="w-3.5 h-3.5" />,
      title: 'Désigner un responsable',
      description: 'Un projet sans responsable nommé a 3x plus de risque de dérive',
      priority: 'high',
    })
  }

  if ((form.collaborator_ids?.length ?? 0) === 0) {
    suggestions.push({
      type: 'team',
      icon: <Users className="w-3.5 h-3.5" />,
      title: 'Ajouter des collaborateurs',
      description: 'Constituez votre équipe dès la création pour un meilleur suivi',
      priority: 'low',
    })
  }

  // Structure suggestion
  if (form.project_structure === 'structured') {
    suggestions.push({
      type: 'tip',
      icon: <Lightbulb className="w-3.5 h-3.5" />,
      title: 'Checklist auto générée',
      description: 'Un projet structuré créera automatiquement des tâches recommandées selon le type',
      priority: 'low',
    })
  }

  // If no suggestions, provide generic tips
  if (suggestions.length === 0) {
    suggestions.push({
      type: 'tip',
      icon: <Lightbulb className="w-3.5 h-3.5" />,
      title: 'Complétez les informations',
      description: 'Plus vous renseignez de détails, plus les suggestions seront pertinentes',
      priority: 'low',
    })
  }

  return suggestions.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.priority] - order[b.priority]
  })
}

const PRIORITY_STYLES = {
  high: { bar: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100 text-red-700' },
  medium: { bar: 'bg-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-700' },
  low: { bar: 'bg-blue-400', bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-600' },
}

const TYPE_LABEL = {
  task: 'Tâche',
  risk: 'Risque',
  tip: 'Conseil',
  team: 'Équipe',
}

interface AIProjectSuggestionsProps {
  formValues: FormValues
  compact?: boolean
}

export default function AIProjectSuggestions({ formValues, compact = false }: AIProjectSuggestionsProps) {
  const suggestions = useMemo(() => generateSuggestions(formValues), [
    formValues.type,
    formValues.project_structure,
    formValues.end_date,
    JSON.stringify(formValues.needs_logistique),
    JSON.stringify(formValues.needs_communication),
    JSON.stringify(formValues.needs_administratif),
    formValues.responsible_id,
    JSON.stringify(formValues.collaborator_ids),
  ])

  const highCount = suggestions.filter((s) => s.priority === 'high').length

  return (
    <div className={compact ? '' : 'bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden'}>
      {/* Header */}
      <div className={compact ? 'mb-3' : 'px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-800">Assistant IA</span>
          </div>
          {highCount > 0 && (
            <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {highCount} urgent{highCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {!compact && (
          <p className="text-xs text-gray-500 mt-1 pl-8">
            Suggestions basées sur votre configuration
          </p>
        )}
      </div>

      {/* Suggestions list */}
      <div className={compact ? 'space-y-2' : 'p-3 space-y-2 max-h-80 overflow-y-auto'}>
        {suggestions.map((s, idx) => {
          const styles = PRIORITY_STYLES[s.priority]
          return (
            <div key={idx} className={`flex gap-2.5 p-2.5 rounded-lg ${styles.bg}`}>
              <div className={`mt-0.5 flex-shrink-0 ${styles.text}`}>{s.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`text-xs font-semibold ${styles.text}`}>{s.title}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${styles.badge}`}>
                    {TYPE_LABEL[s.type]}
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{s.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      {!compact && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">
            💡 Les suggestions s'adaptent en temps réel à votre configuration
          </p>
        </div>
      )}
    </div>
  )
}
