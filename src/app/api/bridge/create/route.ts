import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'

const bridgeSchema = z.object({
  fromChain: z.string().min(1, '请选择源链'),
  toChain: z.string().min(1, '请选择目标链'),
  amount: z.string().min(1, '请输入金额'),
  tokenSymbol: z.string().min(1, '请选择代币'),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, '请输入有效的地址')
}).refine((data) => data.fromChain !== data.toChain, {
  message: "源链和目标链不能相同",
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

    // 验证金额
    const amountNum = parseFloat(amount)
    if (amountNum <= 0) {
      return NextResponse.json(
        { error: '金额必须大于0' },
        { status: 400 }
      )
    }

    // 计算费用
    const feePercentage = fromChain === 'ethereum' ? 0.003 : 0.001
    const fee = Math.max(amountNum * feePercentage, 0.001)
    const netAmount = amountNum - fee

    // 模拟桥接交易创建
    const bridgeTransaction = {
      id: crypto.randomUUID(),
      userId: user.id,
      fromChain,
      toChain,
      fromAddress: '0x' + Math.random().toString(16).substr(2, 40), // 模拟地址
      toAddress,
      amount: amount,
      tokenSymbol,
      fee: fee.toString(),
      netAmount: netAmount.toString(),
      status: 'PENDING',
      estimatedTime: getEstimatedTime(toChain),
      createdAt: new Date().toISOString()
    }

    // 这里应该保存到数据库，但由于没有BridgeTransaction表，我们使用Transaction表模拟
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
      console.log('数据库保存失败，使用模拟模式:', dbError)
    }

    // 记录SIEM日志
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

    // 模拟异步处理
    setTimeout(async () => {
      try {
        // 模拟处理完成
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
        console.log('模拟处理完成日志失败:', error)
      }
    }, 30000) // 30秒后模拟完成

    return NextResponse.json({
      success: true,
      transaction: bridgeTransaction,
      message: `桥接请求已提交，预计 ${bridgeTransaction.estimatedTime} 内完成`
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
    'ethereum': '10-15分钟',
    'bsc': '3-5分钟',
    'polygon': '2-3分钟',
    'arbitrum': '1-2分钟'
  }
  return timeMap[toChain] || '5-10分钟'
}
