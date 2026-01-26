import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { SiemLogger } from '@/lib/siem'
import { z } from 'zod'

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码'),
  newPassword: z.string().min(8, '新密码至少需要8个字符'),
  confirmPassword: z.string().min(1, '请确认新密码')
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "新密码和确认密码不匹配",
  path: ["confirmPassword"],
})

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword } = changePasswordSchema.parse(body)

    // 获取用户当前密码哈希
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true }
    })

    if (!userRecord) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // 验证当前密码
    const isCurrentPasswordValid = await verifyPassword(currentPassword, userRecord.passwordHash)
    if (!isCurrentPasswordValid) {
      // 记录密码修改失败尝试
      await SiemLogger.logPasswordChangeAttempt(user.id, false, 'Invalid current password')
      
      return NextResponse.json(
        { error: '当前密码不正确' },
        { status: 400 }
      )
    }

    // 检查新密码是否与当前密码相同
    const isSamePassword = await verifyPassword(newPassword, userRecord.passwordHash)
    if (isSamePassword) {
      return NextResponse.json(
        { error: '新密码不能与当前密码相同' },
        { status: 400 }
      )
    }

    // 哈希新密码
    const newPasswordHash = await hashPassword(newPassword)

    // 更新密码
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        passwordHash: newPasswordHash,
        updatedAt: new Date()
      }
    })

    // 记录成功的密码修改
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    await SiemLogger.logPasswordChangeAttempt(user.id, true, 'Password changed successfully', clientIP)

    // TODO: 创建通知 (需要重新生成Prisma客户端后启用)
    // try {
    //   await prisma.notification.create({
    //     data: {
    //       userId: user.id,
    //       type: 'SECURITY',
    //       title: '密码修改成功',
    //       message: '您的账户密码已成功修改。如果这不是您本人的操作，请立即联系客服。',
    //       read: false
    //     }
    //   })
    // } catch (notificationError) {
    //   console.log('创建通知失败，但密码修改成功:', notificationError)
    // }

    return NextResponse.json({
      success: true,
      message: '密码修改成功'
    })

  } catch (error) {
    console.error('Change password error:', error)
    
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
