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
        { error: '无权限' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { reason } = body
    const targetUserId = params.id

    if (!reason) {
      return NextResponse.json(
        { error: '请提供冻结原因' },
        { status: 400 }
      )
    }

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

    if (targetUser.isFrozen) {
      return NextResponse.json(
        { error: '用户已被冻结' },
        { status: 400 }
      )
    }

    // 冻结用户账户
    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isFrozen: true,
        frozenReason: reason,
        frozenAt: new Date(),
        frozenBy: user.id
      }
    })

    // 记录SIEM日志
    await SiemLogger.logSecurityAlert(targetUserId, 'ACCOUNT_FREEZE', {
      frozenBy: user.id,
      frozenByEmail: user.email,
      reason,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: '账户已冻结'
    })

  } catch (error) {
    console.error('冻结账户错误:', error)
    
    return NextResponse.json(
      { error: '操作失败' },
      { status: 500 }
    )
  }
}
