import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { logSiemEvent } from '@/lib/siem'
import { createNotification } from '@/lib/notifications'
import fs from 'fs'
import path from 'path'

// 活体检测挑战类型
type ChallengeType = 'BLINK' | 'NOD' | 'SHAKE' | 'SMILE'
type ChallengeResult = 'pending' | 'passed' | 'failed'

interface ChallengeData {
  type: ChallengeType
  result: ChallengeResult
}

interface LivenessRequest {
  challenges: ChallengeData[]
  faceImage?: string // base64 编码的人脸图片
  passed: boolean
}

// POST - 提交活体检测结果
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 })
    }

    const userId = payload.userId

    // 解析请求体
    const body: LivenessRequest = await request.json()
    const { challenges, faceImage, passed } = body

    // 验证挑战数据
    if (!challenges || !Array.isArray(challenges) || challenges.length === 0) {
      return NextResponse.json({ error: '无效的检测数据' }, { status: 400 })
    }

    // 计算置信度分数
    const passedCount = challenges.filter(c => c.result === 'passed').length
    const confidence = passedCount / challenges.length

    // 保存人脸图片（如果有）
    let faceImagePath: string | null = null
    if (faceImage && passed) {
      try {
        // 从 base64 提取图片数据
        const base64Data = faceImage.replace(/^data:image\/\w+;base64,/, '')
        const buffer = Buffer.from(base64Data, 'base64')

        // 创建上传目录
        const uploadDir = path.join(process.cwd(), 'uploads', 'liveness', userId)
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true })
        }

        // 保存文件
        const fileName = `face_${Date.now()}.jpg`
        faceImagePath = path.join('uploads', 'liveness', userId, fileName)
        fs.writeFileSync(path.join(process.cwd(), faceImagePath), buffer)
      } catch (err) {
        console.error('保存人脸图片失败:', err)
        // 不影响主流程
      }
    }

    // 获取主要挑战类型（第一个挑战）
    const primaryChallenge = challenges[0]?.type || 'BLINK'

    // 创建活体检测记录
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

    // 如果检测通过，更新用户 KYC 状态
    if (passed) {
      // 检查是否已有通过的文档上传
      const approvedDocs = await prisma.kycDocument.findFirst({
        where: {
          userId,
          status: 'APPROVED'
        }
      })

      // 如果文档已审核通过且活体检测通过，则 KYC 完成
      if (approvedDocs) {
        await prisma.user.update({
          where: { id: userId },
          data: { kycStatus: 'APPROVED' }
        })

        // 发送通知
        await createNotification({
          userId,
          type: 'KYC',
          title: 'KYC 认证完成',
          message: '恭喜！您的身份认证已全部完成，现在可以使用完整功能。'
        })
      } else {
        // 发送通知提示继续完成文档上传
        await createNotification({
          userId,
          type: 'KYC',
          title: '活体检测通过',
          message: '活体检测已通过，请继续上传身份证件以完成 KYC 认证。'
        })
      }
    } else {
      // 检测失败通知
      await createNotification({
        userId,
        type: 'KYC',
        title: '活体检测未通过',
        message: '活体检测未通过，请确保光线充足并按提示完成动作，然后重新尝试。'
      })
    }

    // 记录 SIEM 事件
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
      success: true,
      passed,
      livenessCheckId: livenessCheck.id,
      confidence,
      message: passed ? '活体检测通过' : '活体检测未通过，请重试'
    })

  } catch (error) {
    console.error('活体检测错误:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

// GET - 获取活体检测状态
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: '无效的令牌' }, { status: 401 })
    }

    const userId = payload.userId

    // 获取最新的活体检测记录
    const latestCheck = await prisma.livenessCheck.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    // 获取所有检测记录统计
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
    console.error('获取活体检测状态错误:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}
