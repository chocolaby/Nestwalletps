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
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin permission
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin permission required' },
        { status: 403 }
      )
    }

    const { orderId } = params
    const body = await request.json()
    const { action, note } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid operation type' },
        { status: 400 }
      )
    }

    // Query order
    const orders = await prisma.$queryRaw<any[]>`
      SELECT * FROM fiat_orders WHERE id = ${orderId}
    `

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: 'Order does not exist' },
        { status: 404 }
      )
    }

    const order = orders[0]

    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Order status does not allow review' },
        { status: 400 }
      )
    }

    // Update order status
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

    // Record SIEM log
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

    // Get updated order
    const updatedOrders = await prisma.$queryRaw<any[]>`
      SELECT * FROM fiat_orders WHERE id = ${orderId}
    `
    const updatedOrder = updatedOrders[0]

    return NextResponse.json({
      successful: true,
      message: `Order ${action === 'approve' ? 'approved' : 'rejected'}`,
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
    console.error('Review order error:', error)
    
    return NextResponse.json(
      { error: 'Review failed' },
      { status: 500 }
    )
  }
}
