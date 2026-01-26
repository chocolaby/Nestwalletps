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

    const [totalUsers, totalWallets, totalTransactions, pendingKyc] = await Promise.all([
      prisma.user.count(),
      prisma.wallet.count(),
      prisma.transaction.count(),
      prisma.kycDocument.count({
        where: { status: 'PENDING' }
      })
    ])

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalWallets,
        totalTransactions,
        pendingKyc
      }
    })

  } catch (error) {
    console.error('获取统计数据错误:', error)
    
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
