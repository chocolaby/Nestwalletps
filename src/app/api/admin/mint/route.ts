import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { mintTokens } from '@/lib/contracts'
import { z } from 'zod'

const mintSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid contract address format'),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid recipient address format'),
  amount: z.string().min(1, 'Amount cannot be empty'),
  reason: z.string().min(1, 'Reason cannot be empty')
})

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No permission' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { contractAddress, toAddress, amount, reason } = mintSchema.parse(body)

    // Validate amount
    if (parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Get contract info
    const contract = await prisma.smartContract.findUnique({
      where: { address: contractAddress }
    })

    if (!contract) {
      return NextResponse.json(
        { error: 'Contract does not exist' },
        { status: 404 }
      )
    }

    // Use deployer private key for minting
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || 
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

    // Execute contract minting
    const mintResult = await mintTokens(
      contractAddress,
      toAddress,
      amount,
      deployerPrivateKey
    )

    // Record transaction to database
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        fromAddress: 'MINT',
        toAddress: toAddress,
        amount: amount,
        tokenAddress: contractAddress,
        tokenSymbol: 'NEST', // Can be obtained from contract
        txHash: mintResult.txHash,
        status: 'CONFIRMED',
        gasUsed: mintResult.gasUsed,
        gasPrice: '0'
      }
    })

    // Record SIEM log
    await SiemLogger.logEvent({
      userId: user.id,
      eventType: 'ADMIN_ACTION',
      details: {
        action: 'TOKEN_MINT',
        contractAddress,
        toAddress,
        amount,
        reason,
        txHash: mintResult.txHash,
        timestamp: new Date().toISOString()
      },
      riskLevel: 'HIGH',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      successful: true,
      message: 'Token minted successfulfully',
      transaction: {
        id: transaction.id,
        txHash: mintResult.txHash,
        toAddress,
        amount,
        contractAddress
      }
    })

  } catch (error) {
    console.error('Token mint error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mint failed' },
      { status: 500 }
    )
  }
}
