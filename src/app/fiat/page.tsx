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
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled'
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
      console.error('Failed to fetch orders:', error)
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
        throw new Error(error.error || 'Deposit failed')
      }

      const data = await response.json()
      setSuccess(`Deposit request submitted! Order ID: ${data.order.id}`)
      
      // Clear form
      setAmount('')
      setBankAccount('')
      setBankName('')
      setAccountHolder('')
      
      // Refresh orders
      fetchOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed')
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
        throw new Error(error.error || 'Withdrawal failed')
      }

      const data = await response.json()
      setSuccess(`Withdrawal request submitted! Order ID: ${data.order.id}`)
      
      // Clear form
      setAmount('')
      setBankAccount('')
      setBankName('')
      setAccountHolder('')
      
      // Refresh orders
      fetchOrders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed')
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
            <h1 className="text-3xl font-bold text-gray-900">Fiat Gateway</h1>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Tabs */}
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
                  💰 Deposit
                </button>
                <button
                  onClick={() => setActiveTab('withdraw')}
                  className={`${
                    activeTab === 'withdraw'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}
                >
                  💸 Withdrawal
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    disabled={loading}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loading}
                    >
                      <option value="CNY">CNY (RMB)</option>
                      <option value="USD">USD (US Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                    </select>
                  </div>
                </div>

                {/* Payment method selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
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
                      <div className="text-xs font-medium">Bank Card</div>
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
                      <div className="text-xs font-medium">Alipay</div>
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
                      <div className="text-xs font-medium">WeChat</div>
                    </button>
                  </div>
                </div>

                <Input
                  label="Bank Account"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="Please enter bank account number"
                  required
                  disabled={loading}
                />

                <Input
                  label="Account Holder Name"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Please enter account holder name"
                  required
                  disabled={loading}
                />

                <Input
                  label="Bank Name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g., Industrial and Commercial Bank of China"
                  required
                  disabled={loading}
                />

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
                  {activeTab === 'deposit' ? 'Submit Deposit Request' : 'Submit Withdrawal Request'}
                </Button>
              </div>

              {/* Instructions */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900 mb-2">
                  📝 {activeTab === 'deposit' ? 'Deposit' : 'Withdrawal'} Instructions
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  {activeTab === 'deposit' ? (
                    <>
                      <li>• Deposits usually arrive within 1-3 business days</li>
                      <li>• Please use a bank account with real-name authentication</li>
                      <li>• Minimum deposit amount per transaction: 100 CNY</li>
                      <li>• Deposit fee: Free</li>
                    </>
                  ) : (
                    <>
                      <li>• Withdrawals usually arrive within 1-3 business days</li>
                      <li>• Please ensure the bank account information is correct</li>
                      <li>• Minimum withdrawal amount per transaction: 100 CNY</li>
                      <li>• Withdrawal fee: 0.1% (minimum 1 CNY)</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Order list */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                My Orders
              </h2>
            </div>

            {orders.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No order records
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <div key={order.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-lg font-semibold text-gray-900">
                            {order.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} {order.amount} {order.currency}
                          </span>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                            {STATUS_LABELS[order.status] || order.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          Bank Account: {order.bankAccount}
                        </p>
                        <p className="text-xs text-gray-400">
                          Order ID: {order.id}
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
