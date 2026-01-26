import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEthBalance, getTokenBalance } from '@/lib/wallet'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 获取用户的所有钱包
    const wallets = await prisma.wallet.findMany({
      where: { userId: user.id },
      include: {
        balances: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // 更新每个钱包的余额
    const walletsWithUpdatedBalances = await Promise.all(
      wallets.map(async (wallet) => {
        // 更新ETH余额
        const currentEthBalance = await getEthBalance(wallet.address)
        
        // 更新数据库中的ETH余额
        await prisma.tokenBalance.upsert({
          where: {
            walletId_tokenAddress: {
              walletId: wallet.id,
              tokenAddress: '0x0000000000000000000000000000000000000000'
            }
          },
          update: {
            balance: currentEthBalance
          },
          create: {
            walletId: wallet.id,
            tokenAddress: '0x0000000000000000000000000000000000000000',
            tokenSymbol: 'ETH',
            tokenName: 'Ethereum',
            balance: currentEthBalance,
            decimals: 18
          }
        })

        // 更新其他代币余额
        const updatedBalances = await Promise.all(
          wallet.balances.map(async (balance) => {
            if (balance.tokenAddress === '0x0000000000000000000000000000000000000000') {
              // ETH余额已经更新
              return {
                ...balance,
                balance: currentEthBalance
              }
            } else {
              // 更新ERC-20代币余额
              const currentBalance = await getTokenBalance(balance.tokenAddress, wallet.address)
              
              await prisma.tokenBalance.update({
                where: { id: balance.id },
                data: { balance: currentBalance }
              })

              return {
                ...balance,
                balance: currentBalance
              }
            }
          })
        )

        return {
          id: wallet.id,
          address: wallet.address,
          type: wallet.type,
          createdAt: wallet.createdAt,
          balances: updatedBalances
        }
      })
    )

    return NextResponse.json({
      success: true,
      wallets: walletsWithUpdatedBalances
    })

  } catch (error) {
    console.error('Get wallets error:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
