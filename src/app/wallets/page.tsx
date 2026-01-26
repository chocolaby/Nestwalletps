'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

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

export default function WalletsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }
    
    fetchWallets()
  }, [user, router])

  const fetchWallets = async () => {
    try {
      const response = await fetch('/api/wallet/list')
      if (response.ok) {
        const data = await response.json()
        setWallets(data.wallets || [])
      }
    } catch (error) {
      console.error('获取钱包失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const createWallet = async (type: 'CUSTODIAL' | 'NON_CUSTODIAL') => {
    setCreating(true)
    try {
      const response = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type })
      })

      if (response.ok) {
        const data = await response.json()
        if (type === 'NON_CUSTODIAL' && data.mnemonic) {
          alert(`请妥善保管助记词！\n\n${data.mnemonic}\n\n助记词丢失将无法恢复钱包！`)
        }
        fetchWallets()
      } else {
        const error = await response.json()
        alert(error.error || '创建失败')
      }
    } catch (error) {
      alert('创建失败')
    } finally {
      setCreating(false)
    }
  }

  const deleteWallet = async (walletId: string, address: string) => {
    if (!confirm(`确定要删除钱包 ${address.substring(0, 10)}...？\n\n注意：只有余额为0的钱包才能删除！`)) {
      return
    }

    try {
      const response = await fetch('/api/wallet/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId })
      })

      const data = await response.json()
      
      if (response.ok) {
        alert('钱包删除成功！')
        fetchWallets()
      } else {
        alert(data.error || '删除失败')
      }
    } catch (error) {
      alert('删除失败')
    }
  }

  const refreshBalances = async () => {
    setRefreshing(true)
    try {
      await fetchWallets()
      alert('余额已更新！')
    } catch (error) {
      alert('刷新失败')
    } finally {
      setRefreshing(false)
    }
  }

  const addTestEth = async (walletAddress: string) => {
    if (!confirm(`向钱包 ${walletAddress.substring(0, 10)}... 转入测试ETH？\n\n将从Ganache预设账户转入0.01 ETH`)) {
      return
    }

    try {
      // 调用后端API进行测试转账
      const response = await fetch('/api/wallet/test-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          toAddress: walletAddress,
          amount: '0.01'
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        alert(`测试ETH转账成功！\n交易哈希: ${data.txHash}\n\n正在刷新余额...`)
        setTimeout(() => {
          fetchWallets()
        }, 2000)
      } else {
        alert(data.error || '测试转账失败')
      }
    } catch (error) {
      alert('测试转账失败')
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
            <h1 className="text-3xl font-bold text-gray-900">💼 我的钱包</h1>
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={refreshBalances}
                disabled={refreshing}
              >
                {refreshing ? '⏳ 刷新中...' : '🔄 刷新余额'}
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
          {/* 创建钱包按钮 */}
          <div className="mb-6 flex justify-end space-x-3">
            <Button 
              variant="outline"
              onClick={() => router.push('/wallets/import')}
            >
              📥 导入钱包
            </Button>
            <Button 
              onClick={() => createWallet('CUSTODIAL')}
              loading={creating}
            >
              创建托管钱包
            </Button>
            <Button 
              variant="outline"
              onClick={() => createWallet('NON_CUSTODIAL')}
              loading={creating}
            >
              创建非托管钱包
            </Button>
          </div>

          {/* 钱包列表 */}
          {wallets.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">💼</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                还没有钱包
              </h3>
              <p className="text-gray-500 mb-6">
                创建您的第一个钱包开始使用NestWallet
              </p>
              <div className="flex justify-center space-x-3">
                <Button onClick={() => createWallet('CUSTODIAL')}>
                  创建托管钱包
                </Button>
                <Button variant="outline" onClick={() => createWallet('NON_CUSTODIAL')}>
                  创建非托管钱包
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  {/* 钱包头部 */}
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm opacity-90">
                          {wallet.type === 'CUSTODIAL' ? '🔐 托管钱包' : '🔓 非托管钱包'}
                        </div>
                        <div className="text-white font-mono text-lg mt-1">
                          {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(wallet.address)
                          alert('地址已复制')
                        }}
                        className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                      >
                        📋 复制
                      </Button>
                    </div>
                  </div>

                  {/* 余额列表 */}
                  <div className="px-6 py-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">资产</h4>
                    {wallet.balances && wallet.balances.length > 0 ? (
                      <div className="space-y-2">
                        {wallet.balances.map((balance, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                            <div>
                              <div className="font-medium text-gray-900">
                                {balance.tokenName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {balance.tokenSymbol}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">
                                {parseFloat(balance.balance).toFixed(4)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {balance.tokenSymbol}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-400">
                        暂无资产
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => router.push(`/transfer?from=${wallet.address}`)}
                      >
                        📤 转账
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          alert(`接收地址：\n${wallet.address}`)
                        }}
                      >
                        📥 接收
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full"
                        onClick={() => router.push(`/transactions?wallet=${wallet.id}`)}
                      >
                        📊 记录
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="w-full"
                        onClick={() => addTestEth(wallet.address)}
                      >
                        💰 测试ETH
                      </Button>
                      <Button 
                        size="sm" 
                        variant="danger"
                        className="w-full"
                        onClick={() => deleteWallet(wallet.id, wallet.address)}
                      >
                        🗑️ 删除
                      </Button>
                    </div>
                  </div>

                  {/* 创建时间 */}
                  <div className="px-6 py-2 bg-gray-50 text-xs text-gray-500 text-center">
                    创建于 {new Date(wallet.createdAt).toLocaleString('zh-CN')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 测试提示 */}
          <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-green-900 mb-3">
              🧪 测试功能说明
            </h3>
            <div className="text-sm text-green-800 space-y-2">
              <p>
                <span className="font-medium">💰 测试ETH按钮:</span> 
                从Ganache预设账户向你的钱包转入0.01 ETH，用于测试转账功能
              </p>
              <p>
                <span className="font-medium">🔄 刷新余额按钮:</span> 
                实时从区块链获取最新余额，验证转账是否成功
              </p>
              <p className="text-green-700 bg-green-100 p-2 rounded">
                💡 新创建的钱包余额为0是正常现象，点击"测试ETH"可以获得测试币进行体验
              </p>
            </div>
          </div>

          {/* 说明 */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-blue-900 mb-3">
              💡 钱包类型说明
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
              <div>
                <div className="font-medium mb-1">🔐 托管钱包</div>
                <ul className="space-y-1 text-xs">
                  <li>• 平台托管私钥</li>
                  <li>• 无需记忆助记词</li>
                  <li>• 适合新手使用</li>
                  <li>• 更方便但安全性较低</li>
                </ul>
              </div>
              <div>
                <div className="font-medium mb-1">🔓 非托管钱包</div>
                <ul className="space-y-1 text-xs">
                  <li>• 用户自己掌握私钥</li>
                  <li>• 需妥善保管助记词</li>
                  <li>• 适合进阶用户</li>
                  <li>• 更安全但需谨慎管理</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
