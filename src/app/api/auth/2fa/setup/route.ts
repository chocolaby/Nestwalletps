import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'
import * as speakeasy from 'speakeasy'
import * as QRCode from 'qrcode'

const setup2FASchema = z.object({
  action: z.enum(['generate', 'verify']),
  token: z.string().optional()
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
    const { action, token } = setup2FASchema.parse(body)

    if (action === 'generate') {
      // 生成2FA密钥
      const secret = speakeasy.generateSecret({
        name: `NestWallet (${user.email})`,
        issuer: 'NestWallet',
        length: 32
      })

      // 生成QR码
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!)

      // 临时存储密钥（未验证状态）
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: secret.base32,
          twoFactorEnabled: false // 还未验证
        }
      })

      return NextResponse.json({
        success: true,
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32
      })

    } else if (action === 'verify') {
      if (!token) {
        return NextResponse.json(
          { error: '请输入验证码' },
          { status: 400 }
        )
      }

      // 获取用户的临时密钥
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { twoFactorSecret: true }
      })

      if (!userRecord?.twoFactorSecret) {
        return NextResponse.json(
          { error: '请先生成2FA密钥' },
          { status: 400 }
        )
      }

      // 验证TOTP令牌
      const verified = speakeasy.totp.verify({
        secret: userRecord.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2 // 允许时间窗口误差
      })

      if (!verified) {
        return NextResponse.json(
          { error: '验证码无效' },
          { status: 400 }
        )
      }

      // 启用2FA
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true
        }
      })

      // 记录2FA启用事件
      const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
      await SiemLogger.logSecurityAlert(user.id, '2FA_ENABLED', {
        message: 'Two-factor authentication enabled',
        ipAddress: clientIP
      })

      return NextResponse.json({
        success: true,
        message: '两步验证已成功启用'
      })
    }

  } catch (error) {
    console.error('2FA setup error:', error)
    
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
