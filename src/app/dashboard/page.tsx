'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'

interface Wallet {
  id: string
  address: string
  type: string
  createdAt: string
  balances: Array<{
    tokenSymbol: string
    tokenName: string
    balance: string
    decimals: number
  }>
}

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

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }
    
    fetchWallets()
    fetchTransactions()
  }, [user, router])

  const fetchWallets = async () => {
    try {
      const response = await fetch('/api/wallet/list')
      if (response.ok) {
        const data = await response.json()
        setWallets(data.wallets)
      }
    } catch (error) {
      console.error('Failed to fetch wallets:', error)
    }
  }

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/transaction/history?limit=5')
      if (response.ok) {
        const data = await response.json()
        setTransactions(data.transactions)
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const createWallet = async (type: 'CUSTODIAL' | 'NON_CUSTODIAL') => {
    try {
      const response = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })
      
      if (response.ok) {
        const data = await response.json()
        if (type === 'NON_CUSTODIAL' && data.mnemonic) {
          alert(`钱包创建成功！\n\n请妥善保管您的助记词：\n${data.mnemonic}\n\n助记词丢失将无法恢复钱包！`)
        } else if (type === 'CUSTODIAL') {
          alert('托管钱包创建成功！')
        }
        fetchWallets()
      } else {
        const error = await response.json()
        alert(error.error || '创建失败')
      }
    } catch (error) {
      console.error('钱包创建失败:', error)
      alert('创建失败，请稍后重试')
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
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
          <div className="flex justify-between items-center py-4">
            <h1 className="text-3xl font-bold text-gray-900">NestWallet</h1>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">快速操作</h3>
              <div className="grid grid-cols-2 gap-4">
                <Button onClick={() => router.push('/wallets')} className="h-16">
                  💼 钱包管理
                </Button>
                <Button onClick={() => router.push('/transactions')} className="h-16" variant="outline">
                  📊 交易记录
                </Button>
                <Button onClick={() => router.push('/kyc/status')} className="h-16" variant="outline">
                  🆔 KYC认证
                </Button>
                <Button onClick={() => router.push('/transfer')} className="h-16" variant="outline">
                  📤 转账
                </Button>
                <Button onClick={() => router.push('/fiat')} className="h-16" variant="outline">
                  💰 法币通道
                </Button>
                {user?.role === 'ADMIN' && (
                  <Button onClick={() => router.push('/admin')} className="h-16" variant="secondary">
                    ⚙️ 管理后台
                  </Button>
                )}
                <Button onClick={() => router.push('/settings')} className="h-16" variant="outline">
                  ⚙️ 设置
                </Button>
                <Button onClick={() => router.push('/notifications')} className="h-16" variant="outline">
                  🔔 通知
                </Button>
              </div>
              
              {/* 测试提示 */}
              <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <span className="text-yellow-800 text-sm">
                    💡 <strong>新用户提示:</strong> 创建钱包后余额为0是正常现象，
                    可在钱包管理页面点击"💰 测试ETH"获得测试币体验转账功能
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 mr-2">欢迎, {user?.email}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                退出
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Wallets Section */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">我的钱包</h2>
              <div className="space-x-2">
                <Button onClick={() => createWallet('CUSTODIAL')}>
                  创建托管钱包
                </Button>
                <Button variant="outline" onClick={() => createWallet('NON_CUSTODIAL')}>
                  创建非托管钱包
                </Button>
              </div>
            </div>
            
            {wallets.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-500">还没有钱包。创建你的第一个钱包开始使用吧！</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {wallets.map((wallet) => (
                  <div key={wallet.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-semibold">{wallet.type === 'CUSTODIAL' ? '托管' : '非托管'}钱包</h3>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {wallet.type === 'CUSTODIAL' ? '托管' : '非托管'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-4 font-mono">
                      {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                    </p>
                    <div className="space-y-2">
                      {wallet.balances.map((balance, index) => (
                        <div key={index} className="flex justify-between">
                          <span className="text-sm text-gray-600">{balance.tokenSymbol}</span>
                          <span className="text-sm font-medium">
                            {parseFloat(balance.balance).toFixed(4)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Transactions */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">最近交易</h2>
            {transactions.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-500">还没有交易记录</p>
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {transactions.map((tx) => (
                    <li key={tx.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {tx.amount} {tx.tokenSymbol}
                            </p>
                            <div className="ml-2 flex-shrink-0 flex">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                tx.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                                tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {tx.status}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex">
                            <div className="flex items-center text-sm text-gray-500">
                              <p className="font-mono">
                                从: {tx.fromAddress.slice(0, 6)}...{tx.fromAddress.slice(-4)}
                              </p>
                              <span className="mx-2">→</span>
                              <p className="font-mono">
                                到: {tx.toAddress.slice(0, 6)}...{tx.toAddress.slice(-4)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
