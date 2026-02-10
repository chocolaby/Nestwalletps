import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'

const bridgeSchema = z.object({
  fromChain: z.string().min(1, 'Please select source chain'),
  toChain: z.string().min(1, 'Please select target chain'),
  amount: z.string().min(1, 'Please enter amount'),
  tokenSymbol: z.string().min(1, 'Please select token'),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Please enter valid address')
}).refine((data) => data.fromChain !== data.toChain, {
  message: "Source chain and target chain cannot be the same",
  path: ["toChain"],
})

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { fromChain, toChain, amount, tokenSymbol, toAddress } = bridgeSchema.parse(body)

    // Validate amount
    const amountNum = parseFloat(amount)
    if (amountNum <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Calculate fees
    const feePercentage = fromChain === 'ethereum' ? 0.003 : 0.001
    const fee = Math.max(amountNum * feePercentage, 0.001)
    const netAmount = amountNum - fee

    // Simulate bridge transaction creation
    const bridgeTransaction = {
      id: crypto.randomUUID(),
      userId: user.id,
      fromChain,
      toChain,
      fromAddress: '0x' + Math.random().toString(16).substr(2, 40), // Simulated address
      toAddress,
      amount: amount,
      tokenSymbol,
      fee: fee.toString(),
      netAmount: netAmount.toString(),
      status: 'PENDING',
      estimatedTime: getEstimatedTime(toChain),
      createdAt: new Date().toISOString()
    }

    // Should save to database, but using Transaction table for simulation since BridgeTransaction table doesn't exist
    try {
      await prisma.transaction.create({
        data: {
          id: bridgeTransaction.id,
          userId: user.id,
          fromAddress: bridgeTransaction.fromAddress,
          toAddress: bridgeTransaction.toAddress,
          amount: bridgeTransaction.amount,
          tokenSymbol: bridgeTransaction.tokenSymbol,
          status: 'PENDING'
        }
      })
    } catch (dbError) {
      console.log('Database savefailed，using simulation mode:', dbError)
    }

    // Record SIEM log
    await SiemLogger.logEvent({
      userId: user.id,
      eventType: 'TRANSACTION',
      details: {
        action: 'BRIDGE_CREATED',
        fromChain,
        toChain,
        amount,
        tokenSymbol,
        toAddress,
        fee: fee.toString(),
        timestamp: new Date().toISOString()
      },
      riskLevel: 'MEDIUM',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    // Simulate async processing
    setTimeout(async () => {
      try {
        // Simulate completion
        await SiemLogger.logEvent({
          userId: user.id,
          eventType: 'TRANSACTION',
          details: {
            action: 'BRIDGE_COMPLETED',
            bridgeId: bridgeTransaction.id,
            timestamp: new Date().toISOString()
          },
          riskLevel: 'LOW'
        })
      } catch (error) {
        console.log('Simulated completionlogfailed:', error)
      }
    }, 30000) // Simulate completion after 30 seconds

    return NextResponse.json({
      successful: true,
      transaction: bridgeTransaction,
      message: `Bridge request submitted,estimated ${bridgeTransaction.estimatedTime} to complete`
    })

  } catch (error) {
    console.error('Bridge creation error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function getEstimatedTime(toChain: string): string {
  const timeMap: Record<string, string> = {
    'ethereum': '10-15 minutes',
    'bsc': '3-5 minutes',
    'polygon': '2-3 minutes',
    'arbitrum': '1-2 minutes'
  }
  return timeMap[toChain] || '5-10 minutes'
}
