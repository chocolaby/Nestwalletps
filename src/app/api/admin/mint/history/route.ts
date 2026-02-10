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

    const records = await prisma.transaction.findMany({
      where: {
        fromAddress: 'MINT'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    })

    return NextResponse.json({
      successful: true,
      records: records.map(r => ({
        id: r.id,
        toAddress: r.toAddress,
        amount: r.amount,
        tokenSymbol: r.tokenSymbol,
        reason: 'Mint operation',
        txHash: r.txHash,
        createdBy: r.userId,
        createdAt: r.createdAt
      }))
    })

  } catch (error) {
    console.error('Get mint history error:', error)
    
    return NextResponse.json(
      { error: 'Failed to get data' },
      { status: 500 }
    )
  }
}
