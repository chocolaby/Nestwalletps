import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { NotificationService } from '@/lib/notifications'

// Delete notification
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

    // Delete notification
    const successful = await NotificationService.deleteNotification(notificationId, user.id)

    if (!successful) {
      return NextResponse.json({ error: 'Notification does not exist or operation failed' }, { status: 404 })
    }

    return NextResponse.json({
      successful: true,
      message: 'Notification deleted'
    })

  } catch (error) {
    console.error('Failed to delete notification:', error)
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 })
  }
}
