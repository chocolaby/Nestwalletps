import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createWallet, encryptPrivateKey, getEthBalance } from '@/lib/wallet'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'

const createWalletSchema = z.object({
  type: z.enum(['CUSTODIAL', 'NON_CUSTODIAL']),
  privateKey: z.string().optional(), // For private key import
  mnemonic: z.string().optional() // For mnemonic import
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
    const { type, privateKey: importedPrivateKey, mnemonic: importedMnemonic } = createWalletSchema.parse(body)

    let walletData
    let privateKeyToStore: string | null = null

    if (importedMnemonic) {
      // Import wallet from mnemonic
      try {
        const { walletFromMnemonic } = await import('@/lib/wallet')
        const wallet = walletFromMnemonic(importedMnemonic.trim())
        walletData = {
          address: wallet.address,
          privateKey: wallet.privateKey,
          mnemonic: importedMnemonic.trim()
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid mnemonic, please check if 12 words are entered correctly' },
          { status: 400 }
        )
      }
    } else if (importedPrivateKey) {
      // Import wallet from private key
      try {
        const { ethers } = await import('ethers')
        const wallet = new ethers.Wallet(importedPrivateKey)
        walletData = {
          address: wallet.address,
          privateKey: importedPrivateKey,
          mnemonic: ''
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid private key format' },
          { status: 400 }
        )
      }
    } else {
      // Create new wallet
      walletData = createWallet()
    }

    // If custodial wallet, encrypt and store private key
    if (type === 'CUSTODIAL') {
      privateKeyToStore = encryptPrivateKey(walletData.privateKey)
    }

    // Check if wallet address already exists
    const existingWallet = await prisma.wallet.findUnique({
      where: { address: walletData.address }
    })

    if (existingWallet) {
      return NextResponse.json(
        { error: 'Wallet address already exists' },
        { status: 400 }
      )
    }

    // Create wallet record
    const wallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        address: walletData.address,
        type: type as any,
        privateKeyEncrypted: privateKeyToStore
      }
    })

    // Get initial ETH balance (use 0 if RPC unavailable)
    let ethBalance = '0'
    try {
      ethBalance = await getEthBalance(walletData.address)
    } catch (error) {
      console.log('Unable to get ETH balance, using default value 0')
    }

    // Create ETH balance record
    await prisma.tokenBalance.create({
      data: {
        walletId: wallet.id,
        tokenAddress: '0x0000000000000000000000000000000000000000', // ETH's special address
        tokenSymbol: 'ETH',
        tokenName: 'Ethereum',
        balance: ethBalance,
        decimals: 18
      }
    })

    // Record SIEM log
    try {
      await SiemLogger.logWalletCreated(user.id, walletData.address, type)
    } catch (error) {
      console.log('SIEM logging failed, continuing execution')
    }

    // Return wallet info (excluding private key)
    const response: any = {
      successful: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        type: wallet.type,
        createdAt: wallet.createdAt,
        balance: ethBalance
      }
    }

    // If non-custodial wallet, return private key and mnemonic for user backup
    if (type === 'NON_CUSTODIAL') {
      response.privateKey = walletData.privateKey
      response.mnemonic = walletData.mnemonic
      response.warning = 'Please securely backup your private key and mnemonic! They will not be stored on our servers.'
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Create wallet error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('Error message:', errorMessage)
    if (errorStack) {
      console.error('Error stack:', errorStack)
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}
