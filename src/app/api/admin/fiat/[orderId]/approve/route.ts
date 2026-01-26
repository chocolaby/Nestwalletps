import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/siem'

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    // 检查管理员权限
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      )
    }

    const { orderId } = params
    const body = await request.json()
    const { action, note } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: '无效的操作类型' },
        { status: 400 }
      )
    }

    // 查询订单
    const orders = await prisma.$queryRaw<any[]>`
      SELECT * FROM fiat_orders WHERE id = ${orderId}
    `

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: '订单不存在' },
        { status: 404 }
      )
    }

    const order = orders[0]

    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { error: '订单状态不允许审核' },
        { status: 400 }
      )
    }

    // 更新订单状态
    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    
    await prisma.$executeRaw`
      UPDATE fiat_orders 
      SET status = ${newStatus}, 
          processed_by = ${user.id}, 
          processed_at = datetime('now'),
          note = ${note || ''},
          updated_at = datetime('now')
      WHERE id = ${orderId}
    `

    // 记录SIEM日志
    await logEvent({
      userId: user.id,
      eventType: 'ADMIN_ACTION',
      riskLevel: 'MEDIUM',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      eventData: JSON.stringify({
        action: 'FIAT_ORDER_REVIEW',
        orderId,
        orderType: order.type,
        amount: order.amount,
        currency: order.currency,
        decision: action,
        note: note || '',
        timestamp: new Date().toISOString()
      })
    })

    // 获取更新后的订单
    const updatedOrders = await prisma.$queryRaw<any[]>`
      SELECT * FROM fiat_orders WHERE id = ${orderId}
    `
    const updatedOrder = updatedOrders[0]

    return NextResponse.json({
      success: true,
      message: `订单已${action === 'approve' ? '批准' : '拒绝'}`,
      order: {
        id: updatedOrder.id,
        type: updatedOrder.type,
        amount: updatedOrder.amount,
        currency: updatedOrder.currency,
        status: updatedOrder.status,
        processedBy: updatedOrder.processed_by,
        processedAt: updatedOrder.processed_at,
        note: updatedOrder.note
      }
    })

  } catch (error) {
    console.error('审核订单错误:', error)
    
    return NextResponse.json(
      { error: '审核失败' },
      { status: 500 }
    )
  }
}
