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

export default function MintPage() {
  const { user } = useAuth()
  const router = useRouter()
  
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
  }, [user, router])

  const fetchRecords = async () => {
    try {
      const response = await fetch('/api/admin/mint/history')
      if (response.ok) {
        const data = await response.json()
        setRecords(data.records || [])
      }
    } catch (error) {
      console.error('Failed to fetch Mint history:', error)
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
          toAddress,
          amount,
          tokenSymbol,
          reason
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Mint failed')
      }

      const data = await response.json()
      setSuccess(`Successfully minted ${amount} ${tokenSymbol} to ${toAddress}`)
      
      // Clear form
      setToAddress('')
      setAmount('')
      setReason('')
      setShowConfirm(false)
      
      // Refresh records
      fetchRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mint failed')
    } finally {
      setLoading(false)
    }
  }

  // Address validation
  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">Token Minting</h1>
            <Button variant="outline" onClick={() => router.push('/admin')}>
              Back to Admin
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Mint form */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Mint New Tokens
            </h2>

            <div className="space-y-4">
              {/* Receiving address */}
              <Input
                label="Receiving Address"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="0x..."
                required
                disabled={loading}
              />
              {toAddress && !isValidAddress(toAddress) && (
                <p className="text-sm text-red-600">
                  Please enter a valid Ethereum address
                </p>
              )}

              {/* Amount and token */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Mint Amount"
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
                    <option value="NEST">NEST</option>
                    <option value="ETH">ETH (Test)</option>
                  </select>
                </div>
              </div>

              {/* Reason description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mint Reason
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Please explain the reason for minting..."
                  disabled={loading}
                  required
                />
              </div>

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

              {/* Confirmation dialog */}
              {showConfirm && (
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h3 className="text-sm font-medium text-yellow-900 mb-2">
                    ⚠️ Please Confirm Minting Information
                  </h3>
                  <div className="space-y-1 text-sm text-yellow-800 mb-4">
                    <p>Address: {toAddress}</p>
                    <p>Amount: {amount} {tokenSymbol}</p>
                    <p>Reason: {reason}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleMint}
                      loading={loading}
                      className="flex-1"
                    >
                      Confirm Mint
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowConfirm(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Button */}
              {!showConfirm && (
                <Button
                  onClick={() => setShowConfirm(true)}
                  disabled={
                    !toAddress ||
                    !isValidAddress(toAddress) ||
                    !amount ||
                    parseFloat(amount) <= 0 ||
                    !reason.trim() ||
                    loading
                  }
                  className="w-full"
                >
                  Mint Tokens
                </Button>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                🔒 Security Notice
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Minting operations are irreversible, please proceed with caution</li>
                <li>• All minting records will be permanently saved</li>
                <li>• Please ensure the receiving address is correct</li>
                <li>• Minting reason will be recorded in the audit log</li>
              </ul>
            </div>
          </div>

          {/* Mint history */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Minting History
              </h2>
            </div>

            {records.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No minting records
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
                          Reason: {record.reason}
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
