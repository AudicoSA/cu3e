import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

// Renamed from middleware.ts per Next 16's new `proxy` file convention.
// The helper at @/utils/supabase/middleware keeps its name for now to avoid
// churn — it's just the cookie-syncing + auth-redirect logic.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
