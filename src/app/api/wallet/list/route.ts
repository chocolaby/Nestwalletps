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

    // Get all user wallets
    const wallets = await prisma.wallet.findMany({
      where: { userId: user.id },
      include: {
        balances: true
      },
      orderBy: { createdAt: 'desc' }
    })

    // Update each wallet balance
    const walletsWithUpdatedBalances = await Promise.all(
      wallets.map(async (wallet) => {
        // Update ETH balance
        const currentEthBalance = await getEthBalance(wallet.address)
        
        // Update ETH balance in database
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

        // Update other token balances
        const updatedBalances = await Promise.all(
          wallet.balances.map(async (balance) => {
            if (balance.tokenAddress === '0x0000000000000000000000000000000000000000') {
              // ETH balance already updated
              return {
                ...balance,
                balance: currentEthBalance
              }
            } else {
              // Update ERC-20 token balance
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
      successful: true,
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
