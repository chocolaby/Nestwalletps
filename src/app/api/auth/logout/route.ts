import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { SiemLogger } from '@/lib/siem'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (user) {
      // Record logout event
      const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      const userAgent = request.headers.get('user-agent') || 'unknown'
      
      await SiemLogger.logEvent({
        userId: user.id,
        eventType: 'LOGOUT',
        details: { timestamp: new Date().toISOString() },
        riskLevel: 'LOW',
        ipAddress: clientIP,
        userAgent
      })
    }

    // Clear auth Cookie
    const response = NextResponse.json({ successful: true })
    
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0 // Expire immediately
    })

    return response

  } catch (error) {
    console.error('Logout error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
