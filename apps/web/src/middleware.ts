import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Role-based access control
    if (path.startsWith('/admin') && path !== '/admin/login' && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    if (path.startsWith('/doctor') && token?.role !== 'DOCTOR') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    if (path.startsWith('/reception') && token?.role !== 'RECEPTIONIST') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    if (path.startsWith('/triage') && token?.role !== 'NURSE') {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    if (path === '/analytics' && !['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'].includes(String(token?.role))) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    if (path.startsWith('/messages') && !['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'].includes(String(token?.role))) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    if (path.startsWith('/medical-records') && !['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'].includes(String(token?.role))) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    if (path.startsWith('/patient-registry') && !['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'].includes(String(token?.role))) {
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    return NextResponse.next();
  },
  {
    pages: {
      signIn: '/',
    },
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Public routes
        if (
          path === '/' ||
          path === '/login' ||
          path === '/admin/login' ||
          path === '/admin-login' ||
          path === '/patient' ||
          path === '/patients' ||
          path === '/queue-tv' ||
          path.startsWith('/api/auth')
        ) {
          return true;
        }

        // Protected routes require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/admin/:path*',
    '/doctor/:path*',
    '/reception/:path*',
    '/triage/:path*',
    '/analytics',
    '/messages/:path*',
    '/medical-records/:path*',
  ],
};
