'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

interface Transaction {
  id: string
  fromAddress: string
  toAddress: string
  amount: string
  tokenSymbol: string
  status: string
  txHash: string | null
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待处理',
  CONFIRMED: '已确认',
  FAILED: '失败'
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800'
}

export default function TransactionsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const walletId = searchParams.get('wallet')
  
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'sent' | 'received'>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }
    
    fetchTransactions()
  }, [user, router])

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/transaction/history')
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions || [])
      }
    } catch (error) {
      console.error('获取交易记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = transactions.filter(tx => {
    if (filterStatus !== 'all' && tx.status !== filterStatus) return false
    if (filterType === 'sent' && tx.fromAddress === 'MINT') return false
    if (filterType === 'received' && tx.fromAddress !== 'MINT') return false
    return true
  })

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
            <h1 className="text-3xl font-bold text-gray-900">📊 交易记录</h1>
            <div className="flex items-center space-x-3">
              <Button onClick={() => router.push('/transfer')}>
                📤 发起转账
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                返回Dashboard
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="text-3xl">📈</div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        总交易数
                      </dt>
                      <dd className="text-2xl font-semibold text-gray-900">
                        {transactions.length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="text-3xl">✅</div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        成功交易
                      </dt>
                      <dd className="text-2xl font-semibold text-green-600">
                        {transactions.filter(t => t.status === 'CONFIRMED').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="text-3xl">⏳</div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        待确认
                      </dt>
                      <dd className="text-2xl font-semibold text-yellow-600">
                        {transactions.filter(t => t.status === 'PENDING').length}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 过滤器 */}
          <div className="bg-white shadow rounded-lg p-4 mb-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  交易类型
                </label>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant={filterType === 'all' ? 'primary' : 'outline'}
                    onClick={() => setFilterType('all')}
                  >
                    全部
                  </Button>
                  <Button
                    size="sm"
                    variant={filterType === 'sent' ? 'primary' : 'outline'}
                    onClick={() => setFilterType('sent')}
                  >
                    转出
                  </Button>
                  <Button
                    size="sm"
                    variant={filterType === 'received' ? 'primary' : 'outline'}
                    onClick={() => setFilterType('received')}
                  >
                    转入
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  状态
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">全部状态</option>
                  <option value="PENDING">待处理</option>
                  <option value="CONFIRMED">已确认</option>
                  <option value="FAILED">失败</option>
                </select>
              </div>
            </div>
          </div>

          {/* 交易列表 */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">
                交易列表 ({filteredTransactions.length})
              </h3>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                暂无交易记录
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredTransactions.map((tx) => (
                  <li key={tx.id} className="px-4 py-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[tx.status] || 'bg-gray-100 text-gray-800'}`}>
                            {STATUS_LABELS[tx.status] || tx.status}
                          </span>
                          <span className="text-lg font-semibold text-gray-900">
                            {tx.fromAddress === 'MINT' ? '➕' : '➡️'} {tx.amount} {tx.tokenSymbol}
                          </span>
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500">发送方:</span>
                            <span className="font-mono">
                              {tx.fromAddress === 'MINT' ? '系统铸造' : `${tx.fromAddress.slice(0, 8)}...${tx.fromAddress.slice(-6)}`}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500">接收方:</span>
                            <span className="font-mono">
                              {tx.toAddress.slice(0, 8)}...{tx.toAddress.slice(-6)}
                            </span>
                          </div>
                          {tx.txHash && (
                            <div className="flex items-center space-x-2">
                              <span className="text-gray-500">TxHash:</span>
                              <span className="font-mono text-xs">
                                {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(tx.txHash!)
                                  alert('TxHash已复制')
                                }}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                📋
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-gray-400">
                          {new Date(tx.createdAt).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
