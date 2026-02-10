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
      // Generate 2FA secret
      const secret = speakeasy.generateSecret({
        name: `NestWallet (${user.email})`,
        issuer: 'NestWallet',
        length: 32
      })

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!)

      // Temporarily store secret (unverified state)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: secret.base32,
          twoFactorEnabled: false // Not yet verified
        }
      })

      return NextResponse.json({
        successful: true,
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32
      })

    } else if (action === 'verify') {
      if (!token) {
        return NextResponse.json(
          { error: 'Please enter verification code' },
          { status: 400 }
        )
      }

      // Get user's temporary secret
      const userRecord = await prisma.user.findUnique({
        where: { id: user.id },
        select: { twoFactorSecret: true }
      })

      if (!userRecord?.twoFactorSecret) {
        return NextResponse.json(
          { error: 'Please generate 2FA secret first' },
          { status: 400 }
        )
      }

      // Verify TOTP token
      const verified = speakeasy.totp.verify({
        secret: userRecord.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow time window error
      })

      if (!verified) {
        return NextResponse.json(
          { error: 'Verification code invalid' },
          { status: 400 }
        )
      }

      // Enable 2FA
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true
        }
      })

      // Record 2FA enabled event
      const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
      await SiemLogger.logSecurityAlert(user.id, '2FA_ENABLED', {
        message: 'Two-factor authentication enabled',
        ipAddress: clientIP
      })

      return NextResponse.json({
        successful: true,
        message: 'Two-factor authentication enabled successfulfully'
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
