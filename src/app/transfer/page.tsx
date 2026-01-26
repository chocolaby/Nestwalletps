'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Wallet {
  id: string
  address: string
  type: string
}

export default function TransferPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [fromWallet, setFromWallet] = useState('')
  const [toAddress, setToAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [tokenSymbol, setTokenSymbol] = useState('ETH')
  const [loading, setLoading] = useState(false)
  const [estimating, setEstimating] = useState(false)
  const [error, setError] = useState('')
  const [gasEstimate, setGasEstimate] = useState<any>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }
    fetchWallets()
  }, [user, router])

  const fetchWallets = async () => {
    try {
      console.log('📡 正在获取钱包列表...')
      const response = await fetch('/api/wallet/list', {
        credentials: 'include'
      })
      console.log('📡 响应状态:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('📡 钱包数据:', data)
        setWallets(data.wallets || [])
        if (data.wallets?.length > 0) {
          setFromWallet(data.wallets[0].id)
        }
      } else {
        console.log('📡 响应失败:', await response.text())
      }
    } catch (error) {
      console.error('获取钱包列表失败:', error)
    }
  }

  const estimateGas = async () => {
    if (!fromWallet || !toAddress || !amount) return

    setEstimating(true)
    setError('')

    try {
      const wallet = wallets.find(w => w.id === fromWallet)
      if (!wallet) throw new Error('未找到钱包')

      const response = await fetch('/api/transaction/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          from: wallet.address,
          to: toAddress,
          amount,
          token: tokenSymbol
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Gas估算失败')
      }

      const data = await response.json()
      setGasEstimate(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gas估算失败')
    } finally {
      setEstimating(false)
    }
  }

  const handleSubmit = async () => {
    if (!fromWallet || !toAddress || !amount) {
      setError('请填写所有必填字段')
      return
    }

    setLoading(true)
    setError('')

    try {
      const wallet = wallets.find(w => w.id === fromWallet)
      if (!wallet) throw new Error('未找到钱包')

      const response = await fetch('/api/transaction/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fromWalletId: fromWallet,
          from: wallet.address,
          to: toAddress,
          amount,
          tokenSymbol,
          gasLimit: gasEstimate?.gasLimit || '21000',
          gasPrice: gasEstimate?.gasPrice || '20000000000'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '转账失败')
      }

      const data = await response.json()
      
      // 跳转到交易详情或Dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : '转账失败')
    } finally {
      setLoading(false)
    }
  }

  // 地址验证
  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  // 金额验证
  const isValidAmount = (amt: string) => {
    return /^\d+(\.\d+)?$/.test(amt) && parseFloat(amt) > 0
  }

  const selectedWallet = wallets.find(w => w.id === fromWallet)

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">转账</h1>
          <p className="mt-2 text-gray-600">
            向其他地址发送ETH或代币
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {/* 选择钱包 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              从钱包
            </label>
            <select
              value={fromWallet}
              onChange={(e) => setFromWallet(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)} ({wallet.type === 'CUSTODIAL' ? '托管' : '非托管'})
                </option>
              ))}
            </select>
            {selectedWallet && (
              <p className="mt-1 text-xs text-gray-500 font-mono">
                {selectedWallet.address}
              </p>
            )}
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
          {toAddress && !isValidAddress(toAddress) && (
            <p className="mt-1 text-sm text-red-600">
              请输入有效的以太坊地址
            </p>
          )}

          {/* 金额和代币 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Input
              label="金额"
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
                <option value="ETH">ETH</option>
                <option value="NEST">NEST</option>
              </select>
            </div>
          </div>

          {/* Gas估算 */}
          {!gasEstimate && isValidAddress(toAddress) && isValidAmount(amount) && (
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={estimateGas}
                loading={estimating}
                disabled={loading}
              >
                估算Gas费用
              </Button>
            </div>
          )}

          {gasEstimate && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                Gas估算
              </h3>
              <div className="space-y-1 text-sm text-blue-800">
                <div className="flex justify-between">
                  <span>Gas Limit:</span>
                  <span className="font-mono">{gasEstimate.gasLimit}</span>
                </div>
                <div className="flex justify-between">
                  <span>Gas Price:</span>
                  <span className="font-mono">{(parseInt(gasEstimate.gasPrice) / 1e9).toFixed(2)} Gwei</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>预估费用:</span>
                  <span className="font-mono">{gasEstimate.totalCost} ETH</span>
                </div>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* 确认弹窗 */}
          {showConfirm && (
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="text-sm font-medium text-yellow-900 mb-2">
                ⚠️ 请确认交易信息
              </h3>
              <div className="space-y-1 text-sm text-yellow-800">
                <p>从: {selectedWallet?.address}</p>
                <p>到: {toAddress}</p>
                <p>金额: {amount} {tokenSymbol}</p>
                {gasEstimate && (
                  <p>Gas费用: {gasEstimate.totalCost} ETH</p>
                )}
              </div>
              <div className="mt-4 flex space-x-2">
                <Button
                  onClick={handleSubmit}
                  loading={loading}
                  className="flex-1"
                >
                  确认转账
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
            <div className="flex space-x-4">
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={
                  !fromWallet ||
                  !toAddress ||
                  !isValidAddress(toAddress) ||
                  !amount ||
                  !isValidAmount(amount) ||
                  loading
                }
                className="flex-1"
              >
                发送
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
                disabled={loading}
              >
                取消
              </Button>
            </div>
          )}

          {/* 安全提示 */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              🔒 安全提示
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• 请仔细核对接收地址，交易无法撤回</li>
              <li>• 确保有足够的余额支付Gas费用</li>
              <li>• 不要向未知地址转账</li>
              <li>• 大额转账建议先小额测试</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
