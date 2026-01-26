import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateToken } from '@/lib/auth'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['USER', 'ADMIN', 'COMPLIANCE']).optional().default('USER')
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, role } = registerSchema.parse(body)

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      )
    }

    // 创建新用户
    const hashedPassword = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        role: role as any
      },
      select: {
        id: true,
        email: true,
        role: true,
        kycStatus: true,
        createdAt: true
      }
    })

    // 生成JWT令牌
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    })

    // 记录SIEM日志
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    await SiemLogger.logEvent({
      userId: user.id,
      eventType: 'LOGIN',
      details: { action: 'register', success: true },
      riskLevel: 'LOW',
      ipAddress: clientIP,
      userAgent
    })

    // 设置Cookie
    const response = NextResponse.json({
      success: true,
      user
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })

    return response

  } catch (error) {
    console.error('Registration error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
