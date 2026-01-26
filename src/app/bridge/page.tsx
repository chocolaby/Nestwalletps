'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface BridgeTransaction {
  id: string
  fromChain: string
  toChain: string
  fromAddress: string
  toAddress: string
  amount: string
  tokenSymbol: string
  status: string
  createdAt: string
  estimatedTime: string
  fee: string
}

const SUPPORTED_CHAINS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'bsc', name: 'BSC', symbol: 'BNB' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH' }
]

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  COMPLETED: '已完成',
  FAILED: '失败'
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800'
}

export default function BridgePage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [fromChain, setFromChain] = useState('ethereum')
  const [toChain, setToChain] = useState('bsc')
  const [amount, setAmount] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('USDT')
  const [toAddress, setToAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [transactions, setTransactions] = useState<BridgeTransaction[]>([])
  const [estimatedFee, setEstimatedFee] = useState('0.005')
  const [estimatedTime, setEstimatedTime] = useState('5-10分钟')

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }
    fetchTransactions()
  }, [user, router])

  // 模拟费用计算
  useEffect(() => {
    if (amount && parseFloat(amount) > 0) {
      const baseAmount = parseFloat(amount)
      const feePercentage = fromChain === 'ethereum' ? 0.003 : 0.001
      const calculatedFee = Math.max(baseAmount * feePercentage, 0.001)
      setEstimatedFee(calculatedFee.toFixed(6))
      
      // 模拟不同链的处理时间
      const timeMap: Record<string, string> = {
        'ethereum': '10-15分钟',
        'bsc': '3-5分钟',
        'polygon': '2-3分钟',
        'arbitrum': '1-2分钟'
      }
      setEstimatedTime(timeMap[toChain] || '5-10分钟')
    }
  }, [amount, fromChain, toChain])

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/bridge/transactions')
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions || [])
      }
    } catch (error) {
      console.error('获取桥接记录失败:', error)
    }
  }

  const handleBridge = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/bridge/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromChain,
          toChain,
          amount,
          tokenSymbol,
          toAddress
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '桥接失败')
      }

      const data = await response.json()
      setSuccess(`桥接请求已提交！预计 ${estimatedTime} 内完成`)
      
      // 清空表单
      setAmount('')
      setToAddress('')
      
      // 刷新记录
      fetchTransactions()
    } catch (err) {
      setError(err instanceof Error ? err.message : '桥接失败')
    } finally {
      setLoading(false)
    }
  }

  const getChainName = (chainId: string) => {
    return SUPPORTED_CHAINS.find(chain => chain.id === chainId)?.name || chainId
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">🌉 跨链桥接</h1>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              返回Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 桥接表单 */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              跨链转账
            </h2>

            <div className="space-y-6">
              {/* 链选择 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    源链
                  </label>
                  <select
                    value={fromChain}
                    onChange={(e) => setFromChain(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  >
                    {SUPPORTED_CHAINS.map((chain) => (
                      <option key={chain.id} value={chain.id}>
                        {chain.name} ({chain.symbol})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    目标链
                  </label>
                  <select
                    value={toChain}
                    onChange={(e) => setToChain(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  >
                    {SUPPORTED_CHAINS.filter(chain => chain.id !== fromChain).map((chain) => (
                      <option key={chain.id} value={chain.id}>
                        {chain.name} ({chain.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 金额和代币 */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="转账金额"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  required
                  disabled={loading}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    代币
                  </label>
                  <select
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  >
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                    <option value="ETH">ETH</option>
                    <option value="BNB">BNB</option>
                  </select>
                </div>
              </div>

              {/* 接收地址 */}
              <Input
                label="接收地址"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="0x..."
                required
                disabled={loading}
              />

              {/* 费用预估 */}
              {amount && parseFloat(amount) > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">
                    📊 费用预估
                  </h3>
                  <div className="space-y-1 text-sm text-blue-800">
                    <p>桥接费用: {estimatedFee} {tokenSymbol}</p>
                    <p>预计到账: {(parseFloat(amount) - parseFloat(estimatedFee)).toFixed(6)} {tokenSymbol}</p>
                    <p>预计时间: {estimatedTime}</p>
                  </div>
                </div>
              )}

              {/* 成功提示 */}
              {success && (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="text-sm text-green-700">{success}</div>
                </div>
              )}

              {/* 错误提示 */}
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              {/* 按钮 */}
              <Button
                onClick={handleBridge}
                disabled={
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  !toAddress ||
                  fromChain === toChain ||
                  loading
                }
                loading={loading}
                className="w-full"
              >
                开始桥接
              </Button>
            </div>

            {/* 说明 */}
            <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-900 mb-2">
                ⚠️ 重要提示
              </h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• 这是桥接功能的模拟演示</li>
                <li>• 请确保目标地址支持所选代币</li>
                <li>• 跨链转账不可撤销，请仔细核对信息</li>
                <li>• 实际费用可能因网络拥堵而变化</li>
              </ul>
            </div>
          </div>

          {/* 桥接历史 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                桥接记录
              </h2>
            </div>

            {transactions.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                暂无桥接记录
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {transactions.map((tx) => (
                  <div key={tx.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-lg font-semibold text-gray-900">
                            {tx.amount} {tx.tokenSymbol}
                          </span>
                          <span className="text-sm text-gray-500">
                            {getChainName(tx.fromChain)} → {getChainName(tx.toChain)}
                          </span>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[tx.status] || 'bg-gray-100 text-gray-800'}`}>
                            {STATUS_LABELS[tx.status] || tx.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          到: {tx.toAddress.slice(0, 6)}...{tx.toAddress.slice(-4)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(tx.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
