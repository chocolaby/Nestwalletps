import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { simulateBankTransfer, validateBankCard, getBankInfo } from '@/lib/bank'
import { z } from 'zod'

const depositSchema = z.object({
  amount: z.string().min(1),
  currency: z.string().default('CNY'),
  paymentMethod: z.enum(['BANK_CARD', 'ALIPAY', 'WECHAT']),
  bankAccount: z.string().optional(),
  bankName: z.string().optional(),
  accountHolder: z.string().optional()
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
    const { amount, currency, paymentMethod, bankAccount, bankName, accountHolder } = depositSchema.parse(body)

    // 验证金额
    const amountNum = parseFloat(amount)
    if (amountNum <= 0 || amountNum < 100) {
      return NextResponse.json(
        { error: '最低充值金额为100元' },
        { status: 400 }
      )
    }

    // 验证银行卡号（如果是银行卡支付）
    if (paymentMethod === 'BANK_CARD' && bankAccount) {
      if (!validateBankCard(bankAccount)) {
        return NextResponse.json(
          { error: '银行卡号格式无效' },
          { status: 400 }
        )
      }
    }

    // 创建充值订单
    const fiatOrder = await prisma.fiatOrder.create({
      data: {
        userId: user.id,
        type: 'DEPOSIT',
        amount: amount,
        currency: currency,
        status: 'PENDING',
        paymentMethod: paymentMethod,
        bankAccount: bankAccount || null,
        bankName: bankName || null,
        accountHolder: accountHolder || null
      }
    })

    // 模拟银行处理
    let processingResult = null
    if (paymentMethod === 'BANK_CARD' && bankAccount) {
      const bankInfo = getBankInfo(bankAccount)
      processingResult = await simulateBankTransfer({
        fromAccount: bankAccount,
        toAccount: '6222021234567890', // 平台收款账户
        amount: amountNum,
        currency: currency,
        reference: `DEPOSIT_${fiatOrder.id}`
      })
    }

    // 记录SIEM日志
    await SiemLogger.logEvent({
      userId: user.id,
      eventType: 'ADMIN_ACTION',
      details: {
        action: 'FIAT_DEPOSIT_REQUEST',
        orderId: fiatOrder.id,
        amount: amountNum,
        currency,
        paymentMethod,
        bankInfo: bankAccount ? getBankInfo(bankAccount) : null,
        processingResult: processingResult?.transactionId
      },
      riskLevel: amountNum > 10000 ? 'MEDIUM' : 'LOW',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: '充值申请已提交',
      order: {
        id: fiatOrder.id,
        amount: fiatOrder.amount,
        currency: fiatOrder.currency,
        status: fiatOrder.status,
        paymentMethod: fiatOrder.paymentMethod,
        createdAt: fiatOrder.createdAt,
        processingInfo: processingResult ? {
          transactionId: processingResult.transactionId,
          estimatedTime: processingResult.estimatedTime,
          fee: processingResult.fee
        } : null
      }
    })

  } catch (error) {
    console.error('Deposit request error:', error)
    
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
