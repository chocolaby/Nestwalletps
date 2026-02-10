import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEth, sendToken } from '@/lib/wallet'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'
import crypto from 'crypto'

// Inline decryption function to ensure correct key is used
function decryptPrivateKeyInline(encryptedPrivateKey: string): string {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'nest-wallet-encryption-key-32chars'
  const algorithm = 'aes-256-cbc'
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  const parts = encryptedPrivateKey.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encryptedText = parts[1]
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

const sendTransactionSchema = z.object({
  fromWalletId: z.string(),
  to: z.string(),
  amount: z.string(),
  tokenAddress: z.string().optional(),
  tokenSymbol: z.string().optional()
})

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('Received transfer request:', JSON.stringify(body, null, 2))
    const { fromWalletId, to: toAddress, amount, tokenAddress } = sendTransactionSchema.parse(body)
    console.log('After parsing:', { fromWalletId, toAddress, amount, tokenAddress })

    // Get sender wallet
    const fromWallet = await prisma.wallet.findFirst({
      where: { id: fromWalletId, userId: user.id }
    })

    if (!fromWallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    if (fromWallet.type === 'NON_CUSTODIAL') {
      return NextResponse.json({ error: 'Non-custodial wallet requires client-side signing, please use custodial wallet for transfers' }, { status: 400 })
    }

    // Decrypt private key
    if (!fromWallet.privateKeyEncrypted) {
      return NextResponse.json({ error: 'Wallet private key not found' }, { status: 400 })
    }
    
    let privateKey
    try {
      // Check if encrypted private key (contains colon) or raw private key
      if (fromWallet.privateKeyEncrypted.includes(':')) {
        console.log('Detected encrypted private key, attempting to decrypt...')
        privateKey = decryptPrivateKeyInline(fromWallet.privateKeyEncrypted)
      } else {
        console.log('Detected raw private key, using directly')
        privateKey = fromWallet.privateKeyEncrypted
      }
      console.log('Private key retrievedsuccessful, length:', privateKey.length)
    } catch (error) {
      console.error('Private key decryption failed:', error)
      return NextResponse.json({ error: 'Failed to decrypt private key' }, { status: 500 })
    }

    // Check if wallet balance is sufficient
    try {
      const { getEthBalance } = await import('@/lib/wallet')
      const currentBalance = await getEthBalance(fromWallet.address)
      const balanceNum = parseFloat(currentBalance)
      const amountNum = parseFloat(amount)
      const estimatedGas = 0.00042 // Estimate gas fee
      
      console.log(`Balance check: current=${balanceNum} ETH, need=${amountNum + estimatedGas} ETH`)
      
      if (balanceNum < (amountNum + estimatedGas)) {
        return NextResponse.json({ 
          error: `Insufficient balance: need ${(amountNum + estimatedGas).toFixed(6)} ETH，but only have ${balanceNum.toFixed(6)} ETH` 
        }, { status: 400 })
      }
    } catch (balanceError) {
      console.warn('Balance checkfailed，continuing execution:', balanceError)
    }

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        fromWalletId,
        fromAddress: fromWallet.address,
        toAddress,
        amount,
        tokenAddress,
        tokenSymbol: tokenAddress ? 'TOKEN' : 'ETH',
        userId: user.id,
        status: 'PENDING'
      }
    })

    try {
      // Send transaction - add retry mechanism
      let txHash: string = ''
      let gasUsed: string = '0'
      let gasPrice: string = '0'
      let attempts = 0
      const maxAttempts = 3

      while (attempts < maxAttempts) {
        try {
          attempts++
          console.log(`Attempting to send transaction (Attempt${attempts}attempt)...`)

          if (tokenAddress) {
            // Send token
            const result = await sendToken(privateKey, toAddress, amount, tokenAddress)
            txHash = result.txHash
            gasUsed = result.gasUsed
            gasPrice = result.gasPrice
          } else {
            // Send ETH
            const result = await sendEth(privateKey, toAddress, amount)
            txHash = result.txHash
            gasUsed = result.gasUsed
            gasPrice = result.gasPrice
          }

          console.log(`Transaction sent successfulfully: ${txHash}`)
          break // Break loop on successful

        } catch (sendError) {
          console.error(`Attempt${attempts}attemptsendingfailed:`, sendError)
          
          if (attempts >= maxAttempts) {
            throw sendError // Reached maximum retry attempts, throw error
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
        }
      }

      // Update transaction record
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          txHash,
          gasUsed,
          gasPrice,
          status: 'CONFIRMED'
        }
      })

      // Record SIEM log
      await SiemLogger.logTransaction(user.id, transaction.id, amount, fromWallet.address, toAddress)

      return NextResponse.json({
        successful: true,
        transaction: {
          id: transaction.id,
          txHash: txHash,
          status: 'CONFIRMED'
        }
      })

    } catch (error) {
      // Update transaction status to failed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' }
      })

      throw error
    }

  } catch (error) {
    console.error('Send transaction error:', error)
    return NextResponse.json({ error: 'Transaction failed' }, { status: 500 })
  }
}
