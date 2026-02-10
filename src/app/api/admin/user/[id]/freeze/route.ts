import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No permission' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { reason } = body
    const targetUserId = params.id

    if (!reason) {
      return NextResponse.json(
        { error: 'Please provide freeze reason' },
        { status: 400 }
      )
    }

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User does not exist' },
        { status: 404 }
      )
    }

    if (targetUser.isFrozen) {
      return NextResponse.json(
        { error: 'User is already frozen' },
        { status: 400 }
      )
    }

    // Freeze user account
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isFrozen: true,
        frozenReason: reason,
        frozenAt: new Date(),
        frozenBy: user.id
      }
    })

    // Record SIEM log
    await SiemLogger.logSecurityAlert(targetUserId, 'ACCOUNT_FREEZE', {
      frozenBy: user.id,
      frozenByEmail: user.email,
      reason,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      successful: true,
      message: 'Account frozen'
    })

  } catch (error) {
    console.error('Freeze account error:', error)
    
    return NextResponse.json(
      { error: 'Operation failed' },
      { status: 500 }
    )
  }
}
