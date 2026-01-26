import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { simulateBankTransfer, validateBankCard } from '@/lib/bank'
import { z } from 'zod'

const withdrawSchema = z.object({
  amount: z.number().min(100, '最低提现金额为100元'),
  currency: z.string().min(1, '请选择货币类型'),
  paymentMethod: z.enum(['BANK_CARD', 'ALIPAY', 'WECHAT']),
  bankAccount: z.string().min(1, '请输入银行卡号'),
  bankName: z.string().optional(),
  accountHolder: z.string().min(1, '请输入持卡人姓名')
})

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = withdrawSchema.parse(body)
    
    const { amount, currency, paymentMethod, bankAccount, bankName, accountHolder } = validatedData

    // 验证银行卡
    if (paymentMethod === 'BANK_CARD') {
      const isValidCard = validateBankCard(bankAccount)
      if (!isValidCard) {
        return NextResponse.json(
          { error: '银行卡号格式不正确（需要16-19位数字）' },
          { status: 400 }
        )
      }
    }

    // 使用Prisma创建提现订单
    const fiatOrder = await prisma.fiatOrder.create({
      data: {
        userId: user.id,
        type: 'WITHDRAW',
        amount: amount.toString(),
        currency: currency,
        status: 'PENDING',
        paymentMethod: paymentMethod,
        bankAccount: bankAccount,
        bankName: bankName || null,
        accountHolder: accountHolder
      }
    })

    // 模拟银行转账处理
    const transferResult = await simulateBankTransfer({
      fromAccount: 'NESTWALLET_MAIN',
      toAccount: bankAccount,
      amount,
      currency,
      reference: fiatOrder.id,
      memo: `提现到${paymentMethod}`
    })

    // 更新订单状态
    const finalStatus = transferResult.status === 'SUCCESS' ? 'COMPLETED' : 
                       transferResult.status === 'PENDING' ? 'PROCESSING' : 'FAILED'
    
    await prisma.fiatOrder.update({
      where: { id: fiatOrder.id },
      data: { 
        status: finalStatus,
        note: `处理费: ${transferResult.fee}, 交易ID: ${transferResult.transactionId}`
      }
    })

    // 记录SIEM日志
    try {
      await SiemLogger.logEvent({
        userId: user.id,
        eventType: 'ADMIN_ACTION',
        details: {
          action: 'FIAT_WITHDRAW_REQUEST',
          orderId: fiatOrder.id,
          amount,
          currency,
          paymentMethod,
          bankAccount: bankAccount.slice(-4),
          status: transferResult.status,
          fee: transferResult.fee,
          transactionId: transferResult.transactionId
        },
        riskLevel: amount > 10000 ? 'MEDIUM' : 'LOW',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })
    } catch (logError) {
      console.error('SIEM日志记录失败:', logError)
    }

    const isSuccess = transferResult.status === 'SUCCESS' || transferResult.status === 'PENDING'
    
    return NextResponse.json({
      success: true,
      message: isSuccess ? 
        `提现申请已提交，预计处理时间: ${transferResult.estimatedTime}` : 
        `提现失败: ${transferResult.message}`,
      order: {
        id: fiatOrder.id,
        amount,
        currency,
        status: finalStatus,
        paymentMethod,
        fee: transferResult.fee,
        estimatedTime: transferResult.estimatedTime,
        transactionId: transferResult.transactionId,
        createdAt: fiatOrder.createdAt
      }
    })

  } catch (error) {
    console.error('提现申请错误:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '输入验证失败', details: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: '申请失败，请稍后重试' },
      { status: 500 }
    )
  }
}
