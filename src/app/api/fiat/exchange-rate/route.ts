import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { SiemLogger } from '@/lib/siem'

// Mock exchange rates
const EXCHANGE_RATES = {
  'CNY/USD': 0.14,
  'USD/CNY': 7.14,
  'CNY/NEST': 0.001,
  'NEST/CNY': 1000,
  'USD/NEST': 0.007,
  'NEST/USD': 142.86,
  'ETH/USD': 2500,
  'ETH/CNY': 17850,
  'NEST/ETH': 0.00006
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const pair = searchParams.get('pair')

    // Log SIEM event
    await SiemLogger.logEvent({
      userId: user.id,
      eventType: 'ADMIN_ACTION',
      details: {
        action: 'EXCHANGE_RATE_QUERY',
        pair: pair || 'all',
        timestamp: new Date().toISOString()
      },
      riskLevel: 'LOW',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    if (pair) {
      const rate = EXCHANGE_RATES[pair as keyof typeof EXCHANGE_RATES]
      if (!rate) {
        return NextResponse.json(
          { error: '不支持的货币对' },
          { status: 400 }
        )
      }

      return NextResponse.json({
        success: true,
        pair,
        rate,
        timestamp: new Date().toISOString()
      })
    }

    // Return all rates
    return NextResponse.json({
      success: true,
      rates: EXCHANGE_RATES,
      timestamp: new Date().toISOString(),
      note: 'Mock exchange rates for demo purposes'
    })

  } catch (error) {
    console.error('Exchange rate error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
