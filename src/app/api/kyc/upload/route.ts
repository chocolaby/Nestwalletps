import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/siem'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    
    if (!user) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('documentType') as string

    if (!file) {
      return NextResponse.json(
        { error: '请选择文件' },
        { status: 400 }
      )
    }

    if (!documentType) {
      return NextResponse.json(
        { error: '请选择证件类型' },
        { status: 400 }
      )
    }

    // 验证文件类型
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '不支持的文件类型' },
        { status: 400 }
      )
    }

    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: '文件大小不能超过5MB' },
        { status: 400 }
      )
    }

    // 生成唯一文件名
    const fileExtension = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExtension}`
    const uploadDir = join(process.cwd(), 'uploads', 'kyc')
    const filePath = join(uploadDir, fileName)

    // 确保上传目录存在
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // 目录可能已存在，忽略错误
    }

    // 保存文件
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // 创建数据库记录
    const document = await prisma.kycDocument.create({
      data: {
        userId: user.id,
        documentType,
        fileName: file.name,
        filePath: `/uploads/kyc/${fileName}`,
        fileSize: file.size,
        mimeType: file.type,
        status: 'PENDING'
      }
    })

    // 记录SIEM日志
    await logEvent({
      userId: user.id,
      eventType: 'KYC_SUBMITTED',
      riskLevel: 'LOW',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      eventData: JSON.stringify({
        documentId: document.id,
        documentType,
        fileName: file.name,
        fileSize: file.size
      })
    })

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        documentType: document.documentType,
        status: document.status,
        createdAt: document.createdAt
      }
    })

  } catch (error) {
    console.error('KYC上传错误:', error)
    
    return NextResponse.json(
      { error: '上传失败，请稍后重试' },
      { status: 500 }
    )
  }
}
