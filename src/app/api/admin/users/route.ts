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

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        kycStatus: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      users
    })

  } catch (error) {
    console.error('获取用户列表错误:', error)
    
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
