import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权限' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const eventType = searchParams.get('eventType')
    const riskLevel = searchParams.get('riskLevel')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: any = {}
    if (eventType && eventType !== 'all') {
      where.eventType = eventType
    }
    if (riskLevel && riskLevel !== 'all') {
      where.riskLevel = riskLevel
    }

    const logs = await prisma.siemEvent.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    })

    return NextResponse.json({
      success: true,
      logs
    })

  } catch (error) {
    console.error('获取SIEM日志错误:', error)
    
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
