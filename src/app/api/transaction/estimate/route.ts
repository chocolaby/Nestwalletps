import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { ethers } from 'ethers'

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
    const { from, to, amount, token } = body

    if (!to || !amount) {
      return NextResponse.json(
        { error: 'Missing parameters' },
        { status: 400 }
      )
    }

    // Validate address format
    if (!ethers.isAddress(to)) {
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      )
    }

    // from parameter is optional, use default address if not provided
    const fromAddress = from || '0x0000000000000000000000000000000000000000'
    if (from && !ethers.isAddress(from)) {
      return NextResponse.json(
        { error: 'Invalid sender address format' },
        { status: 400 }
      )
    }

    // Connect to RPC (if available)
    const rpcUrl = process.env.ANVIL_RPC_URL || 'http://localhost:8545'
    let gasLimit = '21000' // ETH transfer default
    let gasPrice = '20000000000' // 20 Gwei
    let totalCost = '0.00042' // Default estimate

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      
      // Get current gas price
      const feeData = await provider.getFeeData()
      if (feeData.gasPrice) {
        gasPrice = feeData.gasPrice.toString()
      }

      // Estimate gas limit
      if (token === 'ETH') {
        gasLimit = '21000'
      } else {
        // ERC-20 transfer requires more gas
        gasLimit = '65000'
      }

      // Calculate total cost
      const cost = (parseInt(gasLimit) * parseInt(gasPrice)) / 1e18
      totalCost = cost.toFixed(8)

    } catch (error) {
      console.log('Unable to connect to RPC, using default values')
      // Use default values, don't throw error
    }

    return NextResponse.json({
      successful: true,
      gasLimit,
      gasPrice,
      totalCost,
      from: fromAddress,
      to,
      amount,
      token: token || 'ETH'
    })

  } catch (error) {
    console.error('Gas estimation error:', error)
    
    return NextResponse.json(
      { error: 'Gas estimation failed' },
      { status: 500 }
    )
  }
}
