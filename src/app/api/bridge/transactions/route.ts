import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

// Simulated bridge transaction data
const mockBridgeTransactions = [
  {
    id: '1',
    fromChain: 'ethereum',
    toChain: 'bsc',
    fromAddress: '0x1234567890123456789012345678901234567890',
    toAddress: '0x0987654321098765432109876543210987654321',
    amount: '100.0',
    tokenSymbol: 'USDT',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    estimatedTime: '3-5 minutes',
    fee: '0.1'
  },
  {
    id: '2',
    fromChain: 'bsc',
    toChain: 'polygon',
    fromAddress: '0x1111111111111111111111111111111111111111',
    toAddress: '0x2222222222222222222222222222222222222222',
    amount: '50.0',
    tokenSymbol: 'USDC',
    status: 'PROCESSING',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    estimatedTime: '2-3 minutes',
    fee: '0.05'
  },
  {
    id: '3',
    fromChain: 'polygon',
    toChain: 'arbitrum',
    fromAddress: '0x3333333333333333333333333333333333333333',
    toAddress: '0x4444444444444444444444444444444444444444',
    amount: '25.0',
    tokenSymbol: 'ETH',
    status: 'FAILED',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    estimatedTime: '1-2 minutes',
    fee: '0.025'
  }
]

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // In real application, should query user's bridge transactions from database
    // Now return simulated data
    const userTransactions = mockBridgeTransactions.map(tx => ({
      ...tx,
      // Simulate user ID matching
      userId: user.id
    }))

    return NextResponse.json({
      successful: true,
      transactions: userTransactions
    })

  } catch (error) {
    console.error('Get bridge transactions error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
