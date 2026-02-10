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

    const [totalUsers, totalWallets, totalTransactions, pendingKyc] = await Promise.all([
      prisma.user.count(),
      prisma.wallet.count(),
      prisma.transaction.count(),
      prisma.kycDocument.count({
        where: { status: 'PENDING' }
      })
    ])

    return NextResponse.json({
      successful: true,
      stats: {
        totalUsers,
        totalWallets,
        totalTransactions,
        pendingKyc
      }
    })

  } catch (error) {
    console.error('Get statistics error:', error)
    
    return NextResponse.json(
      { error: 'Failed to get data' },
      { status: 500 }
    )
  }
}
