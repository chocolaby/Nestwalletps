import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { mintTokens, getTokenInfo } from '@/lib/contracts'
import { createSigningRequest, approveSigningRequest, executeHSMSigning } from '@/lib/hsm'
import { z } from 'zod'

const mintSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, '合约地址格式无效'),
  toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, '接收地址格式无效'),
  amount: z.string().min(1, '金额不能为空'),
  reason: z.string().min(1, '原因不能为空')
})

// GET handler to return available contracts
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权限' },
        { status: 403 }
      )
    }

    // Get contracts from database
    const dbContracts = await prisma.smartContract.findMany({
      orderBy: { createdAt: 'desc' }
    })

    // Add the pre-deployed Sepolia contract if env var is set
    const contracts = [...dbContracts]
    const sepoliaAddress = process.env.NEXT_PUBLIC_NEST_TOKEN_ADDRESS
    
    if (sepoliaAddress) {
      // Check if it's not already in DB
      const existsInDb = dbContracts.some(c => c.address.toLowerCase() === sepoliaAddress.toLowerCase())
      
      if (!existsInDb) {
        // Try to fetch token info
        try {
          const tokenInfo = await getTokenInfo(sepoliaAddress)
          contracts.unshift({
            id: 'sepolia-predefined',
            name: `${tokenInfo.name} (Pre-deployed)`,
            address: sepoliaAddress,
            abi: '[]', // Not needed for display
            bytecode: null,
            deployedBy: 'system',
            network: 'sepolia',
            blockNumber: null,
            txHash: null,
            createdAt: new Date()
          })
        } catch (error) {
          // If can't fetch info, add with basic info
          contracts.unshift({
            id: 'sepolia-predefined',
            name: 'NestToken (Pre-deployed Sepolia)',
            address: sepoliaAddress,
            abi: '[]',
            bytecode: null,
            deployedBy: 'system',
            network: 'sepolia',
            blockNumber: null,
            txHash: null,
            createdAt: new Date()
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      contracts: contracts.map(c => ({
        id: c.id,
        name: c.name,
        address: c.address,
        network: c.network,
        createdAt: c.createdAt
      }))
    })

  } catch (error) {
    console.error('Get contracts error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权限' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { contractAddress, toAddress, amount, reason } = mintSchema.parse(body)

    // 验证金额
    if (parseFloat(amount) <= 0) {
      return NextResponse.json(
        { error: '金额必须大于0' },
        { status: 400 }
      )
    }

    // Try to get contract from DB, but don't require it
    const contract = await prisma.smartContract.findUnique({
      where: { address: contractAddress }
    })

    // Get token symbol from contract
    let tokenSymbol = 'NEST'
    try {
      const tokenInfo = await getTokenInfo(contractAddress)
      tokenSymbol = tokenInfo.symbol
    } catch (error) {
      console.warn(`Could not fetch token symbol for ${contractAddress}, using default`)
      // If contract exists in DB, try to extract from name
      if (contract) {
        tokenSymbol = contract.name.split(' ')[0] || 'NEST'
      }
    }

    // Check if this is a valid contract by attempting to get token info
    const sepoliaAddress = process.env.NEXT_PUBLIC_NEST_TOKEN_ADDRESS
    if (!contract && sepoliaAddress && contractAddress.toLowerCase() !== sepoliaAddress.toLowerCase()) {
      // Contract not in DB and not the env var contract - warn but continue
      console.warn(`Contract ${contractAddress} not found in DB, proceeding anyway`)
    }

    // 使用部署者私钥进行铸造
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || 
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

    // HSM signing flow: Create request -> Auto-approve -> Sign
    const signingRequest = createSigningRequest(
      user.id,
      {
        operation: 'mint',
        contractAddress,
        toAddress,
        amount,
        reason,
        timestamp: new Date().toISOString()
      },
      1 // requiredApprovals: 1 for demo
    )

    // Auto-approve for admin (demo purposes)
    const approvalResult = approveSigningRequest(
      signingRequest.id,
      user.id,
      true,
      'Auto-approved by admin for mint operation'
    )

    if (!approvalResult.success) {
      return NextResponse.json(
        { error: `HSM approval failed: ${approvalResult.message}` },
        { status: 500 }
      )
    }

    // Execute HSM signing
    const hsmSigningResult = await executeHSMSigning(signingRequest.id, 'platform')
    
    if (!hsmSigningResult.success) {
      return NextResponse.json(
        { error: `HSM signing failed: ${hsmSigningResult.message}` },
        { status: 500 }
      )
    }

    // 执行合约铸造
    const mintResult = await mintTokens(
      contractAddress,
      toAddress,
      amount,
      deployerPrivateKey
    )

    // 记录交易到数据库
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        fromAddress: 'MINT',
        toAddress: toAddress,
        amount: amount,
        tokenAddress: contractAddress,
        tokenSymbol: tokenSymbol,
        txHash: mintResult.txHash,
        status: 'CONFIRMED',
        gasUsed: mintResult.gasUsed,
        gasPrice: '0'
      }
    })

    // 记录SIEM日志
    await SiemLogger.logEvent({
      userId: user.id,
      eventType: 'ADMIN_ACTION',
      details: {
        action: 'TOKEN_MINT',
        contractAddress,
        toAddress,
        amount,
        reason,
        txHash: mintResult.txHash,
        hsmRequestId: signingRequest.id,
        hsmSignature: hsmSigningResult.result?.signature,
        signedBy: hsmSigningResult.result?.signedBy,
        timestamp: new Date().toISOString()
      },
      riskLevel: 'HIGH',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      message: '代币铸造成功',
      transaction: {
        id: transaction.id,
        txHash: mintResult.txHash,
        toAddress,
        amount,
        contractAddress
      },
      hsmInfo: {
        requestId: signingRequest.id,
        signedBy: hsmSigningResult.result?.signedBy,
        signature: hsmSigningResult.result?.signature?.slice(0, 20) + '...'
      }
    })

  } catch (error) {
    console.error('Token mint error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Mint失败' },
      { status: 500 }
    )
  }
}
