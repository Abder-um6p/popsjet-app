import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, LevelFormat,
} from 'docx'

const PRIORITY_FR: Record<string, string> = {
  low: 'Faible', medium: 'Moyen', high: 'Élevé', urgent: 'Urgent',
}
const STATUS_FR: Record<string, string> = {
  todo: 'À faire', in_progress: 'En cours', review: 'En révision', done: 'Terminée',
}
const PROJECT_STATUS_FR: Record<string, string> = {
  active: 'Actif', on_hold: 'En pause', completed: 'Terminé', cancelled: 'Annulé', planning: 'Planification',
}
const PROJECT_TYPE_FR: Record<string, string> = {
  innovation: 'Innovation', research: 'Recherche', operational: 'Opérationnel',
  pilot: 'Pilote', strategic: 'Stratégique',
}

function cell(text: string, bold = false, fill = 'FFFFFF', width = 2340) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
    children: [new Paragraph({
      children: [new TextRun({ text, bold, font: 'Arial', size: 20 })],
    })],
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { project, tasks, members } = body
  if (!project) return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })

  const now = new Date()
  const formatDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'

  const taskList: any[] = tasks ?? []
  const memberList: any[] = members ?? []
  const done       = taskList.filter(t => t.status === 'done').length
  const inProgress = taskList.filter(t => t.status === 'in_progress').length
  const todo       = taskList.filter(t => t.status === 'todo').length
  const overdue    = taskList.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < now).length
  const pct        = project.completion_pct ?? (taskList.length > 0 ? Math.round((done / taskList.length) * 100) : 0)

  const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
  const borders = { top: border, bottom: border, left: border, right: border }

  // ── Build document ──────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'Arial', color: '1E3A5F' },
          paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: '2563EB' },
          paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '2563EB', space: 4 } },
            children: [
              new TextRun({ text: 'I&E Lab · UM6P — ', font: 'Arial', size: 18, color: '6B7280' }),
              new TextRun({ text: 'Rapport de projet', font: 'Arial', size: 18, bold: true, color: '2563EB' }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB', space: 4 } },
            children: [
              new TextRun({ text: `Généré le ${now.toLocaleDateString('fr-FR')}   ·   Page `, font: 'Arial', size: 16, color: '9CA3AF' }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16, color: '9CA3AF' }),
              new TextRun({ text: ' / ', font: 'Arial', size: 16, color: '9CA3AF' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16, color: '9CA3AF' }),
            ],
          })],
        }),
      },
      children: [
        // ── Title ────────────────────────────────────────────────────────────
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: project.title, font: 'Arial', size: 40, bold: true, color: '1E3A5F' })],
        }),
        new Paragraph({
          spacing: { after: 320 },
          children: [
            new TextRun({ text: `Code : ${project.code ?? '—'}`, font: 'Arial', size: 20, color: '6B7280' }),
            new TextRun({ text: '    ·    ', font: 'Arial', size: 20, color: 'D1D5DB' }),
            new TextRun({ text: PROJECT_TYPE_FR[project.type] ?? project.type ?? '—', font: 'Arial', size: 20, color: '6B7280' }),
            new TextRun({ text: '    ·    ', font: 'Arial', size: 20, color: 'D1D5DB' }),
            new TextRun({ text: PROJECT_STATUS_FR[project.status] ?? project.status ?? '—', font: 'Arial', size: 20, bold: true, color: '2563EB' }),
          ],
        }),

        // ── Description ──────────────────────────────────────────────────────
        ...(project.description ? [
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: 'Description', font: 'Arial', size: 28, bold: true, color: '2563EB' })],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [new TextRun({ text: project.description, font: 'Arial', size: 22, color: '374151' })],
          }),
        ] : []),

        // ── Informations générales ────────────────────────────────────────────
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: 'Informations générales', font: 'Arial', size: 28, bold: true, color: '2563EB' })],
        }),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2500, 2013, 2513, 2000],
          rows: [
            new TableRow({
              children: [
                cell('Champ', true, 'EFF6FF', 2500),
                cell('Valeur', true, 'EFF6FF', 2013),
                cell('Champ', true, 'EFF6FF', 2513),
                cell('Valeur', true, 'EFF6FF', 2000),
              ],
            }),
            new TableRow({
              children: [
                cell('Date de début', true, 'F9FAFB', 2500),
                cell(formatDate(project.start_date), false, 'FFFFFF', 2013),
                cell('Date de fin', true, 'F9FAFB', 2513),
                cell(formatDate(project.end_date), false, 'FFFFFF', 2000),
              ],
            }),
            new TableRow({
              children: [
                cell('Budget', true, 'F9FAFB', 2500),
                cell(project.budget != null ? `${Number(project.budget).toLocaleString('fr-FR')} MAD` : '—', false, 'FFFFFF', 2013),
                cell('Avancement', true, 'F9FAFB', 2513),
                cell(`${pct}%`, false, 'FFFFFF', 2000),
              ],
            }),
          ],
        }),

        // ── Avancement ───────────────────────────────────────────────────────
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360 },
          children: [new TextRun({ text: 'Avancement des tâches', font: 'Arial', size: 28, bold: true, color: '2563EB' })],
        }),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2257, 2257, 2255, 2257],
          rows: [
            new TableRow({
              children: [
                cell('À faire', true, 'EFF6FF', 2257),
                cell('En cours', true, 'FFF7ED', 2257),
                cell('En révision', true, 'F5F3FF', 2255),
                cell('Terminées', true, 'F0FDF4', 2257),
              ],
            }),
            new TableRow({
              children: [
                cell(String(todo), false, 'FFFFFF', 2257),
                cell(String(inProgress), false, 'FFFFFF', 2257),
                cell(String(taskList.filter(t => t.status === 'review').length), false, 'FFFFFF', 2255),
                cell(String(done), false, 'FFFFFF', 2257),
              ],
            }),
          ],
        }),

        // ── Tâches ───────────────────────────────────────────────────────────
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360 },
          children: [new TextRun({ text: `Liste des tâches (${taskList.length})`, font: 'Arial', size: 28, bold: true, color: '2563EB' })],
        }),

        ...(taskList.length === 0
          ? [new Paragraph({ children: [new TextRun({ text: 'Aucune tâche enregistrée.', font: 'Arial', size: 22, color: '9CA3AF', italics: true })] })]
          : [
              new Table({
                width: { size: 9026, type: WidthType.DXA },
                columnWidths: [3600, 1400, 1400, 1313, 1313],
                rows: [
                  new TableRow({
                    children: [
                      cell('Titre', true, 'EFF6FF', 3600),
                      cell('Statut', true, 'EFF6FF', 1400),
                      cell('Priorité', true, 'EFF6FF', 1400),
                      cell('Échéance', true, 'EFF6FF', 1313),
                      cell('Assigné à', true, 'EFF6FF', 1313),
                    ],
                  }),
                  ...taskList.map((t: any) => {
                    const assignee = memberList.find((m: any) => m.id === t.assigned_to)
                    const isOverdue = t.due_date && t.status !== 'done' && new Date(t.due_date) < now
                    return new TableRow({
                      children: [
                        cell(t.title ?? '—', false, 'FFFFFF', 3600),
                        cell(STATUS_FR[t.status] ?? t.status ?? '—', false, t.status === 'done' ? 'F0FDF4' : 'FFFFFF', 1400),
                        cell(PRIORITY_FR[t.priority] ?? t.priority ?? '—', false, t.priority === 'urgent' ? 'FEF2F2' : 'FFFFFF', 1400),
                        cell(t.due_date ? formatDate(t.due_date) : '—', false, isOverdue ? 'FEF2F2' : 'FFFFFF', 1313),
                        cell(assignee?.full_name ?? '—', false, 'FFFFFF', 1313),
                      ],
                    })
                  }),
                ],
              }),
            ]
        ),

        // ── Équipe ───────────────────────────────────────────────────────────
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 360 },
          children: [new TextRun({ text: `Équipe (${memberList.length} membre${memberList.length > 1 ? 's' : ''})`, font: 'Arial', size: 28, bold: true, color: '2563EB' })],
        }),

        ...(memberList.length === 0
          ? [new Paragraph({ children: [new TextRun({ text: 'Aucun membre dans l\'équipe.', font: 'Arial', size: 22, color: '9CA3AF', italics: true })] })]
          : memberList.map((m: any) =>
              new Paragraph({
                numbering: { reference: 'bullets', level: 0 },
                spacing: { after: 60 },
                children: [new TextRun({ text: m.full_name ?? '—', font: 'Arial', size: 22 })],
              })
            )
        ),

        // ── Alertes ──────────────────────────────────────────────────────────
        ...(overdue > 0 ? [
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 360 },
            children: [new TextRun({ text: '⚠ Alertes', font: 'Arial', size: 28, bold: true, color: 'DC2626' })],
          }),
          new Paragraph({
            children: [new TextRun({
              text: `${overdue} tâche${overdue > 1 ? 's' : ''} en retard. Vérifier les priorités et redistribuer si nécessaire.`,
              font: 'Arial', size: 22, color: 'DC2626',
            })],
          }),
        ] : []),
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const filename = `rapport-${(project.title ?? 'projet').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${now.toISOString().slice(0, 10)}.docx`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
