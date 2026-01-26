import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createWallet, encryptPrivateKey, getEthBalance } from '@/lib/wallet'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'

const createWalletSchema = z.object({
  type: z.enum(['CUSTODIAL', 'NON_CUSTODIAL']),
  privateKey: z.string().optional(), // 用于私钥导入
  mnemonic: z.string().optional() // 用于助记词导入
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
      // 从助记词导入钱包
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
          { error: '无效的助记词，请检查是否正确输入12个单词' },
          { status: 400 }
        )
      }
    } else if (importedPrivateKey) {
      // 从私钥导入钱包
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
          { error: '无效的私钥格式' },
          { status: 400 }
        )
      }
    } else {
      // 创建新钱包
      walletData = createWallet()
    }

    // 如果是托管钱包，加密并存储私钥
    if (type === 'CUSTODIAL') {
      privateKeyToStore = encryptPrivateKey(walletData.privateKey)
    }

    // 检查钱包地址是否已存在
    const existingWallet = await prisma.wallet.findUnique({
      where: { address: walletData.address }
    })

    if (existingWallet) {
      return NextResponse.json(
        { error: 'Wallet address already exists' },
        { status: 400 }
      )
    }

    // 创建钱包记录
    const wallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        address: walletData.address,
        type: type as any,
        privateKeyEncrypted: privateKeyToStore
      }
    })

    // 获取初始ETH余额（如果RPC不可用，使用0）
    let ethBalance = '0'
    try {
      ethBalance = await getEthBalance(walletData.address)
    } catch (error) {
      console.log('无法获取ETH余额，使用默认值0')
    }

    // 创建ETH余额记录
    await prisma.tokenBalance.create({
      data: {
        walletId: wallet.id,
        tokenAddress: '0x0000000000000000000000000000000000000000', // ETH的特殊地址
        tokenSymbol: 'ETH',
        tokenName: 'Ethereum',
        balance: ethBalance,
        decimals: 18
      }
    })

    // 记录SIEM日志
    try {
      await SiemLogger.logWalletCreated(user.id, walletData.address, type)
    } catch (error) {
      console.log('SIEM日志记录失败，继续执行')
    }

    // 返回钱包信息（不包含私钥）
    const response: any = {
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.address,
        type: wallet.type,
        createdAt: wallet.createdAt,
        balance: ethBalance
      }
    }

    // 如果是非托管钱包，返回私钥和助记词供用户备份
    if (type === 'NON_CUSTODIAL') {
      response.privateKey = walletData.privateKey
      response.mnemonic = walletData.mnemonic
      response.warning = '请务必安全备份您的私钥和助记词！它们不会存储在我们的服务器上。'
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
