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
      success: true,
      records: records.map(r => ({
        id: r.id,
        toAddress: r.toAddress,
        amount: r.amount,
        tokenSymbol: r.tokenSymbol,
        reason: 'Mint操作',
        txHash: r.txHash,
        createdBy: r.userId,
        createdAt: r.createdAt
      }))
    })

  } catch (error) {
    console.error('获取Mint历史错误:', error)
    
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
