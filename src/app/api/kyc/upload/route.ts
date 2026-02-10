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
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('documentType') as string

    if (!file) {
      return NextResponse.json(
        { error: 'Please select a file' },
        { status: 400 }
      )
    }

    if (!documentType) {
      return NextResponse.json(
        { error: 'Please select document type' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      )
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size cannot exceed 5MB' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExtension}`
    const uploadDir = join(process.cwd(), 'uploads', 'kyc')
    const filePath = join(uploadDir, fileName)

    // Ensure upload directory exists
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // Directory may already exist, ignore error
    }

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Create database record
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

    // Record SIEM log
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
      successful: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        documentType: document.documentType,
        status: document.status,
        createdAt: document.createdAt
      }
    })

  } catch (error) {
    console.error('KYC upload error:', error)
    
    return NextResponse.json(
      { error: 'Upload failed, please try again later' },
      { status: 500 }
    )
  }
}
