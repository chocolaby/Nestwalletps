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

// 获取通知设置
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 从数据库获取用户通知设置
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

    // 如果没有设置记录，返回默认值
    const defaultSettings = {
      emailNotifications: true,
      transactionNotifications: true,
      securityNotifications: true,
      systemNotifications: true,
      marketingNotifications: false
    }

    const userSettings = settings.length > 0 ? settings[0] : defaultSettings

    return NextResponse.json({
      success: true,
      settings: userSettings
    })

  } catch (error) {
    console.error('获取通知设置失败:', error)
    return NextResponse.json({ error: '获取通知设置失败' }, { status: 500 })
  }
}

// 更新通知设置
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const settings = notificationSettingsSchema.parse(body)

    // 使用 UPSERT 操作更新或插入设置
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
      success: true,
      message: '通知设置已更新',
      settings
    })

  } catch (error) {
    console.error('更新通知设置失败:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json({ error: '更新通知设置失败' }, { status: 500 })
  }
}
