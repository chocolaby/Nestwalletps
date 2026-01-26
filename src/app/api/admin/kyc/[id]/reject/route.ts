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

    const body = await request.json()
    const { reason } = body
    const docId = params.id

    // 更新文档状态
    const document = await prisma.kycDocument.update({
      where: { id: docId },
      data: {
        status: 'REJECTED'
      }
    })

    // 更新用户KYC状态
    await prisma.user.update({
      where: { id: document.userId },
      data: {
        kycStatus: 'REJECTED'
      }
    })

    // 记录SIEM日志
    await logEvent({
      userId: document.userId,
      eventType: 'KYC_REJECTED',
      riskLevel: 'MEDIUM',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      eventData: JSON.stringify({
        documentId: docId,
        rejectedBy: user.id,
        reason,
        timestamp: new Date().toISOString()
      })
    })

    return NextResponse.json({
      success: true,
      document
    })

  } catch (error) {
    console.error('拒绝KYC错误:', error)
    
    return NextResponse.json(
      { error: '拒绝失败' },
      { status: 500 }
    )
  }
}
