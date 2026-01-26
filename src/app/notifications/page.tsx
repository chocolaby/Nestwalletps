'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

interface Notification {
  id: string
  type: 'transaction' | 'kyc' | 'security' | 'system'
  title: string
  message: string
  read: boolean
  createdAt: string
}

// 模拟通知数据
const mockNotifications: Notification[] = [
  {
    id: '1',
    type: 'transaction',
    title: '转账成功',
    message: '您向 0x1234...5678 转账 100 NEST 已成功',
    read: false,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: '2',
    type: 'kyc',
    title: 'KYC审核通过',
    message: '恭喜！您的KYC认证已通过审核',
    read: true,
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: '3',
    type: 'security',
    title: '新设备登录',
    message: '检测到您的账户在新设备登录，如非本人操作请及时修改密码',
    read: true,
    createdAt: new Date(Date.now() - 172800000).toISOString()
  },
  {
    id: '4',
    type: 'system',
    title: '系统维护通知',
    message: '系统将于今晚23:00-01:00进行维护，期间可能无法使用部分功能',
    read: true,
    createdAt: new Date(Date.now() - 259200000).toISOString()
  }
]

const TYPE_ICONS: Record<string, string> = {
  transaction: '💰',
  kyc: '🆔',
  security: '🔒',
  system: '📢'
}

const TYPE_COLORS: Record<string, string> = {
  transaction: 'bg-green-50 border-green-200',
  kyc: 'bg-blue-50 border-blue-200',
  security: 'bg-red-50 border-red-200',
  system: 'bg-yellow-50 border-yellow-200'
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filterType, setFilterType] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  if (!user) {
    router.push('/auth/login')
    return null
  }

  // 获取通知数据
  useEffect(() => {
    fetchNotifications()
  }, [filterType])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterType !== 'all') {
        params.append('type', filterType)
      }
      
      const response = await fetch(`/api/notifications?${params}`)
      const data = await response.json()
      
      if (data.success) {
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error('获取通知失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'all') return true
    if (filterType === 'unread') return !n.read
    return n.type === filterType
  })

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST'
      })
      
      if (response.ok) {
        setNotifications(notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        ))
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('标记已读失败:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST'
      })
      
      if (response.ok) {
        setNotifications(notifications.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('标记所有已读失败:', error)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/delete`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== id))
        const deletedNotification = notifications.find(n => n.id === id)
        if (deletedNotification && !deletedNotification.read) {
          setUnreadCount(prev => Math.max(0, prev - 1))
        }
      }
    } catch (error) {
      console.error('删除通知失败:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🔔 通知中心</h1>
              <p className="text-sm text-gray-500 mt-1">
                {unreadCount > 0 ? `您有 ${unreadCount} 条未读通知` : '所有通知已读'}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {unreadCount > 0 && (
                <Button variant="outline" onClick={markAllAsRead}>
                  全部标记为已读
                </Button>
              )}
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                返回Dashboard
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 过滤器 */}
          <div className="bg-white shadow rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-2 overflow-x-auto">
              <Button
                size="sm"
                variant={filterType === 'all' ? 'primary' : 'outline'}
                onClick={() => setFilterType('all')}
              >
                全部 ({notifications.length})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'unread' ? 'primary' : 'outline'}
                onClick={() => setFilterType('unread')}
              >
                未读 ({unreadCount})
              </Button>
              <Button
                size="sm"
                variant={filterType === 'transaction' ? 'primary' : 'outline'}
                onClick={() => setFilterType('transaction')}
              >
                💰 交易
              </Button>
              <Button
                size="sm"
                variant={filterType === 'kyc' ? 'primary' : 'outline'}
                onClick={() => setFilterType('kyc')}
              >
                🆔 KYC
              </Button>
              <Button
                size="sm"
                variant={filterType === 'security' ? 'primary' : 'outline'}
                onClick={() => setFilterType('security')}
              >
                🔒 安全
              </Button>
              <Button
                size="sm"
                variant={filterType === 'system' ? 'primary' : 'outline'}
                onClick={() => setFilterType('system')}
              >
                📢 系统
              </Button>
            </div>
          </div>

          {/* 通知列表 */}
          {filteredNotifications.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">🔔</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                暂无通知
              </h3>
              <p className="text-gray-500">
                {filterType === 'unread' ? '所有通知已读' : '还没有收到任何通知'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white border rounded-lg p-6 ${
                    !notification.read ? TYPE_COLORS[notification.type] : 'border-gray-200'
                  } ${!notification.read ? 'shadow-md' : 'shadow'} hover:shadow-lg transition-shadow`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="text-3xl flex-shrink-0">
                        {TYPE_ICONS[notification.type]}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                        </div>
                        <p className="text-gray-600 mb-3">
                          {notification.message}
                        </p>
                        <div className="text-xs text-gray-400">
                          {new Date(notification.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      {!notification.read && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markAsRead(notification.id)}
                        >
                          标记已读
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => deleteNotification(notification.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 说明 */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              💡 <strong>提示：</strong> 这是通知中心的演示版本。实际项目中，通知数据将从后端API获取，并支持实时推送。
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
