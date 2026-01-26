'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface FiatOrder {
  id: string
  type: string
  amount: string
  currency: string
  status: string
  bankAccount: string
  createdAt: string
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待处理',
  PROCESSING: '处理中',
  COMPLETED: '已完成',
  FAILED: '失败',
  CANCELLED: '已取消'
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800'
}

export default function FiatPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('CNY')
  const [paymentMethod, setPaymentMethod] = useState<'BANK_CARD' | 'ALIPAY' | 'WECHAT'>('BANK_CARD')
  const [bankAccount, setBankAccount] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [orders, setOrders] = useState<FiatOrder[]>([])

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    fetchOrders()
  }, [user, router])

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/fiat/orders')
      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders || [])
      }
    } catch (error) {
      console.error('获取订单失败:', error)
    }
  }

  const handleDeposit = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/fiat/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency,
          paymentMethod,
          bankAccount,
          bankName
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '入金失败')
      }

      const data = await response.json()
      setSuccess(`入金申请已提交！订单号: ${data.order.id}`)
      
      // 清空表单
      setAmount('')
      setBankAccount('')
      setBankName('')
      setAccountHolder('')
      
      // 刷新订单
      fetchOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : '入金失败')
    } finally {
      setLoading(false)
    }
  }

  const handleWithdraw = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/fiat/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency,
          paymentMethod,
          bankAccount,
          bankName,
          accountHolder
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '出金失败')
      }

      const data = await response.json()
      setSuccess(`出金申请已提交！订单号: ${data.order.id}`)
      
      // 清空表单
      setAmount('')
      setBankAccount('')
      setBankName('')
      setAccountHolder('')
      
      // 刷新订单
      fetchOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : '出金失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">法币通道</h1>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              返回Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* 标签页 */}
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setActiveTab('deposit')}
                  className={`${
                    activeTab === 'deposit'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
                >
                  💰 入金
                </button>
                <button
                  onClick={() => setActiveTab('withdraw')}
                  className={`${
                    activeTab === 'withdraw'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
                >
                  💸 出金
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* 表单 */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="金额"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    disabled={loading}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      币种
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loading}
                    >
                      <option value="CNY">CNY (人民币)</option>
                      <option value="USD">USD (美元)</option>
                      <option value="EUR">EUR (欧元)</option>
                    </select>
                  </div>
                </div>

                {/* 支付方式选择 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    支付方式
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('BANK_CARD')}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${
                        paymentMethod === 'BANK_CARD'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      disabled={loading}
                    >
                      <div className="text-xl mb-1">🏦</div>
                      <div className="text-xs font-medium">银行卡</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('ALIPAY')}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${
                        paymentMethod === 'ALIPAY'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      disabled={loading}
                    >
                      <div className="text-xl mb-1">💳</div>
                      <div className="text-xs font-medium">支付宝</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('WECHAT')}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${
                        paymentMethod === 'WECHAT'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      disabled={loading}
                    >
                      <div className="text-xl mb-1">💬</div>
                      <div className="text-xs font-medium">微信</div>
                    </button>
                  </div>
                </div>

                <Input
                  label="银行账号"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="请输入银行账号"
                  required
                  disabled={loading}
                />

                <Input
                  label="持卡人姓名"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="请输入持卡人姓名"
                  required
                  disabled={loading}
                />

                <Input
                  label="开户行"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="例如: 中国工商银行"
                  required
                  disabled={loading}
                />

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
                  onClick={activeTab === 'deposit' ? handleDeposit : handleWithdraw}
                  disabled={
                    !amount ||
                    parseFloat(amount) <= 0 ||
                    !bankAccount ||
                    !bankName ||
                    !accountHolder ||
                    loading
                  }
                  loading={loading}
                  className="w-full"
                >
                  {activeTab === 'deposit' ? '提交入金申请' : '提交出金申请'}
                </Button>
              </div>

              {/* 说明 */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  📝 {activeTab === 'deposit' ? '入金' : '出金'}说明
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  {activeTab === 'deposit' ? (
                    <>
                      <li>• 入金通常在1-3个工作日内到账</li>
                      <li>• 请使用本人实名认证的银行账户</li>
                      <li>• 单笔最低入金金额: 100 CNY</li>
                      <li>• 入金手续费: 免费</li>
                    </>
                  ) : (
                    <>
                      <li>• 出金通常在1-3个工作日内到账</li>
                      <li>• 请确保银行账号信息正确</li>
                      <li>• 单笔最低出金金额: 100 CNY</li>
                      <li>• 出金手续费: 0.1%（最低1元）</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* 订单列表 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                我的订单
              </h2>
            </div>

            {orders.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                暂无订单记录
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <div key={order.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-lg font-semibold text-gray-900">
                            {order.type === 'DEPOSIT' ? '入金' : '出金'} {order.amount} {order.currency}
                          </span>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          银行账号: {order.bankAccount}
                        </p>
                        <p className="text-xs text-gray-400">
                          订单号: {order.id}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(order.createdAt).toLocaleString('zh-CN')}
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
