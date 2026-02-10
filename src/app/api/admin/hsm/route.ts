import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { 
  createSigningRequest,
  approveSigningRequest,
  executeHSMSigning,
  getSigningRequest,
  getPendingSigningRequests,
  getUserSigningRequests,
  getSigningApprovals
} from '@/lib/hsm'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'

const createRequestSchema = z.object({
  transactionData: z.any(),
  requiredApprovals: z.number().min(1).max(5).default(1)
})

const approveRequestSchema = z.object({
  requestId: z.string().uuid(),
  approved: z.boolean(),
  comment: z.string().optional()
})

const signRequestSchema = z.object({
  requestId: z.string().uuid(),
  keyType: z.enum(['platform', 'custody']).default('platform')
})

// GET - Return HSM status, pending requests, and key info
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权限' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'pending') {
      // Get pending signing requests
      const pendingRequests = getPendingSigningRequests()
      return NextResponse.json({
        success: true,
        requests: pendingRequests
      })
    }

    if (action === 'user-requests') {
      // Get user's signing requests
      const userRequests = getUserSigningRequests(user.id)
      return NextResponse.json({
        success: true,
        requests: userRequests
      })
    }

    if (action === 'request-details') {
      const requestId = searchParams.get('requestId')
      if (!requestId) {
        return NextResponse.json(
          { error: 'Request ID required' },
          { status: 400 }
        )
      }

      const signingRequest = getSigningRequest(requestId)
      if (!signingRequest) {
        return NextResponse.json(
          { error: '签名请求不存在' },
          { status: 404 }
        )
      }

      const approvals = getSigningApprovals(requestId)
      
      return NextResponse.json({
        success: true,
        request: signingRequest,
        approvals: approvals
      })
    }

    // Default: return HSM status
    const pendingRequests = getPendingSigningRequests()
    const userRequests = getUserSigningRequests(user.id)

    return NextResponse.json({
      success: true,
      hsmStatus: {
        online: true,
        keyCount: 2,
        availableKeys: [
          {
            keyId: 'hsm_key_001',
            type: 'platform',
            address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
            usage: 'Platform operations'
          },
          {
            keyId: 'hsm_key_002',
            type: 'custody',
            address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            usage: 'Custodial wallets'
          }
        ]
      },
      pendingRequestCount: pendingRequests.length,
      userRequestCount: userRequests.length
    })

  } catch (error) {
    console.error('HSM GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create signing request, approve, or execute signing
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
    const action = body.action

    if (action === 'create-request') {
      // Create a new signing request
      const { transactionData, requiredApprovals } = createRequestSchema.parse(body)
      
      const signingRequest = createSigningRequest(
        user.id,
        transactionData,
        requiredApprovals
      )

      // Log SIEM event
      await SiemLogger.logEvent({
        userId: user.id,
        eventType: 'ADMIN_ACTION',
        details: {
          action: 'HSM_SIGNING_REQUEST_CREATED',
          requestId: signingRequest.id,
          requiredApprovals
        },
        riskLevel: 'MEDIUM',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json({
        success: true,
        message: '签名请求已创建',
        request: signingRequest
      })
    }

    if (action === 'approve') {
      // Approve a signing request
      const { requestId, approved, comment } = approveRequestSchema.parse(body)
      
      const result = approveSigningRequest(requestId, user.id, approved, comment)

      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        )
      }

      // Log SIEM event
      await SiemLogger.logEvent({
        userId: user.id,
        eventType: 'ADMIN_ACTION',
        details: {
          action: 'HSM_SIGNING_REQUEST_APPROVED',
          requestId,
          approved,
          comment,
          status: result.request?.status
        },
        riskLevel: approved ? 'MEDIUM' : 'LOW',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json({
        success: true,
        message: result.message,
        request: result.request
      })
    }

    if (action === 'sign') {
      // Execute HSM signing
      const { requestId, keyType } = signRequestSchema.parse(body)
      
      const result = await executeHSMSigning(requestId, keyType)

      if (!result.success) {
        return NextResponse.json(
          { error: result.message },
          { status: 400 }
        )
      }

      // Log SIEM event
      await SiemLogger.logEvent({
        userId: user.id,
        eventType: 'ADMIN_ACTION',
        details: {
          action: 'HSM_SIGNING_EXECUTED',
          requestId,
          keyType,
          signature: result.result?.signature,
          signedBy: result.result?.signedBy
        },
        riskLevel: 'HIGH',
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
      })

      return NextResponse.json({
        success: true,
        message: result.message,
        signingResult: result.result
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('HSM POST error:', error)
    
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
