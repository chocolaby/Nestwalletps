import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { NotificationService } from '@/lib/notifications'
import { z } from 'zod'

const createNotificationSchema = z.object({
  type: z.enum(['TRANSACTION', 'KYC', 'SECURITY', 'SYSTEM']),
  title: z.string().min(1, 'Title cannot be empty'),
  message: z.string().min(1, 'Message cannot be empty'),
  userId: z.string().optional()
})

// Get user notification list
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
      successful: true,
      notifications,
      unreadCount
    })

  } catch (error) {
    console.error('Failed to get notifications:', error)
    return NextResponse.json({ error: 'Failed to get notifications' }, { status: 500 })
  }
}

// Create notification (admin feature)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { type, title, message, userId } = createNotificationSchema.parse(body)

    // If userId is specified, send to specific user, otherwise send to all users
    if (userId) {
      const notification = await NotificationService.createNotification({
        userId,
        type,
        title,
        message
      })
      
      return NextResponse.json({
        successful: true,
        notification
      })
    } else {
      // Send to all users
      const notifications = await NotificationService.createSystemNotification(title, message)

      return NextResponse.json({
        successful: true,
        message: `Sent notification to ${notifications.length} users`,
        count: notifications.length
      })
    }

  } catch (error) {
    console.error('Failed to create notification:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'creating notification failed' }, { status: 500 })
  }
}
