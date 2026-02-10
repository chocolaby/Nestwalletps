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
        { error: 'Unauthorized access' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { toAddress, amount } = testTransferSchema.parse(body)

    // Validate address format
    if (!ethers.isAddress(toAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      )
    }

    // Connect to Ganache
    const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545')
    
    // Get Ganache preset accounts
    const accounts = await provider.send('eth_accounts', [])
    
    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: 'No test accounts available' },
        { status: 500 }
      )
    }

    const fromAccount = accounts[0] // Use first Ganache account
    
    console.log(`Initiating test transfer: ${fromAccount} -> ${toAddress}, amount: ${amount} ETH`)

    // Send test transfer
    const valueInWei = ethers.parseEther(amount)
    const txResponse = await provider.send('eth_sendTransaction', [{
      from: fromAccount,
      to: toAddress,
      value: '0x' + valueInWei.toString(16), // Convert to hex string
      gas: '0x5208' // 21000 gas
    }])

    console.log('test transfersuccessful，TxHash:', txResponse)

    // Wait 1 second for transaction confirmation
    setTimeout(async () => {
      try {
        const receipt = await provider.getTransactionReceipt(txResponse)
        console.log('Transaction confirmed:', receipt?.status === 1 ? 'successful' : 'failed')
      } catch (e) {
        console.log('get transaction receiptfailed:', e)
      }
    }, 1000)

    return NextResponse.json({
      successful: true,
      txHash: txResponse,
      message: `Successfully transferred ${toAddress} to ${amount} ETH`,
      fromAccount,
      amount,
      toAddress
    })

  } catch (error) {
    console.error('Test transfer error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      )
    }

    // Check if network connection error
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch')) {
      return NextResponse.json(
        { error: 'Ganache node is not running, please ensure Ganache is running at 127.0.0.1:8545' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { 
        error: 'test transferfailed', 
        details: errorMessage
      },
      { status: 500 }
    )
  }
}
