import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes accessibles sans authentification
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/callback',
  '/auth/invite',
  '/auth/reset-password',
]

// Routes réservées à certains rôles
const ADMIN_ONLY_ROUTES = ['/admin']
const DIRECTOR_ROUTES = ['/dashboard/global', '/programs/new']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Rafraîchir la session (obligatoire avec @supabase/ssr)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Laisser passer les routes publiques
  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
  if (isPublicRoute) return supabaseResponse

  // Laisser passer les assets statiques
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.')
  ) {
    return supabaseResponse
  }

  // Non authentifié → login
  if (!user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Vérifier le rôle pour les routes protégées
  if (
    ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r)) ||
    DIRECTOR_ROUTES.some((r) => pathname.startsWith(r))
  ) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role

    if (ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r)) && role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    if (
      DIRECTOR_ROUTES.some((r) => pathname.startsWith(r)) &&
      !['admin', 'directeur'].includes(role ?? '')
    ) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
