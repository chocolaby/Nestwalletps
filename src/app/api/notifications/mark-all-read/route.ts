import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { NotificationService } from '@/lib/notifications'

// 标记所有通知为已读
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 标记用户所有未读通知为已读
    const count = await NotificationService.markAllAsRead(user.id)

    return NextResponse.json({
      success: true,
      message: `已标记 ${count} 条通知为已读`,
      count
    })

  } catch (error) {
    console.error('标记所有通知已读失败:', error)
    return NextResponse.json({ error: '操作失败' }, { status: 500 })
  }
}
