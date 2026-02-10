'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

interface Contract {
  id: string
  name: string
  address: string
  txHash: string
  blockNumber: number
  createdAt: string
}

interface TokenInfo {
  name: string
  symbol: string
  decimals: number
  totalSupply: string
}

export default function ContractsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [minting, setMinting] = useState(false)
  
  // Deploy form state
  const [deployForm, setDeployForm] = useState({
    name: '',
    symbol: '',
    decimals: 18,
    initialSupply: 1000000
  })
  
  // Mint form state
  const [mintForm, setMintForm] = useState({
    contractAddress: '',
    toAddress: '',
    amount: '',
    reason: ''
  })
  
  const [tokenInfo, setTokenInfo] = useState<Record<string, TokenInfo>>({})

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
    
    fetchContracts()
  }, [user, router])

  const fetchContracts = async () => {
    try {
      const response = await fetch('/api/admin/contracts/list')
      if (response.ok) {
        const data = await response.json()
        setContracts(data.contracts || [])
        
        // Get token info for each contract
        for (const contract of data.contracts || []) {
          fetchTokenInfo(contract.address)
        }
      }
    } catch (error) {
      console.error('Failed to fetch contract list:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTokenInfo = async (contractAddress: string) => {
    try {
      const response = await fetch(`/api/admin/contracts/${contractAddress}/info`)
      if (response.ok) {
        const data = await response.json()
        setTokenInfo(prev => ({
          ...prev,
          [contractAddress]: data.tokenInfo
        }))
      }
    } catch (error) {
      console.error('Failed to fetch token info:', error)
    }
  }

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeploying(true)
    
    try {
      const response = await fetch('/api/admin/contracts/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deployForm)
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Contract deployed successfully!\nAddress: ${data.contract.address}\nTx Hash: ${data.contract.txHash}`)
        setDeployForm({ name: '', symbol: '', decimals: 18, initialSupply: 1000000 })
        fetchContracts()
      } else {
        const error = await response.json()
        alert(error.error || 'Deployment failed')
      }
    } catch (error) {
      alert('Deployment failed')
    } finally {
      setDeploying(false)
    }
  }

  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault()
    setMinting(true)
    
    try {
      const response = await fetch('/api/admin/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mintForm)
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Token minted successfully!\nTx Hash: ${data.transaction.txHash}`)
        setMintForm({ contractAddress: '', toAddress: '', amount: '', reason: '' })
        // Refresh token info
        if (mintForm.contractAddress) {
          fetchTokenInfo(mintForm.contractAddress)
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Minting failed')
      }
    } catch (error) {
      alert('Minting failed')
    } finally {
      setMinting(false)
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
            <h1 className="text-3xl font-bold text-gray-900">🏗️ Contract Management</h1>
            <Button variant="outline" onClick={() => router.push('/admin')}>
              Back to Admin
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Deploy New Contract */}
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Deploy New Token Contract</h2>
            
            <form onSubmit={handleDeploy} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Token Name
                </label>
                <input
                  type="text"
                  value={deployForm.name}
                  onChange={(e) => setDeployForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., NestToken"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Token Symbol
                </label>
                <input
                  type="text"
                  value={deployForm.symbol}
                  onChange={(e) => setDeployForm(prev => ({ ...prev, symbol: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., NEST"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Decimals
                </label>
                <input
                  type="number"
                  value={deployForm.decimals}
                  onChange={(e) => setDeployForm(prev => ({ ...prev, decimals: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="18"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Supply
                </label>
                <input
                  type="number"
                  value={deployForm.initialSupply}
                  onChange={(e) => setDeployForm(prev => ({ ...prev, initialSupply: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  required
                />
              </div>
              
              <div className="sm:col-span-2">
                <Button type="submit" loading={deploying} className="w-full">
                  {deploying ? 'Deploying...' : 'Deploy Contract'}
                </Button>
              </div>
            </form>
          </div>

          {/* Mint Tokens */}
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Mint Tokens</h2>
            
            <form onSubmit={handleMint} className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Address
                </label>
                <select
                  value={mintForm.contractAddress}
                  onChange={(e) => setMintForm(prev => ({ ...prev, contractAddress: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Contract</option>
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.address}>
                      {contract.name} ({contract.address.slice(0, 10)}...)
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Address
                </label>
                <input
                  type="text"
                  value={mintForm.toAddress}
                  onChange={(e) => setMintForm(prev => ({ ...prev, toAddress: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0x..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount to Mint
                </label>
                <input
                  type="text"
                  value={mintForm.amount}
                  onChange={(e) => setMintForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 1000"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Minting
                </label>
                <textarea
                  value={mintForm.reason}
                  onChange={(e) => setMintForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Explain the reason for minting..."
                  required
                />
              </div>
              
              <Button type="submit" loading={minting} className="w-full">
                {minting ? 'Minting...' : 'Mint Tokens'}
              </Button>
            </form>
          </div>

          {/* Deployed Contracts List */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Deployed Contracts</h2>
            </div>
            
            {contracts.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-500">No contracts deployed yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {contracts.map((contract) => {
                  const info = tokenInfo[contract.address]
                  return (
                    <div key={contract.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">
                            {contract.name}
                          </h3>
                          <p className="text-sm text-gray-500 font-mono">
                            {contract.address}
                          </p>
                          {info && (
                            <div className="mt-2 text-sm text-gray-600">
                              <span className="mr-4">Symbol: {info.symbol}</span>
                              <span className="mr-4">Decimals: {info.decimals}</span>
                              <span>Total Supply: {parseFloat(info.totalSupply).toLocaleString()}</span>
                            </div>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            Deployed on {new Date(contract.createdAt).toLocaleString('en-US')}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(contract.address)
                              alert('Address copied')
                            }}
                          >
                            📋 Copy Address
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setMintForm(prev => ({ 
                              ...prev, 
                              contractAddress: contract.address 
                            }))}
                          >
                            💰 Mint
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
