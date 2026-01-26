import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    const documents = await prisma.kycDocument.findMany({
      where: {
        userId: user.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const status = user.kycStatus

    return NextResponse.json({
      success: true,
      status,
      documents: documents.map(doc => ({
        id: doc.id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        status: doc.status,
        createdAt: doc.createdAt
      }))
    })

  } catch (error) {
    console.error('查询KYC状态错误:', error)
    
    return NextResponse.json(
      { error: '查询失败' },
      { status: 500 }
    )
  }
}
