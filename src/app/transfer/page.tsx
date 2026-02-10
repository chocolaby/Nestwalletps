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
      console.log('📡 Fetching wallet list...')
      const response = await fetch('/api/wallet/list', {
        credentials: 'include'
      })
      console.log('📡 Response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('📡 Wallet data:', data)
        setWallets(data.wallets || [])
        if (data.wallets?.length > 0) {
          setFromWallet(data.wallets[0].id)
        }
      } else {
        console.log('📡 Response failed:', await response.text())
      }
    } catch (error) {
      console.error('Failed to fetch wallet list:', error)
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
        throw new Error(error.error || 'Gas estimation failed')
      }

      const data = await response.json()
      setGasEstimate(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gas estimation failed')
    } finally {
      setEstimating(false)
    }
  }

  const handleSubmit = async () => {
    if (!fromWallet || !toAddress || !amount) {
      setError('Please fill in all required fields')
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
        throw new Error(error.error || 'Transfer failed')
      }

      const data = await response.json()
      
      // Redirect to transaction details or Dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed')
    } finally {
      setLoading(false)
    }
  }

  // Address validation
  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  // Amount validation
  const isValidAmount = (amt: string) => {
    return /^\d+(\.\d+)?$/.test(amt) && parseFloat(amt) > 0
  }

  const selectedWallet = wallets.find(w => w.id === fromWallet)

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Transfer</h1>
          <p className="mt-2 text-gray-600">
            Send ETH or tokens to other addresses
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {/* Select wallet */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Wallet
            </label>
            <select
              value={fromWallet}
              onChange={(e) => setFromWallet(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={loading}
            >
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)} ({wallet.type === 'CUSTODIAL' ? 'Custodial' : 'Non-custodial'})
                </option>
              ))}
            </select>
            {selectedWallet && (
              <p className="mt-1 text-xs text-gray-500 font-mono">
                {selectedWallet.address}
              </p>
            )}
          </div>

          {/* Recipient address */}
          <Input
            label="Recipient Address"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="0x..."
            required
            disabled={loading}
          />
          {toAddress && !isValidAddress(toAddress) && (
            <p className="mt-1 text-sm text-red-600">
              Please enter a valid Ethereum address
            </p>
          )}

          {/* Amount and token */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Input
              label="Amount"
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
                <option value="ETH">ETH</option>
                <option value="NEST">NEST</option>
              </select>
            </div>
          </div>

          {/* Gas estimation */}
          {!gasEstimate && isValidAddress(toAddress) && isValidAmount(amount) && (
            <div className="mb-6">
              <Button
                variant="outline"
                onClick={estimateGas}
                loading={estimating}
                disabled={loading}
              >
                Estimate Gas Fee
              </Button>
            </div>
          )}

          {gasEstimate && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                Gas Estimation
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
                  <span>Estimated Cost:</span>
                  <span className="font-mono">{gasEstimate.totalCost} ETH</span>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Confirmation dialog */}
          {showConfirm && (
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h3 className="text-sm font-medium text-yellow-900 mb-2">
                ⚠️ Please Confirm Transaction Details
              </h3>
              <div className="space-y-1 text-sm text-yellow-800">
                <p>From: {selectedWallet?.address}</p>
                <p>To: {toAddress}</p>
                <p>Amount: {amount} {tokenSymbol}</p>
                {gasEstimate && (
                  <p>Gas Fee: {gasEstimate.totalCost} ETH</p>
                )}
              </div>
              <div className="mt-4 flex space-x-2">
                <Button
                  onClick={handleSubmit}
                  loading={loading}
                  className="flex-1"
                >
                  Confirm Transfer
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

          {/* Buttons */}
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
                Send
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push('/dashboard')}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Security tips */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              🔒 Security Tips
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Double-check the recipient address, transactions cannot be reversed</li>
              <li>• Ensure you have sufficient balance to pay for gas fees</li>
              <li>• Do not transfer to unknown addresses</li>
              <li>• For large transfers, test with a small amount first</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
