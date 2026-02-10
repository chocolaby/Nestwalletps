'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

interface HSMKey {
  keyId: string
  type: string
  address: string
  usage: string
}

interface SigningRequest {
  id: string
  userId: string
  transactionData: any
  requiredApprovals: number
  currentApprovals: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SIGNED'
  createdAt: string
  expiresAt: string
}

interface SigningApproval {
  requestId: string
  approverId: string
  approved: boolean
  comment?: string
  timestamp: string
}

export default function HSMDashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [hsmStatus, setHsmStatus] = useState<any>(null)
  const [pendingRequests, setPendingRequests] = useState<SigningRequest[]>([])
  const [userRequests, setUserRequests] = useState<SigningRequest[]>([])
  const [selectedRequest, setSelectedRequest] = useState<SigningRequest | null>(null)
  const [approvals, setApprovals] = useState<SigningApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
    
    let pollInterval = 5000 // Start with 5 seconds
    let intervalId: NodeJS.Timeout
    
    const poll = async () => {
      await fetchHSMStatus()
      
      // Adjust polling interval based on pending requests
      if (pendingRequests.length > 0) {
        pollInterval = 3000 // Poll faster when there are pending requests
      } else {
        pollInterval = 10000 // Poll slower when idle
      }
      
      intervalId = setTimeout(poll, pollInterval)
    }
    
    poll() // Initial fetch
    
    return () => {
      if (intervalId) clearTimeout(intervalId)
    }
  }, [user, router, pendingRequests.length])

  const fetchHSMStatus = async () => {
    try {
      const [statusRes, pendingRes, userReqRes] = await Promise.all([
        fetch('/api/admin/hsm'),
        fetch('/api/admin/hsm?action=pending'),
        fetch('/api/admin/hsm?action=user-requests')
      ])

      if (statusRes.ok) {
        const data = await statusRes.json()
        setHsmStatus(data.hsmStatus)
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json()
        setPendingRequests(data.requests || [])
      }

      if (userReqRes.ok) {
        const data = await userReqRes.json()
        setUserRequests(data.requests || [])
      }
    } catch (error) {
      console.error('获取HSM状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRequestDetails = async (requestId: string) => {
    try {
      const response = await fetch(`/api/admin/hsm?action=request-details&requestId=${requestId}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedRequest(data.request)
        setApprovals(data.approvals || [])
      }
    } catch (error) {
      console.error('获取请求详情失败:', error)
    }
  }

  const handleApprove = async (requestId: string, approved: boolean) => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/admin/hsm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          requestId,
          approved,
          comment: approved ? 'Approved by admin' : 'Rejected by admin'
        })
      })

      if (response.ok) {
        alert(approved ? '请求已批准' : '请求已拒绝')
        fetchHSMStatus()
        if (selectedRequest?.id === requestId) {
          fetchRequestDetails(requestId)
        }
      } else {
        const error = await response.json()
        alert(error.error || '操作失败')
      }
    } catch (error) {
      alert('操作失败')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSign = async (requestId: string) => {
    setActionLoading(true)
    try {
      const response = await fetch('/api/admin/hsm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign',
          requestId,
          keyType: 'platform'
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`签名成功！\n签名: ${data.signingResult.signature.slice(0, 20)}...`)
        fetchHSMStatus()
        if (selectedRequest?.id === requestId) {
          fetchRequestDetails(requestId)
        }
      } else {
        const error = await response.json()
        alert(error.error || '签名失败')
      }
    } catch (error) {
      alert('签名失败')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      case 'SIGNED': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
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
            <h1 className="text-3xl font-bold text-gray-900">🔐 HSM/MPC 签名管理</h1>
            <Button variant="outline" onClick={() => router.push('/admin')}>
              返回管理后台
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* HSM Status Cards */}
          {hsmStatus && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
              <div className="bg-white overflow-hidden shadow rounded-lg p-5">
                <div className="flex items-center">
                  <div className={`rounded-full h-3 w-3 ${hsmStatus.online ? 'bg-green-500' : 'bg-red-500'} mr-3`}></div>
                  <div className="text-sm font-medium text-gray-500">HSM 状态</div>
                </div>
                <div className="mt-1 text-3xl font-semibold text-gray-900">
                  {hsmStatus.online ? '在线' : '离线'}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {hsmStatus.keyCount} 个密钥可用
                </div>
              </div>
              
              <div className="bg-yellow-50 overflow-hidden shadow rounded-lg p-5">
                <div className="text-sm font-medium text-yellow-700">待批准请求</div>
                <div className="mt-1 text-3xl font-semibold text-yellow-900">
                  {pendingRequests.length}
                </div>
              </div>
              
              <div className="bg-blue-50 overflow-hidden shadow rounded-lg p-5">
                <div className="text-sm font-medium text-blue-700">我的请求</div>
                <div className="mt-1 text-3xl font-semibold text-blue-900">
                  {userRequests.length}
                </div>
              </div>
            </div>
          )}

          {/* HSM Keys */}
          {hsmStatus?.availableKeys && (
            <div className="bg-white shadow rounded-lg mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">HSM 密钥列表</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {hsmStatus.availableKeys.map((key: HSMKey) => (
                    <div key={key.keyId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{key.keyId}</span>
                        <span className="inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                          {key.type}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 font-mono mb-1">
                        {key.address}
                      </div>
                      <div className="text-xs text-gray-500">
                        {key.usage}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Pending Signing Requests */}
          <div className="bg-white shadow rounded-lg mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">待批准的签名请求</h2>
            </div>
            
            {pendingRequests.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                暂无待批准的签名请求
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            请求 ID: {request.id.slice(0, 8)}...
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(request.transactionData, null, 2)}
                          </pre>
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>需要批准: {request.requiredApprovals}</span>
                          <span>当前批准: {request.currentApprovals}</span>
                          <span>{new Date(request.createdAt).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fetchRequestDetails(request.id)}
                        >
                          详情
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request.id, true)}
                          loading={actionLoading}
                        >
                          批准
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(request.id, false)}
                          loading={actionLoading}
                        >
                          拒绝
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User's Signing Requests */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">我的签名请求历史</h2>
            </div>
            
            {userRequests.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                暂无签名请求历史
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {userRequests.map((request) => (
                  <div key={request.id} className="px-6 py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            请求 ID: {request.id.slice(0, 8)}...
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          操作: {request.transactionData?.operation || 'Unknown'}
                        </div>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>批准: {request.currentApprovals}/{request.requiredApprovals}</span>
                          <span>{new Date(request.createdAt).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        {request.status === 'APPROVED' && (
                          <Button
                            size="sm"
                            onClick={() => handleSign(request.id)}
                            loading={actionLoading}
                          >
                            执行签名
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fetchRequestDetails(request.id)}
                        >
                          详情
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Request Details Modal */}
          {selectedRequest && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">签名请求详情</h3>
                    <button
                      onClick={() => setSelectedRequest(null)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                
                <div className="px-6 py-4">
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium text-gray-500">请求 ID</div>
                      <div className="mt-1 text-sm text-gray-900 font-mono">{selectedRequest.id}</div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-gray-500">状态</div>
                      <div className="mt-1">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusColor(selectedRequest.status)}`}>
                          {selectedRequest.status}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-gray-500">批准进度</div>
                      <div className="mt-1 text-sm text-gray-900">
                        {selectedRequest.currentApprovals} / {selectedRequest.requiredApprovals}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-gray-500">交易数据</div>
                      <div className="mt-1">
                        <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                          {JSON.stringify(selectedRequest.transactionData, null, 2)}
                        </pre>
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-gray-500">创建时间</div>
                      <div className="mt-1 text-sm text-gray-900">
                        {new Date(selectedRequest.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    
                    {approvals.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-500 mb-2">批准记录</div>
                        <div className="space-y-2">
                          {approvals.map((approval, index) => (
                            <div key={index} className="border border-gray-200 rounded p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  {approval.approved ? '✓ 已批准' : '✗ 已拒绝'}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(approval.timestamp).toLocaleString('zh-CN')}
                                </span>
                              </div>
                              {approval.comment && (
                                <div className="mt-1 text-xs text-gray-600">
                                  {approval.comment}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                  <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                    关闭
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
