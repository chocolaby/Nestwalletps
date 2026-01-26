import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { NotificationService } from '@/lib/notifications'

// 标记通知为已读
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notificationId = params.id

    // 标记为已读
    const success = await NotificationService.markAsRead(notificationId, user.id)

    if (!success) {
      return NextResponse.json({ error: '通知不存在或操作失败' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: '通知已标记为已读'
    })

  } catch (error) {
    console.error('标记通知已读失败:', error)
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}
