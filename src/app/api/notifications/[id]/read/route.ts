import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { NotificationService } from '@/lib/notifications'

// Mark notification as read
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

    // Mark as read
    const successful = await NotificationService.markAsRead(notificationId, user.id)

    if (!successful) {
      return NextResponse.json({ error: 'Notification does not exist or operation failed' }, { status: 404 })
    }

    return NextResponse.json({
      successful: true,
      message: 'Notification marked as read'
    })

  } catch (error) {
    console.error('Failed to mark notification as read:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
