import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEth, sendToken } from '@/lib/wallet'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'
import crypto from 'crypto'

// 内联解密函数，确保使用正确的密钥
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
    console.log('收到转账请求:', JSON.stringify(body, null, 2))
    const { fromWalletId, to: toAddress, amount, tokenAddress } = sendTransactionSchema.parse(body)
    console.log('解析后:', { fromWalletId, toAddress, amount, tokenAddress })

    // 获取发送方钱包
    const fromWallet = await prisma.wallet.findFirst({
      where: { id: fromWalletId, userId: user.id }
    })

    if (!fromWallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    if (fromWallet.type === 'NON_CUSTODIAL') {
      return NextResponse.json({ error: '非托管钱包需要客户端签名，请使用托管钱包进行转账' }, { status: 400 })
    }

    // 解密私钥
    if (!fromWallet.privateKeyEncrypted) {
      return NextResponse.json({ error: 'Wallet private key not found' }, { status: 400 })
    }
    
    let privateKey
    try {
      // 检查是否是加密的私钥（包含冒号）还是原始私钥
      if (fromWallet.privateKeyEncrypted.includes(':')) {
        console.log('检测到加密私钥，尝试解密...')
        privateKey = decryptPrivateKeyInline(fromWallet.privateKeyEncrypted)
      } else {
        console.log('检测到原始私钥，直接使用')
        privateKey = fromWallet.privateKeyEncrypted
      }
      console.log('私钥获取成功, 长度:', privateKey.length)
    } catch (error) {
      console.error('Private key decryption failed:', error)
      return NextResponse.json({ error: 'Failed to decrypt private key' }, { status: 500 })
    }

    // 检查钱包余额是否足够
    try {
      const { getEthBalance } = await import('@/lib/wallet')
      const currentBalance = await getEthBalance(fromWallet.address)
      const balanceNum = parseFloat(currentBalance)
      const amountNum = parseFloat(amount)
      const estimatedGas = 0.00042 // 估算Gas费用
      
      console.log(`余额检查: 当前=${balanceNum} ETH, 需要=${amountNum + estimatedGas} ETH`)
      
      if (balanceNum < (amountNum + estimatedGas)) {
        return NextResponse.json({ 
          error: `余额不足: 需要 ${(amountNum + estimatedGas).toFixed(6)} ETH，但只有 ${balanceNum.toFixed(6)} ETH` 
        }, { status: 400 })
      }
    } catch (balanceError) {
      console.warn('余额检查失败，继续执行:', balanceError)
    }

    // 创建交易记录
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
      // 发送交易 - 添加重试机制
      let txHash: string = ''
      let gasUsed: string = '0'
      let gasPrice: string = '0'
      let attempts = 0
      const maxAttempts = 3

      while (attempts < maxAttempts) {
        try {
          attempts++
          console.log(`尝试发送交易 (第${attempts}次)...`)

          if (tokenAddress) {
            // 发送代币
            const result = await sendToken(privateKey, toAddress, amount, tokenAddress)
            txHash = result.txHash
            gasUsed = result.gasUsed
            gasPrice = result.gasPrice
          } else {
            // 发送ETH
            const result = await sendEth(privateKey, toAddress, amount)
            txHash = result.txHash
            gasUsed = result.gasUsed
            gasPrice = result.gasPrice
          }

          console.log(`交易发送成功: ${txHash}`)
          break // 成功则跳出循环

        } catch (sendError) {
          console.error(`第${attempts}次发送失败:`, sendError)
          
          if (attempts >= maxAttempts) {
            throw sendError // 达到最大重试次数，抛出错误
          }
          
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
        }
      }

      // 更新交易记录
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          txHash,
          gasUsed,
          gasPrice,
          status: 'CONFIRMED'
        }
      })

      // 记录SIEM日志
      await SiemLogger.logTransaction(user.id, transaction.id, amount, fromWallet.address, toAddress)

      return NextResponse.json({
        success: true,
        transaction: {
          id: transaction.id,
          txHash: txHash,
          status: 'CONFIRMED'
        }
      })

    } catch (error) {
      // 更新交易状态为失败
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
