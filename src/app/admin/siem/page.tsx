'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

interface SiemEvent {
  id: string
  userId: string | null
  eventType: string
  details: string
  riskLevel: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  LOGIN: '登录',
  LOGOUT: '登出',
  TRANSACTION: '交易',
  WALLET_CREATED: '创建钱包',
  KYC_SUBMITTED: 'KYC提交',
  KYC_APPROVED: 'KYC通过',
  KYC_REJECTED: 'KYC拒绝',
  ADMIN_ACTION: '管理操作',
  SECURITY_ALERT: '安全告警'
}

const RISK_COLORS: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  CRITICAL: 'bg-red-100 text-red-800'
}

export default function SiemDashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [events, setEvents] = useState<SiemEvent[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterRisk, setFilterRisk] = useState<string>('all')

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    if (user.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }

    fetchData()
  }, [user, router, filterType, filterRisk])

  const fetchData = async () => {
    try {
      const queryParams = new URLSearchParams()
      if (filterType !== 'all') queryParams.append('eventType', filterType)
      if (filterRisk !== 'all') queryParams.append('riskLevel', filterRisk)

      const [eventsRes, statsRes] = await Promise.all([
        fetch(`/api/admin/siem/logs?${queryParams}`),
        fetch('/api/admin/siem/stats')
      ])

      if (eventsRes.ok) {
        const data = await eventsRes.json()
        setEvents(data.logs || [])
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('获取SIEM数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">SIEM 安全监控</h1>
            <Button variant="outline" onClick={() => router.push('/admin')}>
              返回管理后台
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 统计卡片 */}
          {stats && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-4 mb-8">
              <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                <div className="text-sm font-medium text-gray-500">总事件数</div>
                <div className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalEvents}</div>
              </div>
              <div className="bg-green-50 overflow-hidden shadow rounded-lg p-5">
                <div className="text-sm font-medium text-green-700">低风险</div>
                <div className="mt-1 text-3xl font-semibold text-green-900">{stats.lowRisk}</div>
              </div>
              <div className="bg-yellow-50 overflow-hidden shadow rounded-lg p-5">
                <div className="text-sm font-medium text-yellow-700">中风险</div>
                <div className="mt-1 text-3xl font-semibold text-yellow-900">{stats.mediumRisk}</div>
              </div>
              <div className="bg-red-50 overflow-hidden shadow rounded-lg p-5">
                <div className="text-sm font-medium text-red-700">高风险</div>
                <div className="mt-1 text-3xl font-semibold text-red-900">{stats.highRisk}</div>
              </div>
            </div>
          )}

          {/* 过滤器 */}
          <div className="bg-white shadow rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  事件类型
                </label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全部</option>
                  {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  风险等级
                </label>
                <select
                  value={filterRisk}
                  onChange={(e) => setFilterRisk(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全部</option>
                  <option value="LOW">低风险</option>
                  <option value="MEDIUM">中风险</option>
                  <option value="HIGH">高风险</option>
                  <option value="CRITICAL">严重</option>
                </select>
              </div>
            </div>
          </div>

          {/* 事件列表 */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">
                安全事件日志
              </h3>
            </div>
            <ul className="divide-y divide-gray-200">
              {events.length === 0 ? (
                <li className="px-4 py-12 text-center text-gray-500">
                  暂无事件记录
                </li>
              ) : (
                events.map((event) => (
                  <li key={event.id} className="px-4 py-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${RISK_COLORS[event.riskLevel] || 'bg-gray-100 text-gray-800'}`}>
                            {event.riskLevel}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {event.details && (
                            <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(JSON.parse(event.details), null, 2)}
                            </pre>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          {event.ipAddress && (
                            <span>IP: {event.ipAddress}</span>
                          )}
                          <span>{new Date(event.createdAt).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* 刷新按钮 */}
          <div className="mt-6">
            <Button onClick={() => fetchData()}>
              刷新数据
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
