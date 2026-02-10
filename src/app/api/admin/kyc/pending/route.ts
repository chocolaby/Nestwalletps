import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No permission' },
        { status: 403 }
      )
    }

    const documents = await prisma.kycDocument.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    return NextResponse.json({
      successful: true,
      documents: documents.map(doc => ({
        id: doc.id,
        userId: doc.userId,
        userEmail: doc.user.email,
        documentType: doc.documentType,
        fileName: doc.fileName,
        status: doc.status,
        createdAt: doc.createdAt
      }))
    })

  } catch (error) {
    console.error('Get pending KYC error:', error)
    
    return NextResponse.json(
      { error: 'Failed to get data' },
      { status: 500 }
    )
  }
}
