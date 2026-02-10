import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'
import * as speakeasy from 'speakeasy'

const disable2FASchema = z.object({
  token: z.string().min(6, 'Verification code must be 6 digits'),
  password: z.string().min(1, 'Please enter current password')
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

    // Get user info
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
        { error: 'Two-factor authentication not enabled' },
        { status: 400 }
      )
    }

    // Verify password
    const { verifyPassword } = await import('@/lib/auth')
    const isPasswordValid = await verifyPassword(password, userRecord.passwordHash)
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Password incorrect' },
        { status: 400 }
      )
    }

    // Verify 2FA token
    if (!userRecord.twoFactorSecret) {
      return NextResponse.json(
        { error: '2FA secret does not exist' },
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
        { error: 'Verification code invalid' },
        { status: 400 }
      )
    }

    // Disable 2FA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null
      }
    })

    // Record 2FA disabled event
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown'
    await SiemLogger.logSecurityAlert(user.id, '2FA_DISABLED', {
      message: 'Two-factor authentication disabled',
      ipAddress: clientIP
    })

    return NextResponse.json({
      successful: true,
      message: 'Two-factor authentication disabled successfulfully'
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
