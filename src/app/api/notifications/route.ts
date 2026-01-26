import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { NotificationService } from '@/lib/notifications'
import { z } from 'zod'

const createNotificationSchema = z.object({
  type: z.enum(['TRANSACTION', 'KYC', 'SECURITY', 'SYSTEM']),
  title: z.string().min(1, '标题不能为空'),
  message: z.string().min(1, '消息不能为空'),
  userId: z.string().optional()
})

// 获取用户通知列表
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type')
    const unreadOnly = searchParams.get('unread') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')

    const notifications = await NotificationService.getUserNotifications(user.id, {
      type: type?.toUpperCase() as any,
      unreadOnly,
      limit
    })

    const unreadCount = await NotificationService.getUnreadCount(user.id)

    return NextResponse.json({
      success: true,
      notifications,
      unreadCount
    })

  } catch (error) {
    console.error('获取通知失败:', error)
    return NextResponse.json({ error: '获取通知失败' }, { status: 500 })
  }
}

// 创建通知（管理员功能）
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { type, title, message, userId } = createNotificationSchema.parse(body)

    // 如果指定了userId，发送给特定用户，否则发送给所有用户
    if (userId) {
      const notification = await NotificationService.createNotification({
        userId,
        type,
        title,
        message
      })
      
      return NextResponse.json({
        success: true,
        notification
      })
    } else {
      // 发送给所有用户
      const notifications = await NotificationService.createSystemNotification(title, message)

      return NextResponse.json({
        success: true,
        message: `已向 ${notifications.length} 个用户发送通知`,
        count: notifications.length
      })
    }

  } catch (error) {
    console.error('创建通知失败:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: '创建通知失败' }, { status: 500 })
  }
}
