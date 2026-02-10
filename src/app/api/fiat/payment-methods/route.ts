import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getPaymentMethods } from '@/lib/bank'
import { SiemLogger } from '@/lib/siem'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    // Get payment methods from bank module
    const paymentMethods = getPaymentMethods()

    // Log SIEM event
    await SiemLogger.logEvent({
      userId: user.id,
      eventType: 'ADMIN_ACTION',
      details: {
        action: 'PAYMENT_METHODS_QUERY',
        count: paymentMethods.length,
        timestamp: new Date().toISOString()
      },
      riskLevel: 'LOW',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      paymentMethods: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        name: pm.name,
        identifier: pm.identifier,
        isDefault: pm.isDefault
      })),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Payment methods error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
