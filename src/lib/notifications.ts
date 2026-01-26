// 通知服务库
import { prisma } from './prisma'

export type NotificationType = 'TRANSACTION' | 'KYC' | 'SECURITY' | 'SYSTEM'

export interface CreateNotificationData {
  userId: string
  type: NotificationType
  title: string
  message: string
}

export class NotificationService {
  // 创建单个通知
  static async createNotification(data: CreateNotificationData) {
    try {
      // 使用原生SQL插入，避免Prisma客户端问题
      const notificationId = crypto.randomUUID()
      
      await prisma.$executeRaw`
        INSERT INTO notifications (id, user_id, type, title, message, read, created_at, updated_at)
        VALUES (${notificationId}, ${data.userId}, ${data.type}, ${data.title}, ${data.message}, false, datetime('now'), datetime('now'))
      `
      
      return {
        id: notificationId,
        ...data,
        read: false,
        createdAt: new Date()
      }
    } catch (error) {
      console.error('创建通知失败:', error)
      throw error
    }
  }

  // 创建系统通知（发送给所有用户）
  static async createSystemNotification(title: string, message: string) {
    try {
      const users = await prisma.user.findMany({
        select: { id: true }
      })

      const notifications = await Promise.all(
        users.map(user => 
          this.createNotification({
            userId: user.id,
            type: 'SYSTEM',
            title,
            message
          })
        )
      )

      return notifications
    } catch (error) {
      console.error('创建系统通知失败:', error)
      throw error
    }
  }

  // 创建交易通知
  static async createTransactionNotification(
    userId: string, 
    type: 'sent' | 'received' | 'failed',
    amount: string,
    token: string,
    txHash?: string
  ) {
    const titles = {
      sent: '转账成功',
      received: '收到转账',
      failed: '转账失败'
    }

    const messages = {
      sent: `您已成功转出 ${amount} ${token}${txHash ? `，交易哈希: ${txHash}` : ''}`,
      received: `您收到了 ${amount} ${token}${txHash ? `，交易哈希: ${txHash}` : ''}`,
      failed: `转账 ${amount} ${token} 失败，请稍后重试`
    }

    return this.createNotification({
      userId,
      type: 'TRANSACTION',
      title: titles[type],
      message: messages[type]
    })
  }

  // 创建KYC通知
  static async createKYCNotification(
    userId: string,
    status: 'submitted' | 'approved' | 'rejected',
    reason?: string
  ) {
    const titles = {
      submitted: 'KYC文档已提交',
      approved: 'KYC认证通过',
      rejected: 'KYC认证被拒绝'
    }

    const messages = {
      submitted: '您的KYC认证文档已提交，我们将在1-3个工作日内完成审核',
      approved: '恭喜！您的KYC认证已通过，现在可以使用所有功能',
      rejected: `很抱歉，您的KYC认证被拒绝。${reason ? `原因: ${reason}` : '请重新提交正确的文档'}`
    }

    return this.createNotification({
      userId,
      type: 'KYC',
      title: titles[status],
      message: messages[status]
    })
  }

  // 创建安全通知
  static async createSecurityNotification(
    userId: string,
    type: 'login' | 'password_change' | '2fa_enabled' | '2fa_disabled' | 'account_frozen',
    details?: string
  ) {
    const titles = {
      login: '新设备登录',
      password_change: '密码修改成功',
      '2fa_enabled': '两步验证已启用',
      '2fa_disabled': '两步验证已禁用',
      account_frozen: '账户已被冻结'
    }

    const messages = {
      login: `检测到您的账户在新设备登录${details ? `，IP: ${details}` : ''}。如非本人操作请立即修改密码`,
      password_change: '您的账户密码已成功修改。如果这不是您本人的操作，请立即联系客服',
      '2fa_enabled': '您已成功启用两步验证，账户安全性得到提升',
      '2fa_disabled': '您已禁用两步验证。建议重新启用以保护账户安全',
      account_frozen: `您的账户已被管理员冻结${details ? `，原因: ${details}` : ''}。如有疑问请联系客服`
    }

    return this.createNotification({
      userId,
      type: 'SECURITY',
      title: titles[type],
      message: messages[type]
    })
  }

  // 获取用户通知
  static async getUserNotifications(userId: string, options?: {
    type?: NotificationType
    unreadOnly?: boolean
    limit?: number
  }) {
    try {
      const { type, unreadOnly = false, limit = 50 } = options || {}
      
      let whereClause = `user_id = '${userId}'`
      if (type) {
        whereClause += ` AND type = '${type}'`
      }
      if (unreadOnly) {
        whereClause += ` AND read = false`
      }

      const notifications = await prisma.$queryRaw`
        SELECT * FROM notifications 
        WHERE ${whereClause}
        ORDER BY created_at DESC 
        LIMIT ${limit}
      ` as any[]

      return notifications
    } catch (error) {
      console.error('获取用户通知失败:', error)
      return []
    }
  }

  // 标记通知为已读
  static async markAsRead(notificationId: string, userId: string) {
    try {
      await prisma.$executeRaw`
        UPDATE notifications 
        SET read = true, read_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ${notificationId} AND user_id = ${userId}
      `
      return true
    } catch (error) {
      console.error('标记通知已读失败:', error)
      return false
    }
  }

  // 标记所有通知为已读
  static async markAllAsRead(userId: string) {
    try {
      const result = await prisma.$executeRaw`
        UPDATE notifications 
        SET read = true, read_at = datetime('now'), updated_at = datetime('now')
        WHERE user_id = ${userId} AND read = false
      `
      return result
    } catch (error) {
      console.error('标记所有通知已读失败:', error)
      return 0
    }
  }

  // 删除通知
  static async deleteNotification(notificationId: string, userId: string) {
    try {
      await prisma.$executeRaw`
        DELETE FROM notifications 
        WHERE id = ${notificationId} AND user_id = ${userId}
      `
      return true
    } catch (error) {
      console.error('删除通知失败:', error)
      return false
    }
  }

  // 获取未读通知数量
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const result = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM notifications 
        WHERE user_id = ${userId} AND read = false
      ` as any[]
      
      return result[0]?.count || 0
    } catch (error) {
      console.error('获取未读通知数量失败:', error)
      return 0
    }
  }
}
