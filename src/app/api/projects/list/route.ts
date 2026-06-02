import { requireAuth } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

export async function GET() {
  const result = await requireAuth()
  if ('error' in result) return result.error
  const { admin } = result

  const { data } = await admin
    .from('projects')
    .select('id, title, code, program_id')
    .is('deleted_at', null)
    .order('title')
  return NextResponse.json(data ?? [])
}
