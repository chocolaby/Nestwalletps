import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { simulateBankTransfer, validateBankCard } from '@/lib/bank'
import { z } from 'zod'

const withdrawSchema = z.object({
  amount: z.number().min(100, 'Minimum withdrawal amount is 100 CNY'),
  currency: z.string().min(1, 'Please select currency type'),
  paymentMethod: z.enum(['BANK_CARD', 'ALIPAY', 'WECHAT']),
  bankAccount: z.string().min(1, 'Please enter bank card number'),
  bankName: z.string().optional(),
  accountHolder: z.string().min(1, 'Please enter cardholder name')
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
    const validatedData = withdrawSchema.parse(body)
    
    const { amount, currency, paymentMethod, bankAccount, bankName, accountHolder } = validatedData

    // Validate bank card
    if (paymentMethod === 'BANK_CARD') {
      const isValidCard = validateBankCard(bankAccount)
      if (!isValidCard) {
        return NextResponse.json(
          { error: 'Invalid bank card number (requires 16-19 digits)' },
          { status: 400 }
        )
      }
    }

    // Create withdrawal order using Prisma
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

    // Simulate bank transfer processing
    const transferResult = await simulateBankTransfer({
      fromAccount: 'NESTWALLET_MAIN',
      toAccount: bankAccount,
      amount,
      currency,
      reference: fiatOrder.id,
      memo: `Withdrawal to ${paymentMethod}`
    })

    // Update order status
    const finalStatus = transferResult.status === 'SUCCESS' ? 'COMPLETED' : 
                       transferResult.status === 'PENDING' ? 'PROCESSING' : 'FAILED'
    
    await prisma.fiatOrder.update({
      where: { id: fiatOrder.id },
      data: { 
        status: finalStatus,
        note: `Processing fee: ${transferResult.fee}, Transaction ID: ${transferResult.transactionId}`
      }
    })

    // Record SIEM log
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
      console.error('SIEMlogRecordfailed:', logError)
    }

    const isSuccess = transferResult.status === 'SUCCESS' || transferResult.status === 'PENDING'
    
    return NextResponse.json({
      successful: true,
      message: isSuccess ? 
        `Withdrawal request submitted, estimated processing time: ${transferResult.estimatedTime}` : 
        `Withdrawal failed: ${transferResult.message}`,
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
    console.error('Withdrawal request error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Input validation failed', details: error.issues },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Request failed, please try again later' },
      { status: 500 }
    )
  }
}
