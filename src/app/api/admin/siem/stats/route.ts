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

    const [totalEvents, lowRisk, mediumRisk, highRisk] = await Promise.all([
      prisma.siemEvent.count(),
      prisma.siemEvent.count({ where: { riskLevel: 'LOW' } }),
      prisma.siemEvent.count({ where: { riskLevel: 'MEDIUM' } }),
      prisma.siemEvent.count({ where: { riskLevel: { in: ['HIGH', 'CRITICAL'] } } })
    ])

    return NextResponse.json({
      success: true,
      stats: {
        totalEvents,
        lowRisk,
        mediumRisk,
        highRisk
      }
    })

  } catch (error) {
    console.error('获取SIEM统计错误:', error)
    
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
