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
        { error: '无权限' },
        { status: 403 }
      )
    }

    const targetUserId = params.id

    // 检查目标用户是否存在
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      )
    }

    if (!targetUser.isFrozen) {
      return NextResponse.json(
        { error: '用户未被冻结' },
        { status: 400 }
      )
    }

    // 解冻用户账户
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isFrozen: false,
        frozenReason: null,
        frozenAt: null,
        frozenBy: null
      }
    })

    // 记录SIEM日志
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
      success: true,
      message: '账户已解冻'
    })

  } catch (error) {
    console.error('解冻账户错误:', error)
    
    return NextResponse.json(
      { error: '操作失败' },
      { status: 500 }
    )
  }
}
