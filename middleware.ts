import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/login'];

function isPublic(pathname: string): boolean {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function isAuthRequired(pathname: string): boolean {
  if (isPublic(pathname)) return false;
  if (pathname.startsWith('/api')) return false;
  return pathname === '/' || pathname.startsWith('/employee') || pathname.startsWith('/schedule')
    || pathname.startsWith('/tasks') || pathname.startsWith('/planner-export') || pathname.startsWith('/change-password')
    || pathname.startsWith('/admin');
}

/** Paths that must never run auth logic (Next internals + static assets). */
function isNextInternalOrStatic(pathname: string): boolean {
  if (pathname.startsWith('/_next/')) return true;
  if (pathname === '/favicon.ico' || pathname === '/robots.txt' || pathname === '/sitemap.xml') return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isNextInternalOrStatic(pathname)) {
    return NextResponse.next();
  }

  const session = request.cookies.get('dt_session')?.value;

  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  if (isPublic(pathname)) {
    // Do not redirect /login -> / based on cookie alone: cookie may be stale/invalid and
    // would cause a redirect loop (app would send back to /login, middleware again to /).
    return NextResponse.next();
  }

  if (isAuthRequired(pathname) && !session) {
    const login = new URL('/login', request.url);
    login.searchParams.set('from', pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

// Only run middleware on page routes that may need auth. Never run on _next, api, or static files.
export const config = {
  matcher: [
    '/',
    '/login',
    '/employee/:path*',
    '/schedule/:path*',
    '/tasks/:path*',
    '/planner-export',
    '/change-password',
    '/admin/:path*',
    '/approvals',
    '/leaves',
    '/inventory/:path*',
    '/me/:path*',
    '/sync/:path*',
  ],
};
