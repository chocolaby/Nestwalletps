import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { ethers } from 'ethers'
import { z } from 'zod'

const testTransferSchema = z.object({
  toAddress: z.string().min(1, 'Address is required'),
  amount: z.string().min(1, 'Amount is required')
})

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { toAddress, amount } = testTransferSchema.parse(body)

    // 验证地址格式
    if (!ethers.isAddress(toAddress)) {
      return NextResponse.json(
        { error: '无效的钱包地址' },
        { status: 400 }
      )
    }

    // 连接到Ganache
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545')
    
    // 获取Ganache预设账户
    const accounts = await provider.send('eth_accounts', [])
    
    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: '无可用的测试账户' },
        { status: 500 }
      )
    }

    const fromAccount = accounts[0] // 使用第一个Ganache账户
    
    console.log(`发起测试转账: ${fromAccount} -> ${toAddress}, 金额: ${amount} ETH`)

    // 发送测试转账
    const valueInWei = ethers.parseEther(amount)
    const txResponse = await provider.send('eth_sendTransaction', [{
      from: fromAccount,
      to: toAddress,
      value: '0x' + valueInWei.toString(16), // 转换为hex字符串
      gas: '0x5208' // 21000 gas
    }])

    console.log('测试转账成功，TxHash:', txResponse)

    // 等待1秒让交易被确认
    setTimeout(async () => {
      try {
        const receipt = await provider.getTransactionReceipt(txResponse)
        console.log('交易确认:', receipt?.status === 1 ? '成功' : '失败')
      } catch (e) {
        console.log('获取交易回执失败:', e)
      }
    }, 1000)

    return NextResponse.json({
      success: true,
      txHash: txResponse,
      message: `成功向 ${toAddress} 转账 ${amount} ETH`,
      fromAccount,
      amount,
      toAddress
    })

  } catch (error) {
    console.error('Test transfer error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: '参数无效', details: error.issues },
        { status: 400 }
      )
    }

    // 检查是否是网络连接错误
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch')) {
      return NextResponse.json(
        { error: 'Ganache节点未运行，请确保Ganache在127.0.0.1:8545上运行' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { 
        error: '测试转账失败', 
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
