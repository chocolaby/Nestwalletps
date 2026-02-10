'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

interface LoginHistoryItem {
  id: string
  type: 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT'
  ipAddress: string
  userAgent: string
  location: string
  device: {
    browser: string
    os: string
    device: string
  }
  success: boolean
  riskLevel: string
  timestamp: string
  details: any
}

export default function LoginHistoryPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [history, setHistory] = useState<LoginHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false
  })

  if (!user) {
    router.push('/auth/login')
    return null
  }

  useEffect(() => {
    fetchLoginHistory()
  }, [pagination.offset])

  const fetchLoginHistory = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString()
      })

      const response = await fetch(`/api/auth/login-history?${params}`)
      const data = await response.json()

      if (data.success) {
        setHistory(data.history)
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          hasMore: data.pagination.hasMore
        }))
      }
    } catch (error) {
      console.error('Failed to fetch login history:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    setPagination(prev => ({
      ...prev,
      offset: prev.offset + prev.limit
    }))
  }

  const getTypeIcon = (type: string, success: boolean) => {
    if (type === 'LOGIN') return success ? '✅' : '❌'
    if (type === 'LOGOUT') return '👋'
    return '⚠️'
  }

  const getTypeText = (type: string, success: boolean) => {
    if (type === 'LOGIN') return success ? 'Login Successful' : 'Login Failed'
    if (type === 'LOGOUT') return 'Logout'
    return 'Login Attempt'
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH': return 'text-red-600 bg-red-50'
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50'
      case 'LOW': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">🔐 Login History</h1>
              <p className="text-sm text-gray-500 mt-1">
                View your account login records and security activities
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push('/settings')}>
              Back to Settings
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{pagination.total}</div>
                <div className="text-sm text-gray-500">Total Logins</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {history.filter(h => h.success && h.type === 'LOGIN').length}
                </div>
                <div className="text-sm text-gray-500">Successful Logins</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {history.filter(h => !h.success && h.type === 'LOGIN').length}
                </div>
                <div className="text-sm text-gray-500">Failed Attempts</div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Login Records</h2>
            </div>

            {loading && history.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : history.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">🔐</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Login Records
                </h3>
                <p className="text-gray-500">
                  No login history yet
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {history.map((item) => (
                  <div key={item.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="text-2xl">
                          {getTypeIcon(item.type, item.success)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-medium text-gray-900">
                              {getTypeText(item.type, item.success)}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full ${getRiskColor(item.riskLevel)}`}>
                              {item.riskLevel === 'HIGH' ? 'High Risk' : 
                               item.riskLevel === 'MEDIUM' ? 'Medium Risk' : 'Low Risk'}
                            </span>
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center space-x-4">
                              <span>📍 {item.location}</span>
                              <span>🌐 {item.ipAddress}</span>
                            </div>
                            <div className="flex items-center space-x-4">
                              <span>💻 {item.device.device}</span>
                              <span>🔧 {item.device.browser} on {item.device.os}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatTimestamp(item.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pagination.hasMore && (
              <div className="p-6 border-t border-gray-200 text-center">
                <Button 
                  variant="outline" 
                  onClick={loadMore}
                  loading={loading}
                >
                  Load More
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
