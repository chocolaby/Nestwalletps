import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// 需要认证的路径
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

// 需要管理员权限的路径
const adminPaths = [
  '/admin'
]

// API路径需要特殊处理
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
  
  // 跳过静态资源和公共API
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

  // 检查是否需要认证
  const needsAuth = protectedPaths.some(path => pathname.startsWith(path)) ||
                   protectedApiPaths.some(path => pathname.startsWith(path))

  if (!needsAuth) {
    return NextResponse.next()
  }

  // 获取认证token
  const token = request.cookies.get('auth-token')?.value
  
  console.log('🔐 Middleware检查:', {
    path: pathname,
    hasToken: !!token,
    tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
  })

  if (!token) {
    console.log('❌ 没有token，重定向到登录页')
    // 如果是API请求，返回401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // 如果是页面请求，重定向到登录页
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
  
  console.log('✅ Token存在，继续验证...')

  try {
    // 验证JWT token (使用jose支持edge runtime)
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'nest-wallet-jwt-secret-key-2024'
    )
    const { payload } = await jwtVerify(token, secret)
    
    console.log('🔍 Token验证结果:', {
      payload,
      hasPayload: !!payload,
      hasUserId: payload?.userId ? true : false
    })
    
    if (!payload || !payload.userId) {
      console.error('❌ Payload无效:', payload)
      throw new Error('Invalid token payload')
    }
    
    console.log('✅ Token验证成功:', { userId: payload.userId, role: payload.role })

    // 检查管理员权限
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

    // 添加用户信息到请求头
    const response = NextResponse.next()
    response.headers.set('x-user-id', payload.userId as string)
    response.headers.set('x-user-email', (payload.email as string) || '')
    response.headers.set('x-user-role', userRole || 'USER')

    return response

  } catch (error) {
    console.error('Token verification failed:', error)
    
    // 清除无效token
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
