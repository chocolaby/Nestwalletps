'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

interface Stats {
  totalUsers: number
  totalWallets: number
  totalTransactions: number
  pendingKyc: number
}

interface User {
  id: string
  email: string
  role: string
  kycStatus: string
  createdAt: string
}

interface KycDocument {
  id: string
  userId: string
  userEmail: string
  documentType: string
  status: string
  createdAt: string
}

export default function AdminPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [pendingKyc, setPendingKyc] = useState<KycDocument[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)

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
  }, [user, router])

  const fetchData = async () => {
    try {
      const [statsRes, usersRes, kycRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users'),
        fetch('/api/admin/kyc/pending')
      ])

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data.stats)
      }

      if (usersRes.ok) {
        const data = await usersRes.json()
        setUsers(data.users || [])
      }

      if (kycRes.ok) {
        const data = await statsRes.json()
        setPendingKyc(data.documents || [])
      }
    } catch (error) {
      console.error('获取管理数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveKyc = async (docId: string) => {
    try {
      const response = await fetch(`/api/admin/kyc/${docId}/approve`, {
        method: 'POST'
      })

      if (response.ok) {
        fetchData() // 刷新数据
      }
    } catch (error) {
      console.error('审批失败:', error)
    }
  }

  const handleRejectKyc = async (docId: string) => {
    const reason = prompt('请输入拒绝原因:')
    if (!reason) return

    try {
      const response = await fetch(`/api/admin/kyc/${docId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      })

      if (response.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('拒绝失败:', error)
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
            <h1 className="text-3xl font-bold text-gray-900">管理员控制台</h1>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              返回Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 统计卡片 */}
          {stats && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">总用户数</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.totalUsers}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">总钱包数</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.totalWallets}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">总交易数</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.totalTransactions}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">待审KYC</dt>
                        <dd className="text-lg font-medium text-gray-900">{stats.pendingKyc}</dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 标签页 */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                概览
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                用户管理
              </button>
              <button
                onClick={() => setActiveTab('kyc')}
                className={`${
                  activeTab === 'kyc'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                KYC审批
              </button>
            </nav>
          </div>

          {/* 用户列表 */}
          {activeTab === 'users' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {users.map((u) => (
                  <li key={u.id}>
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{u.email}</p>
                          <p className="text-sm text-gray-500">
                            {u.role} · KYC: {u.kycStatus}
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-gray-500">
                            {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              const reason = prompt('请输入冻结原因:')
                              if (!reason) return
                              try {
                                await fetch(`/api/admin/user/${u.id}/freeze`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ reason })
                                })
                                alert('账户已冻结')
                                fetchData()
                              } catch (error) {
                                alert('操作失败')
                              }
                            }}
                          >
                            🔒 冻结
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* KYC审批列表 */}
          {activeTab === 'kyc' && (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {pendingKyc.length === 0 ? (
                  <li className="px-4 py-12 text-center text-gray-500">
                    没有待审批的KYC文档
                  </li>
                ) : (
                  pendingKyc.map((doc) => (
                    <li key={doc.id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{doc.userEmail}</p>
                            <p className="text-sm text-gray-500">{doc.documentType}</p>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveKyc(doc.id)}
                            >
                              通过
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectKyc(doc.id)}
                            >
                              拒绝
                            </Button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          {/* 概览页 */}
          {activeTab === 'overview' && (
            <div className="bg-white shadow sm:rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                快速操作
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Button onClick={() => setActiveTab('users')}>
                  👥 用户管理
                </Button>
                <Button onClick={() => setActiveTab('kyc')}>
                  🆔 KYC审批
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/siem')}>
                  🔒 SIEM日志
                </Button>
                <Button variant="outline" onClick={() => router.push('/admin/contracts')}>
                  🏗️ 合约管理
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
