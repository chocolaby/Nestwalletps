import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/siem'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No permission' },
        { status: 403 }
      )
    }

    const docId = params.id

    // Update document status
    const document = await prisma.kycDocument.update({
      where: { id: docId },
      data: {
        status: 'APPROVED',
        verifiedAt: new Date()
      }
    })

    // Update user KYC status
    await prisma.user.update({
      where: { id: document.userId },
      data: {
        kycStatus: 'APPROVED'
      }
    })

    // Record SIEM log
    await logEvent({
      userId: document.userId,
      eventType: 'KYC_APPROVED',
      riskLevel: 'LOW',
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      eventData: JSON.stringify({
        documentId: docId,
        approvedBy: user.id,
        timestamp: new Date().toISOString()
      })
    })

    return NextResponse.json({
      successful: true,
      document
    })

  } catch (error) {
    console.error('Approve KYC error:', error)
    
    return NextResponse.json(
      { error: 'Approval failed' },
      { status: 500 }
    )
  }
}
