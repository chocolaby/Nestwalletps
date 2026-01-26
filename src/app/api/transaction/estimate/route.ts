import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { ethers } from 'ethers'

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
    const { from, to, amount, token } = body

    if (!to || !amount) {
      return NextResponse.json(
        { error: '参数缺失' },
        { status: 400 }
      )
    }

    // 验证地址格式
    if (!ethers.isAddress(to)) {
      return NextResponse.json(
        { error: '地址格式无效' },
        { status: 400 }
      )
    }

    // from参数可选，如果没有提供则使用默认地址
    const fromAddress = from || '0x0000000000000000000000000000000000000000'
    if (from && !ethers.isAddress(from)) {
      return NextResponse.json(
        { error: '发送地址格式无效' },
        { status: 400 }
      )
    }

    // 连接到RPC（如果可用）
    const rpcUrl = process.env.ANVIL_RPC_URL || 'http://localhost:8545'
    let gasLimit = '21000' // ETH转账默认
    let gasPrice = '20000000000' // 20 Gwei
    let totalCost = '0.00042' // 默认估算

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      
      // 获取当前gas price
      const feeData = await provider.getFeeData()
      if (feeData.gasPrice) {
        gasPrice = feeData.gasPrice.toString()
      }

      // 估算gas limit
      if (token === 'ETH') {
        gasLimit = '21000'
      } else {
        // ERC-20转账需要更多gas
        gasLimit = '65000'
      }

      // 计算总费用
      const cost = (parseInt(gasLimit) * parseInt(gasPrice)) / 1e18
      totalCost = cost.toFixed(8)

    } catch (error) {
      console.log('无法连接到RPC，使用默认值')
      // 使用默认值，不抛出错误
    }

    return NextResponse.json({
      success: true,
      gasLimit,
      gasPrice,
      totalCost,
      from: fromAddress,
      to,
      amount,
      token: token || 'ETH'
    })

  } catch (error) {
    console.error('Gas估算错误:', error)
    
    return NextResponse.json(
      { error: 'Gas估算失败' },
      { status: 500 }
    )
  }
}
