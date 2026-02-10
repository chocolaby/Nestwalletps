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
  
  // 部署表单状态
  const [deployForm, setDeployForm] = useState({
    name: '',
    symbol: '',
    decimals: 18,
    initialSupply: 1000000
  })
  
  // 铸造表单状态
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
        const dbContracts = data.contracts || []
        
        // Add pre-deployed Sepolia contract if env var is set
        const sepoliaAddress = process.env.NEXT_PUBLIC_NEST_TOKEN_ADDRESS
        if (sepoliaAddress) {
          const existsInDb = dbContracts.some((c: Contract) => 
            c.address.toLowerCase() === sepoliaAddress.toLowerCase()
          )
          
          if (!existsInDb) {
            // Add pre-deployed contract to the list
            dbContracts.unshift({
              id: 'sepolia-predefined',
              name: 'NestToken (Pre-deployed Sepolia)',
              address: sepoliaAddress,
              txHash: '0x...',
              blockNumber: 0,
              createdAt: new Date().toISOString()
            })
          }
        }
        
        setContracts(dbContracts)
        
        // 获取每个合约的代币信息
        for (const contract of dbContracts) {
          fetchTokenInfo(contract.address)
        }
      }
    } catch (error) {
      console.error('获取合约列表失败:', error)
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
      console.error('获取代币信息失败:', error)
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
        alert(`合约部署成功！\n地址: ${data.contract.address}\n交易哈希: ${data.contract.txHash}`)
        setDeployForm({ name: '', symbol: '', decimals: 18, initialSupply: 1000000 })
        fetchContracts()
      } else {
        const error = await response.json()
        alert(error.error || '部署失败')
      }
    } catch (error) {
      alert('部署失败')
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
        alert(`代币铸造成功！\n交易哈希: ${data.transaction.txHash}`)
        setMintForm({ contractAddress: '', toAddress: '', amount: '', reason: '' })
        // 刷新代币信息
        if (mintForm.contractAddress) {
          fetchTokenInfo(mintForm.contractAddress)
        }
      } else {
        const error = await response.json()
        alert(error.error || '铸造失败')
      }
    } catch (error) {
      alert('铸造失败')
    } finally {
      setMinting(false)
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
            <h1 className="text-3xl font-bold text-gray-900">🏗️ 合约管理</h1>
            <Button variant="outline" onClick={() => router.push('/admin')}>
              返回管理后台
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* 部署新合约 */}
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">部署新代币合约</h2>
            
            <form onSubmit={handleDeploy} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  代币名称
                </label>
                <input
                  type="text"
                  value={deployForm.name}
                  onChange={(e) => setDeployForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: NestToken"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  代币符号
                </label>
                <input
                  type="text"
                  value={deployForm.symbol}
                  onChange={(e) => setDeployForm(prev => ({ ...prev, symbol: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: NEST"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  小数位数
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
                  初始供应量
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
                  {deploying ? '部署中...' : '部署合约'}
                </Button>
              </div>
            </form>
          </div>

          {/* 铸造代币 */}
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">铸造代币</h2>
            
            <form onSubmit={handleMint} className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  合约地址
                </label>
                <select
                  value={mintForm.contractAddress}
                  onChange={(e) => setMintForm(prev => ({ ...prev, contractAddress: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">选择合约</option>
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.address}>
                      {contract.name} ({contract.address.slice(0, 10)}...)
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  接收地址
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
                  铸造数量
                </label>
                <input
                  type="text"
                  value={mintForm.amount}
                  onChange={(e) => setMintForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: 1000"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  铸造原因
                </label>
                <textarea
                  value={mintForm.reason}
                  onChange={(e) => setMintForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="说明铸造原因..."
                  required
                />
              </div>
              
              <Button type="submit" loading={minting} className="w-full">
                {minting ? '铸造中...' : '铸造代币'}
              </Button>
            </form>
          </div>

          {/* 已部署合约列表 */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">已部署合约</h2>
            </div>
            
            {contracts.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-gray-500">还没有部署任何合约</p>
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
                              <span className="mr-4">符号: {info.symbol}</span>
                              <span className="mr-4">小数位: {info.decimals}</span>
                              <span>总供应量: {parseFloat(info.totalSupply).toLocaleString()}</span>
                            </div>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            部署于 {new Date(contract.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(contract.address)
                              alert('地址已复制')
                            }}
                          >
                            📋 复制地址
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setMintForm(prev => ({ 
                              ...prev, 
                              contractAddress: contract.address 
                            }))}
                          >
                            💰 铸造
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
