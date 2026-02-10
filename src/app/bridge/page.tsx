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
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed'
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
  const [estimatedTime, setEstimatedTime] = useState('5-10 minutes')

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
      
      // Simulate different chain processing times
      const timeMap: Record<string, string> = {
        'ethereum': '10-15 minutes',
        'bsc': '3-5 minutes',
        'polygon': '2-3 minutes',
        'arbitrum': '1-2 minutes'
      }
      setEstimatedTime(timeMap[toChain] || '5-10 minutes')
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
      console.error('Failed to fetch bridge records:', error)
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
        throw new Error(error.error || 'Bridge failed')
      }

      const data = await response.json()
      setSuccess(`Bridge request submitted! Expected completion in ${estimatedTime}`)
      
      // Clear form
      setAmount('')
      setToAddress('')
      
      // Refresh records
      fetchTransactions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bridge failed')
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
            <h1 className="text-3xl font-bold text-gray-900">🌉 Cross-chain Bridge</h1>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Bridge form */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Cross-chain Transfer
            </h2>

            <div className="space-y-6">
              {/* Chain selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Source Chain
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
                    Target Chain
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

              {/* Amount and token */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Transfer Amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.0"
                  required
                  disabled={loading}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Token
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

              {/* Receiving address */}
              <Input
                label="Receiving Address"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="0x..."
                required
                disabled={loading}
              />

              {/* Fee estimation */}
              {amount && parseFloat(amount) > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">
                    📊 Fee Estimation
                  </h3>
                  <div className="space-y-1 text-sm text-blue-800">
                    <p>Bridge Fee: {estimatedFee} {tokenSymbol}</p>
                    <p>Expected Receipt: {(parseFloat(amount) - parseFloat(estimatedFee)).toFixed(6)} {tokenSymbol}</p>
                    <p>Estimated Time: {estimatedTime}</p>
                  </div>
                </div>
              )}

              {/* Success message */}
              {success && (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="text-sm text-green-700">{success}</div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}

              {/* Button */}
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
                Start Bridge
              </Button>
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-900 mb-2">
                ⚠️ Important Notice
              </h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• This is a simulated demo of the bridge functionality</li>
                <li>• Please ensure the target address supports the selected token</li>
                <li>• Cross-chain transfers are irreversible, please verify information carefully</li>
                <li>• Actual fees may vary due to network congestion</li>
              </ul>
            </div>
          </div>

          {/* Bridge history */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Bridge Records
              </h2>
            </div>

            {transactions.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No bridge records
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
                          To: {tx.toAddress.slice(0, 6)}...{tx.toAddress.slice(-4)}
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
