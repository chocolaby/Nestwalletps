import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/siem'

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

    const targetUserId = params.id

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

    if (!targetUser.isFrozen) {
      return NextResponse.json(
        { error: 'User is not frozen' },
        { status: 400 }
      )
    }

    // Unfreeze user account
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isFrozen: false,
        frozenReason: null,
        frozenAt: null,
        frozenBy: null
      }
    })

    // Record SIEM log
    await logEvent({
      userId: targetUserId,
      eventType: 'ADMIN_ACTION',
      riskLevel: 'MEDIUM',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      eventData: JSON.stringify({
        action: 'ACCOUNT_UNFREEZE',
        unfrozenBy: user.id,
        timestamp: new Date().toISOString()
      })
    })

    return NextResponse.json({
      successful: true,
      message: 'Account unfrozen'
    })

  } catch (error) {
    console.error('Unfreeze account error:', error)
    
    return NextResponse.json(
      { error: 'Operation failed' },
      { status: 500 }
    )
  }
}
