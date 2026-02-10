import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { encryptPrivateKey, decryptPrivateKey, createWallet } from '@/lib/wallet'
import { z } from 'zod'

const switchModeSchema = z.object({
  newType: z.enum(['CUSTODIAL', 'NON_CUSTODIAL'])
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { newType } = switchModeSchema.parse(body)
    const walletId = params.id

    // Get wallet info
    const wallet = await prisma.wallet.findFirst({
      where: { 
        id: walletId,
        userId: user.id 
      }
    })

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      )
    }

    if (wallet.type === newType) {
      return NextResponse.json(
        { error: 'Wallet is already in this mode' },
        { status: 400 }
      )
    }

    let updateData: any = {
      type: newType
    }

    if (newType === 'CUSTODIAL') {
      // Switch to custodial mode - need to encrypt and store private key
      if (!wallet.privateKeyEncrypted) {
        // If no private key, generate new one (shouldn't happen, but as safety measure)
        const newWalletData = createWallet()
        updateData.privateKeyEncrypted = encryptPrivateKey(newWalletData.privateKey)
      }
      // If already has encrypted private key, keep unchanged
    } else {
      // Switch to non-custodial mode - clear stored private key
      updateData.privateKeyEncrypted = null
    }

    // Update wallet
    const updatedWallet = await prisma.wallet.update({
      where: { id: walletId },
      data: updateData
    })

    // Record SIEM log
    await SiemLogger.logEvent({
      userId: user.id,
      eventType: 'SECURITY_ALERT',
      details: {
        action: 'WALLET_MODE_SWITCH',
        walletId: walletId,
        walletAddress: wallet.address,
        fromType: wallet.type,
        toType: newType,
        timestamp: new Date().toISOString()
      },
      riskLevel: 'HIGH',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    const response: any = {
      successful: true,
      wallet: {
        id: updatedWallet.id,
        address: updatedWallet.address,
        type: updatedWallet.type,
        createdAt: updatedWallet.createdAt
      },
      message: `Wallet switched to ${newType === 'CUSTODIAL' ? 'custodial' : 'non-custodial'}mode`
    }

    // If switching to non-custodial mode, return private key for user backup
    if (newType === 'NON_CUSTODIAL' && wallet.privateKeyEncrypted) {
      try {
        const privateKey = decryptPrivateKey(wallet.privateKeyEncrypted)
        response.privateKey = privateKey
        response.warning = 'Please securely backup your private key! The platform will no longer store this private key.'
      } catch (error) {
        console.error('decrypting private keyfailed:', error)
        response.warning = 'Private key decryption failed, please contact customer service.'
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Switch wallet mode error:', error)
    
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
