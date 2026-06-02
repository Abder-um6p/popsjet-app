/**
 * DEBUG ENDPOINT — /api/debug-projects
 * ⚠️ DÉSACTIVÉ — retourne systématiquement 404 (toutes les informations utiles
 *    ont été migrées dans les outils de diagnostic internes).
 * Ce fichier peut être supprimé à la prochaine occasion.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
