import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { NotificationService } from '@/lib/notifications'

// 删除通知
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const notificationId = params.id

    // 删除通知
    const success = await NotificationService.deleteNotification(notificationId, user.id)

    if (!success) {
      return NextResponse.json({ error: '通知不存在或操作失败' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: '通知已删除'
    })

  } catch (error) {
    console.error('删除通知失败:', error)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
