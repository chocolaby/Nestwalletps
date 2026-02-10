import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Paths that require authentication
const protectedPaths = [
  '/dashboard',
  '/wallets',
  '/transactions',
  '/settings',
  '/kyc',
  '/notifications',
  '/fiat',
  '/admin'
]

// Paths that require admin permissions
const adminPaths = [
  '/admin'
]

// API paths require special handling
const protectedApiPaths = [
  '/api/wallet',
  '/api/transaction',
  '/api/kyc',
  '/api/fiat',
  '/api/admin',
  '/api/auth/change-password',
  '/api/auth/2fa'
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Skip static resources and public APIs
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/register' ||
    pathname === '/api/auth/logout'
  ) {
    return NextResponse.next()
  }

  // Check if authentication is required
  const needsAuth = protectedPaths.some(path => pathname.startsWith(path)) ||
                   protectedApiPaths.some(path => pathname.startsWith(path))

  if (!needsAuth) {
    return NextResponse.next()
  }

  // Get authentication token
  const token = request.cookies.get('auth-token')?.value
  
  console.log('🔐 Middleware check:', {
    path: pathname,
    hasToken: !!token,
    tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
  })

  if (!token) {
    console.log('❌ No token, redirecting to login page')
    // If API request, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // If page request, redirect to login page
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  
  console.log('✅ Token exists, continuing verification...')

  try {
    // Verify JWT token (using jose to support edge runtime)
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'nest-wallet-jwt-secret-key-2024'
    )
    const { payload } = await jwtVerify(token, secret)
    
    console.log('🔍 Token verification result:', {
      payload,
      hasPayload: !!payload,
      hasUserId: payload?.userId ? true : false
    })
    
    if (!payload || !payload.userId) {
      console.error('❌ Invalid payload:', payload)
      throw new Error('Invalid token payload')
    }
    
    console.log('✅ Token verification successful:', { userId: payload.userId, role: payload.role })

    // Check admin permissions
    const needsAdmin = adminPaths.some(path => pathname.startsWith(path))
    const userRole = payload.role as string
    if (needsAdmin && userRole !== 'ADMIN') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        )
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Add user information to request headers
    const response = NextResponse.next()
    response.headers.set('x-user-id', payload.userId as string)
    response.headers.set('x-user-email', (payload.email as string) || '')
    response.headers.set('x-user-role', userRole || 'USER')

    return response

  } catch (error) {
    console.error('Token verification failed:', error)
    
    // Clear invalid token
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/auth/login', request.url))
    
    response.cookies.delete('auth-token')
    return response
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
