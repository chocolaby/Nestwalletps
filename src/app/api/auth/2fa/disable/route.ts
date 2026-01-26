import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'
import * as speakeasy from 'speakeasy'

const disable2FASchema = z.object({
  token: z.string().min(6, '验证码必须是6位数字'),
  password: z.string().min(1, '请输入当前密码')
})

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { token, password } = disable2FASchema.parse(body)

    // 获取用户信息
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        passwordHash: true, 
        twoFactorSecret: true, 
        twoFactorEnabled: true 
      }
    })

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    if (!userRecord.twoFactorEnabled) {
      return NextResponse.json(
        { error: '两步验证未启用' },
        { status: 400 }
      )
    }

    // 验证密码
    const { verifyPassword } = await import('@/lib/auth')
    const isPasswordValid = await verifyPassword(password, userRecord.passwordHash)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '密码不正确' },
        { status: 400 }
      )
    }

    // 验证2FA令牌
    if (!userRecord.twoFactorSecret) {
      return NextResponse.json(
        { error: '2FA密钥不存在' },
        { status: 400 }
      )
    }

    const verified = speakeasy.totp.verify({
      secret: userRecord.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2
    })

    if (!verified) {
      return NextResponse.json(
        { error: '验证码无效' },
        { status: 400 }
      )
    }

    // 禁用2FA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null
      }
    })

    // 记录2FA禁用事件
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    await SiemLogger.logSecurityAlert(user.id, '2FA_DISABLED', {
      message: 'Two-factor authentication disabled',
      ipAddress: clientIP
    })

    return NextResponse.json({
      success: true,
      message: '两步验证已成功禁用'
    })

  } catch (error) {
    console.error('2FA disable error:', error)
    
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
