import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/siem'
import { z } from 'zod'

const deleteWalletSchema = z.object({
  walletId: z.string().uuid()
})

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { walletId } = deleteWalletSchema.parse(body)

    // Find wallet and verify ownership
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        balances: true
      }
    })

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      )
    }

    if (wallet.userId !== user.id) {
      return NextResponse.json(
        { error: 'No permission to delete this wallet' },
        { status: 403 }
      )
    }

    // Check if has balance
    const hasBalance = wallet.balances.some(balance => 
      parseFloat(balance.balance) > 0
    )

    if (hasBalance) {
      return NextResponse.json(
        { error: 'Wallet still has balance, cannot be deleted! Please transfer all assets first.' },
        { status: 400 }
      )
    }

    // Delete related data
    await prisma.$transaction(async (tx) => {
      // Delete balance records
      await tx.tokenBalance.deleteMany({
        where: { walletId }
      })

      // Delete transaction records
      await tx.transaction.deleteMany({
        where: {
          OR: [
            { fromWalletId: walletId },
            { toWalletId: walletId }
          ]
        }
      })

      // Delete wallet
      await tx.wallet.delete({
        where: { id: walletId }
      })
    })

    // Record SIEM log
    try {
      await logEvent({
        eventType: 'WALLET_DELETED',
        riskLevel: 'MEDIUM',
        userId: user.id,
        eventData: JSON.stringify({
          walletId,
          walletAddress: wallet.address,
          walletType: wallet.type
        }),
        ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown'
      })
    } catch (error) {
      console.log('SIEM logging failed, continuing execution')
    }

    return NextResponse.json({
      successful: true,
      message: 'Wallet deleted successfully'
    })

  } catch (error) {
    console.error('Delete wallet error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
