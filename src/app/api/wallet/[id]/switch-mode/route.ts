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

    // 获取钱包信息
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
        { error: '钱包已经是该模式' },
        { status: 400 }
      )
    }

    let updateData: any = {
      type: newType
    }

    if (newType === 'CUSTODIAL') {
      // 切换到托管模式 - 需要加密存储私钥
      if (!wallet.privateKeyEncrypted) {
        // 如果没有私钥，生成新的（这种情况不应该发生，但作为安全措施）
        const newWalletData = createWallet()
        updateData.privateKeyEncrypted = encryptPrivateKey(newWalletData.privateKey)
      }
      // 如果已有加密私钥，保持不变
    } else {
      // 切换到非托管模式 - 清除存储的私钥
      updateData.privateKeyEncrypted = null
    }

    // 更新钱包
    const updatedWallet = await prisma.wallet.update({
      where: { id: walletId },
      data: updateData
    })

    // 记录SIEM日志
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
      success: true,
      wallet: {
        id: updatedWallet.id,
        address: updatedWallet.address,
        type: updatedWallet.type,
        createdAt: updatedWallet.createdAt
      },
      message: `钱包已切换到${newType === 'CUSTODIAL' ? '托管' : '非托管'}模式`
    }

    // 如果切换到非托管模式，返回私钥供用户备份
    if (newType === 'NON_CUSTODIAL' && wallet.privateKeyEncrypted) {
      try {
        const privateKey = decryptPrivateKey(wallet.privateKeyEncrypted)
        response.privateKey = privateKey
        response.warning = '请务必安全备份您的私钥！平台将不再存储此私钥。'
      } catch (error) {
        console.error('解密私钥失败:', error)
        response.warning = '私钥解密失败，请联系客服处理。'
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
