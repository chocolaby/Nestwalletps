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
      console.error('Failed to fetch wallets:', error)
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
          alert(`Please keep your mnemonic phrase safe!\n\n${data.mnemonic}\n\nLosing the mnemonic phrase will make wallet recovery impossible!`)
        }
        fetchWallets()
      } else {
        const error = await response.json()
        alert(error.error || 'Creation failed')
      }
    } catch (error) {
      alert('Creation failed')
    } finally {
      setCreating(false)
    }
  }

  const deleteWallet = async (walletId: string, address: string) => {
    if (!confirm(`Are you sure you want to delete wallet ${address.substring(0, 10)}...?\n\nNote: Only wallets with zero balance can be deleted!`)) {
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
        alert('Wallet deleted successfully!')
        fetchWallets()
      } else {
        alert(data.error || 'Deletion failed')
      }
    } catch (error) {
      alert('Deletion failed')
    }
  }

  const refreshBalances = async () => {
    setRefreshing(true)
    try {
      await fetchWallets()
      alert('Balances updated!')
    } catch (error) {
      alert('Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const addTestEth = async (walletAddress: string) => {
    if (!confirm(`Transfer test ETH to wallet ${walletAddress.substring(0, 10)}...?\n\nWill transfer 0.01 ETH from Ganache preset account`)) {
      return
    }

    try {
      // Call backend API for test transfer
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
        alert(`Test ETH transfer successful!\nTransaction hash: ${data.txHash}\n\nRefreshing balances...`)
        setTimeout(() => {
          fetchWallets()
        }, 2000)
      } else {
        alert(data.error || 'Test transfer failed')
      }
    } catch (error) {
      alert('Test transfer failed')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">💼 My Wallets</h1>
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={refreshBalances}
                disabled={refreshing}
              >
                {refreshing ? '⏳ Refreshing...' : '🔄 Refresh Balances'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Return to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Create wallet buttons */}
          <div className="mb-6 flex justify-end space-x-3">
            <Button 
              variant="outline"
              onClick={() => router.push('/wallets/import')}
            >
              📥 Import Wallet
            </Button>
            <Button 
              onClick={() => createWallet('CUSTODIAL')}
              loading={creating}
            >
              Create Custodial Wallet
            </Button>
            <Button 
              variant="outline"
              onClick={() => createWallet('NON_CUSTODIAL')}
              loading={creating}
            >
              Create Non-custodial Wallet
            </Button>
          </div>

          {/* Wallet list */}
          {wallets.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-12 text-center">
              <div className="text-6xl mb-4">💼</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Wallets Yet
              </h3>
              <p className="text-gray-500 mb-6">
                Create your first wallet to start using NestWallet
              </p>
              <div className="flex justify-center space-x-3">
                <Button onClick={() => createWallet('CUSTODIAL')}>
                  Create Custodial Wallet
                </Button>
                <Button variant="outline" onClick={() => createWallet('NON_CUSTODIAL')}>
                  Create Non-custodial Wallet
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {wallets.map((wallet) => (
                <div key={wallet.id} className="bg-white shadow rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Wallet header */}
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm opacity-90">
                          {wallet.type === 'CUSTODIAL' ? '🔐 Custodial Wallet' : '🔓 Non-custodial Wallet'}
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
                          alert('Address copied')
                        }}
                        className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                      >
                        📋 Copy
                      </Button>
                    </div>
                  </div>

                  {/* Balance list */}
                  <div className="px-6 py-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Assets</h4>
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
                        No assets
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => router.push(`/transfer?from=${wallet.address}`)}
                      >
                        📤 Transfer
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          alert(`Receive address:\n${wallet.address}`)
                        }}
                      >
                        📥 Receive
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="w-full"
                        onClick={() => router.push(`/transactions?wallet=${wallet.id}`)}
                      >
                        📊 History
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        className="w-full"
                        onClick={() => addTestEth(wallet.address)}
                      >
                        💰 Test ETH
                      </Button>
                      <Button 
                        size="sm" 
                        variant="danger"
                        className="w-full"
                        onClick={() => deleteWallet(wallet.id, wallet.address)}
                      >
                        🗑️ Delete
                      </Button>
                    </div>
                  </div>

                  {/* Creation time */}
                  <div className="px-6 py-2 bg-gray-50 text-xs text-gray-500 text-center">
                    Created on {new Date(wallet.createdAt).toLocaleString('en-US')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Test feature description */}
          <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-green-900 mb-3">
              🧪 Test Feature Description
            </h3>
            <div className="text-sm text-green-800 space-y-2">
              <p>
                <span className="font-medium">💰 Test ETH Button:</span> 
                Transfer 0.01 ETH from Ganache preset account to your wallet for testing transfers
              </p>
              <p>
                <span className="font-medium">🔄 Refresh Balances Button:</span> 
                Get the latest balance from the blockchain in real-time to verify successful transfers
              </p>
              <p className="text-green-700 bg-green-100 p-2 rounded">
                💡 New wallets with zero balance is normal. Click "Test ETH" to get test coins for experimenting
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-blue-900 mb-3">
              💡 Wallet Type Description
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
              <div>
                <div className="font-medium mb-1">🔐 Custodial Wallet</div>
                <ul className="space-y-1 text-xs">
                  <li>• Platform manages private keys</li>
                  <li>• No need to remember mnemonic phrase</li>
                  <li>• Suitable for beginners</li>
                  <li>• More convenient but less secure</li>
                </ul>
              </div>
              <div>
                <div className="font-medium mb-1">🔓 Non-custodial Wallet</div>
                <ul className="space-y-1 text-xs">
                  <li>• User controls private keys</li>
                  <li>• Must keep mnemonic phrase safe</li>
                  <li>• Suitable for advanced users</li>
                  <li>• More secure but requires careful management</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
