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
        { error: '未授权访问' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { walletId } = deleteWalletSchema.parse(body)

    // 查找钱包并验证所有权
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        balances: true
      }
    })

    if (!wallet) {
      return NextResponse.json(
        { error: '钱包不存在' },
        { status: 404 }
      )
    }

    if (wallet.userId !== user.id) {
      return NextResponse.json(
        { error: '无权限删除此钱包' },
        { status: 403 }
      )
    }

    // 检查是否有余额
    const hasBalance = wallet.balances.some(balance => 
      parseFloat(balance.balance) > 0
    )

    if (hasBalance) {
      return NextResponse.json(
        { error: '钱包仍有余额，无法删除！请先转出所有资产。' },
        { status: 400 }
      )
    }

    // 删除相关数据
    await prisma.$transaction(async (tx) => {
      // 删除余额记录
      await tx.tokenBalance.deleteMany({
        where: { walletId }
      })

      // 删除交易记录
      await tx.transaction.deleteMany({
        where: {
          OR: [
            { fromWalletId: walletId },
            { toWalletId: walletId }
          ]
        }
      })

      // 删除钱包
      await tx.wallet.delete({
        where: { id: walletId }
      })
    })

    // 记录SIEM日志
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
      console.log('SIEM日志记录失败，继续执行')
    }

    return NextResponse.json({
      success: true,
      message: '钱包删除成功'
    })

  } catch (error) {
    console.error('Delete wallet error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '参数无效', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: '服务器内部错误', 
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
