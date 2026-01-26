import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    // 直接使用SQL查询
    const orders = await prisma.$queryRaw<any[]>`
      SELECT id, user_id as userId, type, amount, currency, status, bank_account as bankAccount, bank_name as bankName, created_at as createdAt
      FROM fiat_orders
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `

    return NextResponse.json({
      success: true,
      orders: orders || []
    })

  } catch (error) {
    console.error('获取订单错误:', error)
    
    // 如果表不存在，返回空数组
    return NextResponse.json({
      success: true,
      orders: []
    })
  }
}
