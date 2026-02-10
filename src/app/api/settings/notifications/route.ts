import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean(),
  transactionNotifications: z.boolean(),
  securityNotifications: z.boolean(),
  systemNotifications: z.boolean(),
  marketingNotifications: z.boolean().optional()
})

// Get notification settings
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user notification settings from database
    const settings = await prisma.$queryRaw`
      SELECT 
        email_notifications as emailNotifications,
        transaction_notifications as transactionNotifications,
        security_notifications as securityNotifications,
        system_notifications as systemNotifications,
        marketing_notifications as marketingNotifications
      FROM user_notification_settings 
      WHERE user_id = ${user.id}
    ` as any[]

    // Return default values if no settings record exists
    const defaultSettings = {
      emailNotifications: true,
      transactionNotifications: true,
      securityNotifications: true,
      systemNotifications: true,
      marketingNotifications: false
    }

    const userSettings = settings.length > 0 ? settings[0] : defaultSettings

    return NextResponse.json({
      successful: true,
      settings: userSettings
    })

  } catch (error) {
    console.error('Failed to get notification settings:', error)
    return NextResponse.json({ error: 'Failed to get notification settings' }, { status: 500 })
  }
}

// Update notification settings
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const settings = notificationSettingsSchema.parse(body)

    // Use UPSERT operation to update or insert settings
    await prisma.$executeRaw`
      INSERT INTO user_notification_settings (
        user_id, 
        email_notifications, 
        transaction_notifications, 
        security_notifications, 
        system_notifications, 
        marketing_notifications,
        created_at,
        updated_at
      ) VALUES (
        ${user.id},
        ${settings.emailNotifications},
        ${settings.transactionNotifications},
        ${settings.securityNotifications},
        ${settings.systemNotifications},
        ${settings.marketingNotifications || false},
        datetime('now'),
        datetime('now')
      )
      ON CONFLICT(user_id) DO UPDATE SET
        email_notifications = excluded.email_notifications,
        transaction_notifications = excluded.transaction_notifications,
        security_notifications = excluded.security_notifications,
        system_notifications = excluded.system_notifications,
        marketing_notifications = excluded.marketing_notifications,
        updated_at = datetime('now')
    `

    return NextResponse.json({
      successful: true,
      message: 'Notification settings updated',
      settings
    })

  } catch (error) {
    console.error('Failed to update notification settings:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: 'Failed to update notification settings' }, { status: 500 })
  }
}
