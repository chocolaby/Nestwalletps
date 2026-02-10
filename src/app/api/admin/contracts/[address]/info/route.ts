import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getTokenInfo } from '@/lib/contracts'

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No permission' },
        { status: 403 }
      )
    }

    const contractAddress = params.address

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      return NextResponse.json(
        { error: 'Invalid contract address format' },
        { status: 400 }
      )
    }

    const tokenInfo = await getTokenInfo(contractAddress)

    return NextResponse.json({
      successful: true,
      tokenInfo
    })

  } catch (error) {
    console.error('Get token info error:', error)
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
