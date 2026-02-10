import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { logSiemEvent } from '@/lib/siem'
import { createNotification } from '@/lib/notifications'
import fs from 'fs'
import path from 'path'

// Liveness detection challenge types
type ChallengeType = 'BLINK' | 'NOD' | 'SHAKE' | 'SMILE'
type ChallengeResult = 'pending' | 'passed' | 'failed'

interface ChallengeData {
  type: ChallengeType
  result: ChallengeResult
}

interface LivenessRequest {
  challenges: ChallengeData[]
  faceImage?: string // base64 encoded face image
  passed: boolean
}

// POST - Submit liveness detection result
export async function POST(request: NextRequest) {
  try {
    // Verify user identity
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const userId = payload.userId

    // Parse request body
    const body: LivenessRequest = await request.json()
    const { challenges, faceImage, passed } = body

    // Validate challenge data
    if (!challenges || !Array.isArray(challenges) || challenges.length === 0) {
      return NextResponse.json({ error: 'Invalid detection data' }, { status: 400 })
    }

    // Calculate confidence score
    const passedCount = challenges.filter(c => c.result === 'passed').length
    const confidence = passedCount / challenges.length

    // Save face image (if provided)
    let faceImagePath: string | null = null
    if (faceImage && passed) {
      try {
        // Extract image data from base64
        const base64Data = faceImage.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')

        // Create upload directory
        const uploadDir = path.join(process.cwd(), 'uploads', 'liveness', userId)
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true })
        }

        // Save file
        const fileName = `face_${Date.now()}.jpg`
        faceImagePath = path.join('uploads', 'liveness', userId, fileName)
        fs.writeFileSync(path.join(process.cwd(), faceImagePath), buffer)
      } catch (err) {
        console.error('Failed to save face image:', err)
        // Don't affect main flow
      }
    }

    // Get primary challenge type (first challenge)
    const primaryChallenge = challenges[0]?.type || 'BLINK'

    // Create liveness check record
    const livenessCheck = await prisma.livenessCheck.create({
      data: {
        userId,
        status: passed ? 'PASSED' : 'FAILED',
        challengeType: primaryChallenge,
        challengeResult: JSON.stringify(challenges),
        faceImagePath,
        confidence,
        attempts: 1,
        completedAt: new Date()
      }
    })

    // If detection passed, update user KYC status
    if (passed) {
      // Check if there are approved document uploads
      const approvedDocs = await prisma.kycDocument.findFirst({
        where: {
          userId,
          status: 'APPROVED'
        }
      })

      // If documents are approved and liveness passed, KYC is complete
      if (approvedDocs) {
        await prisma.user.update({
          where: { id: userId },
          data: { kycStatus: 'APPROVED' }
        })

        // Send notification
        await createNotification({
          userId,
          type: 'KYC',
          title: 'KYC verification completed',
          message: 'Congratulations! Your identity verification is complete and you can now use all features.'
        })
      } else {
        // Send notification to continue document upload
        await createNotification({
          userId,
          type: 'KYC',
          title: 'Liveness detection passed',
          message: 'Liveness detection passed, please continue uploading identity documents to complete KYC verification.'
        })
      }
    } else {
      // Detection failed notification
      await createNotification({
        userId,
        type: 'KYC',
        title: 'Liveness detection failed',
        message: 'Liveness detection failed, please ensure good lighting and follow the prompts, then try again.'
      })
    }

    // Record SIEM event
    await logSiemEvent({
      userId,
      eventType: passed ? 'LIVENESS_PASSED' : 'LIVENESS_FAILED',
      details: {
        livenessCheckId: livenessCheck.id,
        challenges: challenges.map(c => ({ type: c.type, result: c.result })),
        confidence,
        passed
      },
      riskLevel: passed ? 'LOW' : 'MEDIUM',
      request
    })

    return NextResponse.json({
      successful: true,
      passed,
      livenessCheckId: livenessCheck.id,
      confidence,
      message: passed ? 'Liveness detection passed' : 'Liveness detection failed, please retry'
    })

  } catch (error) {
    console.error('Liveness detection error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}

// GET - Get liveness detection status
export async function GET(request: NextRequest) {
  try {
    // Verify user identity
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const userId = payload.userId

    // Get latest liveness check record
    const latestCheck = await prisma.livenessCheck.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    // Get all check records statistics
    const totalChecks = await prisma.livenessCheck.count({
      where: { userId }
    })

    const passedChecks = await prisma.livenessCheck.count({
      where: { userId, status: 'PASSED' }
    })

    return NextResponse.json({
      hasCompleted: !!latestCheck && latestCheck.status === 'PASSED',
      latestCheck: latestCheck ? {
        id: latestCheck.id,
        status: latestCheck.status,
        confidence: latestCheck.confidence,
        completedAt: latestCheck.completedAt,
        createdAt: latestCheck.createdAt
      } : null,
      stats: {
        total: totalChecks,
        passed: passedChecks
      }
    })

  } catch (error) {
    console.error('Get liveness detection status error:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}
