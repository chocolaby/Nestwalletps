import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No permission' },
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
      successful: true,
      stats: {
        totalEvents,
        lowRisk,
        mediumRisk,
        highRisk
      }
    })

  } catch (error) {
    console.error('Get SIEM stats error:', error)
    
    return NextResponse.json(
      { error: 'Failed to get data' },
      { status: 500 }
    )
  }
}
