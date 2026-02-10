'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type ImportMethod = 'mnemonic' | 'privateKey'

export default function ImportWalletPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [importMethod, setImportMethod] = useState<ImportMethod>('mnemonic')
  const [mnemonic, setMnemonic] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [walletType, setWalletType] = useState<'CUSTODIAL' | 'NON_CUSTODIAL'>('NON_CUSTODIAL')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Validate mnemonic format (12 words)
  const isValidMnemonic = (m: string) => {
    const words = m.trim().split(/\s+/)
    return words.length === 12 && words.every(w => w.length > 0)
  }

  // Validate private key format
  const isValidPrivateKey = (pk: string) => {
    return /^(0x)?[a-fA-F0-9]{64}$/.test(pk.trim())
  }

  const handleImport = async () => {
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const body: any = { type: walletType }

      if (importMethod === 'mnemonic') {
        if (!isValidMnemonic(mnemonic)) {
          throw new Error('Please enter a valid 12-word mnemonic phrase')
        }
        body.mnemonic = mnemonic.trim()
      } else {
        if (!isValidPrivateKey(privateKey)) {
          throw new Error('Please enter a valid private key (64-character hexadecimal)')
        }
        body.privateKey = privateKey.trim().startsWith('0x') 
          ? privateKey.trim() 
          : '0x' + privateKey.trim()
      }

      const response = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setSuccess(`Wallet imported successfully! Address: ${data.wallet.address}`)
      
      // Clear form
      setMnemonic('')
      setPrivateKey('')

      // Redirect to wallet list after 2 seconds
      setTimeout(() => {
        router.push('/wallets')
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Import Wallet</h1>
          <p className="mt-2 text-gray-600">
            Import your existing wallet using mnemonic phrase or private key
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {/* Import method selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose Import Method
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setImportMethod('mnemonic')}
                className={`p-4 rounded-lg border-2 text-center transition-colors ${
                  importMethod === 'mnemonic'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">📝</div>
                <div className="font-medium">Mnemonic Phrase</div>
                <div className="text-xs text-gray-500 mt-1">12 words</div>
              </button>
              <button
                onClick={() => setImportMethod('privateKey')}
                className={`p-4 rounded-lg border-2 text-center transition-colors ${
                  importMethod === 'privateKey'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">🔑</div>
                <div className="font-medium">Private Key</div>
                <div className="text-xs text-gray-500 mt-1">64-char hexadecimal</div>
              </button>
            </div>
          </div>

          {/* Mnemonic input */}
          {importMethod === 'mnemonic' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mnemonic Phrase (12 words, separated by spaces)
              </label>
              <textarea
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value.toLowerCase())}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
                disabled={loading}
              />
              {mnemonic && !isValidMnemonic(mnemonic) && (
                <p className="mt-2 text-sm text-red-600">
                  Please enter 12 words separated by spaces
                </p>
              )}
              {mnemonic && isValidMnemonic(mnemonic) && (
                <p className="mt-2 text-sm text-green-600">
                  ✓ Mnemonic format is correct
                </p>
              )}
            </div>
          )}

          {/* Private key input */}
          {importMethod === 'privateKey' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Private Key
              </label>
              <input
                type="password"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="0x... or 64-character hexadecimal"
                disabled={loading}
              />
              {privateKey && !isValidPrivateKey(privateKey) && (
                <p className="mt-2 text-sm text-red-600">
                  Please enter a valid private key (64-character hexadecimal, 0x prefix optional)
                </p>
              )}
              {privateKey && isValidPrivateKey(privateKey) && (
                <p className="mt-2 text-sm text-green-600">
                  ✓ Private key format is correct
                </p>
              )}
            </div>
          )}

          {/* Wallet type selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Wallet Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setWalletType('NON_CUSTODIAL')}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  walletType === 'NON_CUSTODIAL'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">🔓 Non-custodial Wallet</div>
                <div className="text-xs text-gray-500 mt-1">
                  Private key not stored on server, more secure
                </div>
              </button>
              <button
                onClick={() => setWalletType('CUSTODIAL')}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  walletType === 'CUSTODIAL'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">🔐 Custodial Wallet</div>
                <div className="text-xs text-gray-500 mt-1">
                  Private key encrypted and stored, supports server-side transfers
                </div>
              </button>
            </div>
          </div>

          {/* Success message */}
          {success && (
            <div className="mb-6 rounded-md bg-green-50 p-4">
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="mb-6 rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex space-x-4">
            <Button
              onClick={handleImport}
              disabled={
                loading ||
                (importMethod === 'mnemonic' && !isValidMnemonic(mnemonic)) ||
                (importMethod === 'privateKey' && !isValidPrivateKey(privateKey))
              }
              loading={loading}
              className="flex-1"
            >
              Import Wallet
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/wallets')}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>

          {/* Security tips */}
          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="text-sm font-medium text-yellow-900 mb-2">
              ⚠️ Security Tips
            </h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Make sure to enter your mnemonic phrase or private key in a secure environment</li>
              <li>• Do not operate in public places or on insecure networks</li>
              <li>• When choosing "Non-custodial Wallet", the private key will not be stored on the server</li>
              <li>• When choosing "Custodial Wallet", the private key will be encrypted and stored to support server-side transfers</li>
            </ul>
          </div>
        </div>

        {/* Back button */}
        <div className="mt-6">
          <Button
            variant="outline"
            onClick={() => router.push('/wallets')}
          >
            Return to Wallet List
          </Button>
        </div>
      </div>
    </div>
  )
}






