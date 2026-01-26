import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { mintTokens } from '@/lib/contracts'
import { z } from 'zod'

const mintSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, '合约地址格式无效'),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, '接收地址格式无效'),
  amount: z.string().min(1, '金额不能为空'),
  reason: z.string().min(1, '原因不能为空')
})

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权限' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { contractAddress, toAddress, amount, reason } = mintSchema.parse(body)

    // 验证金额
    if (parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: '金额必须大于0' },
        { status: 400 }
      )
    }

    // 获取合约信息
    const contract = await prisma.smartContract.findUnique({
      where: { address: contractAddress }
    })

    if (!contract) {
      return NextResponse.json(
        { error: '合约不存在' },
        { status: 404 }
      )
    }

    // 使用部署者私钥进行铸造
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || 
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

    // 执行合约铸造
    const mintResult = await mintTokens(
      contractAddress,
      toAddress,
      amount,
      deployerPrivateKey
    )

    // 记录交易到数据库
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        fromAddress: 'MINT',
        toAddress: toAddress,
        amount: amount,
        tokenAddress: contractAddress,
        tokenSymbol: 'NEST', // 可以从合约获取
        txHash: mintResult.txHash,
        status: 'CONFIRMED',
        gasUsed: mintResult.gasUsed,
        gasPrice: '0'
      }
    })

    // 记录SIEM日志
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
      success: true,
      message: '代币铸造成功',
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
      { error: error instanceof Error ? error.message : 'Mint失败' },
      { status: 500 }
    )
  }
}
