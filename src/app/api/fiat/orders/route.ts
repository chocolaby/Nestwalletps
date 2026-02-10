import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use SQL query directly
    const orders = await prisma.$queryRaw<any[]>`
      SELECT id, user_id as userId, type, amount, currency, status, bank_account as bankAccount, bank_name as bankName, created_at as createdAt
      FROM fiat_orders
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `

    return NextResponse.json({
      successful: true,
      orders: orders || []
    })

  } catch (error) {
    console.error('Get orders error:', error)
    
    // If table doesn't exist, return empty array
    return NextResponse.json({
      successful: true,
      orders: []
    })
  }
}
