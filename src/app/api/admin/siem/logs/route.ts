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
      successful: true,
      logs
    })

  } catch (error) {
    console.error('Get SIEM logs error:', error)
    
    return NextResponse.json(
      { error: 'Failed to get data' },
      { status: 500 }
    )
  }
}
