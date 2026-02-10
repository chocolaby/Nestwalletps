'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface MintRecord {
  id: string
  toAddress: string
  amount: string
  tokenSymbol: string
  reason: string
  txHash: string | null
  createdBy: string
  createdAt: string
}

interface ContractOption {
  id: string
  name: string
  address: string
  network: string
}

export default function MintPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [contractAddress, setContractAddress] = useState('')
  const [contracts, setContracts] = useState<ContractOption[]>([])
  const [toAddress, setToAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('NEST')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [records, setRecords] = useState<MintRecord[]>([])
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    if (user.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }

    fetchRecords()
    fetchContracts()
  }, [user, router])

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/admin/mint/history')
      if (response.ok) {
        const data = await response.json()
        setRecords(data.records || [])
      }
    } catch (error) {
      console.error('获取Mint历史失败:', error)
    }
  }

  const fetchContracts = async () => {
    try {
      const response = await fetch('/api/admin/mint')
      if (response.ok) {
        const data = await response.json()
        setContracts(data.contracts || [])
      }
    } catch (error) {
      console.error('获取合约列表失败:', error)
    }
  }

  const handleMint = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/admin/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress,
          toAddress,
          amount,
          reason
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Mint失败')
      }

      const data = await response.json()
      setSuccess(`成功Mint ${amount} ${tokenSymbol} 到 ${toAddress}`)
      
      // 清空表单
      setToAddress('')
      setAmount('')
      setReason('')
      setShowConfirm(false)
      
      // 刷新记录
      fetchRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mint失败')
    } finally {
      setLoading(false)
    }
  }

  // 地址验证
  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">代币铸造</h1>
            <Button variant="outline" onClick={() => router.push('/admin')}>
              返回管理后台
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Mint表单 */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              铸造新代币
            </h2>

            <div className="space-y-4">
              {/* 选择合约 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择合约
                </label>
                <select
                  value={contracts.some(c => c.address === contractAddress) ? contractAddress : 'manual'}
                  onChange={(e) => {
                    if (e.target.value === 'manual') {
                      setContractAddress('')
                    } else {
                      setContractAddress(e.target.value)
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value="manual">手动输入合约地址</option>
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.address}>
                      {contract.name} ({contract.address.slice(0, 10)}...)
                    </option>
                  ))}
                </select>
              </div>

              {/* 手动输入合约地址 */}
              {!contracts.some(c => c.address === contractAddress) && (
                <Input
                  label="合约地址"
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value)}
                  placeholder="0x..."
                  required
                  disabled={loading}
                />
              )}

              {/* 接收地址 */}
              <Input
                label="接收地址"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="0x..."
                required
                disabled={loading}
              />
              {toAddress && !isValidAddress(toAddress) && (
                <p className="text-sm text-red-600">
                  请输入有效的以太坊地址
                </p>
              )}

              {/* 金额和代币 */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="铸造数量"
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
                    <option value="NEST">NEST</option>
                    <option value="ETH">ETH (测试)</option>
                  </select>
                </div>
              </div>

              {/* 原因说明 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  铸造原因
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="请说明铸造原因..."
                  disabled={loading}
                  required
                />
              </div>

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

              {/* 确认弹窗 */}
              {showConfirm && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h3 className="text-sm font-medium text-yellow-900 mb-2">
                    ⚠️ 请确认铸造信息
                  </h3>
                  <div className="space-y-1 text-sm text-yellow-800 mb-4">
                    <p>合约: {contractAddress}</p>
                    <p>地址: {toAddress}</p>
                    <p>数量: {amount} {tokenSymbol}</p>
                    <p>原因: {reason}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleMint}
                      loading={loading}
                      className="flex-1"
                    >
                      确认铸造
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowConfirm(false)}
                      disabled={loading}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}

              {/* 按钮 */}
              {!showConfirm && (
                <Button
                  onClick={() => setShowConfirm(true)}
                  disabled={
                    !contractAddress ||
                    !isValidAddress(contractAddress) ||
                    !toAddress ||
                    !isValidAddress(toAddress) ||
                    !amount ||
                    parseFloat(amount) <= 0 ||
                    !reason.trim() ||
                    loading
                  }
                  className="w-full"
                >
                  铸造代币
                </Button>
              )}
            </div>

            {/* 说明 */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                🔒 安全提示
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 铸造操作不可撤销，请谨慎操作</li>
                <li>• 所有铸造记录将被永久保存</li>
                <li>• 请确保接收地址正确</li>
                <li>• 铸造原因将记录到审计日志</li>
              </ul>
            </div>
          </div>

          {/* Mint历史 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                铸造历史
              </h2>
            </div>

            {records.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                暂无铸造记录
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {records.map((record) => (
                  <div key={record.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-lg font-semibold text-gray-900">
                            {record.amount} {record.tokenSymbol}
                          </span>
                          <span className="text-sm text-gray-500">
                            → {record.toAddress.slice(0, 6)}...{record.toAddress.slice(-4)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          原因: {record.reason}
                        </p>
                        {record.txHash && (
                          <p className="text-xs text-gray-500 font-mono">
                            TxHash: {record.txHash.slice(0, 10)}...{record.txHash.slice(-8)}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(record.createdAt).toLocaleString('zh-CN')}
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
