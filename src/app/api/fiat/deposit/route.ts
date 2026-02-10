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
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { amount, currency, paymentMethod, bankAccount, bankName, accountHolder } = depositSchema.parse(body)

    // Validate amount
    const amountNum = parseFloat(amount)
    if (amountNum <= 0 || amountNum < 100) {
      return NextResponse.json(
        { error: 'Minimum deposit amount is 100 CNY' },
        { status: 400 }
      )
    }

    // Validate bank card number (if bank card payment)
    if (paymentMethod === 'BANK_CARD' && bankAccount) {
      if (!validateBankCard(bankAccount)) {
        return NextResponse.json(
          { error: 'Invalid bank card number format' },
          { status: 400 }
        )
      }
    }

    // Create deposit order
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

    // Simulate bank processing
    let processingResult = null
    if (paymentMethod === 'BANK_CARD' && bankAccount) {
      const bankInfo = getBankInfo(bankAccount)
      processingResult = await simulateBankTransfer({
        fromAccount: bankAccount,
        toAccount: '6222021234567890', // Platform receiving account
        amount: amountNum,
        currency: currency,
        reference: `DEPOSIT_${fiatOrder.id}`
      })
    }

    // Record SIEM log
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
      successful: true,
      message: 'Deposit request submitted',
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
