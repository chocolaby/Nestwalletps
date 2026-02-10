import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter current password'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm new password')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New password and confirm password do not match",
  path: ["confirmPassword"],
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
    const { currentPassword, newPassword } = changePasswordSchema.parse(body)

    // Get user's current password hash
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true }
    })

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, userRecord.passwordHash)
    if (!isCurrentPasswordValid) {
      // Record failed password change attempt
      await SiemLogger.logPasswordChangeAttempt(user.id, false, 'Invalid current password')
      
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Check if new password is same as current password
    const isSamePassword = await verifyPassword(newPassword, userRecord.passwordHash)
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'New password cannot be the same as current password' },
        { status: 400 }
      )
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        passwordHash: newPasswordHash,
        updatedAt: new Date()
      }
    })

    // Record successfulful password change
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    await SiemLogger.logPasswordChangeAttempt(user.id, true, 'Password changed successfullyly', clientIP)

    // TODO: Create notification (enable after regenerating Prisma client)
    // try {
    //   await prisma.notification.create({
    //     data: {
    //       userId: user.id,
    //       type: 'SECURITY',
    //       title: 'Password changed successfullyly',
    //       message: 'Your account password has been changed successfully. If this was not you, please contact customer service immediately.',
    //       read: false
    //     }
    //   })
    // } catch (notificationError) {
    //   console.log('Failed to create notification, but password changed successfully:', notificationError)
    // }

    return NextResponse.json({
      successful: true,
      message: 'Password changed successfullyly'
    })

  } catch (error) {
    console.error('Change password error:', error)
    
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
