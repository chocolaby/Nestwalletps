import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SiemLogger } from '@/lib/siem'
import { deployContract } from '@/lib/contracts'
import { z } from 'zod'

const deployContractSchema = z.object({
  name: z.string().min(1),
  symbol: z.string().min(1),
  decimals: z.number().int().min(0).max(18).default(18),
  initialSupply: z.number().int().min(0)
})

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
    const { name, symbol, decimals, initialSupply } = deployContractSchema.parse(body)

    // 部署合约
    const deployResult = await deployContract({
      name,
      symbol,
      decimals,
      initialSupply
    })

    // 保存合约信息到数据库
    const contract = await prisma.smartContract.create({
      data: {
        name: `${name} (${symbol})`,
        address: deployResult.address,
        abi: JSON.stringify(deployResult.abi),
        bytecode: deployResult.bytecode,
        deployedBy: user.id,
        network: 'localhost',
        blockNumber: deployResult.blockNumber,
        txHash: deployResult.txHash
      }
    })

    // 记录SIEM日志
    await SiemLogger.logEvent({
      userId: user.id,
      eventType: 'ADMIN_ACTION',
      details: {
        action: 'CONTRACT_DEPLOYED',
        contractAddress: deployResult.address,
        contractName: name,
        symbol,
        initialSupply,
        txHash: deployResult.txHash
      },
      riskLevel: 'MEDIUM',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
    })

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        name: contract.name,
        address: contract.address,
        txHash: contract.txHash,
        blockNumber: contract.blockNumber
      }
    })

  } catch (error) {
    console.error('Deploy contract error:', error)
    
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
