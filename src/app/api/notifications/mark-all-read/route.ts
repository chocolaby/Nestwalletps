import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { NotificationService } from '@/lib/notifications'

// Mark all notifications as read
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Mark all user's unread notifications as read
    const count = await NotificationService.markAllAsRead(user.id)

    return NextResponse.json({
      successful: true,
      message: `Marked ${count} notifications as read`,
      count
    })

  } catch (error) {
    console.error('marking all notifications as readfailed:', error)
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}
