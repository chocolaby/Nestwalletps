import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: '无权限' },
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
      success: true,
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
    console.error('获取待审KYC错误:', error)
    
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
