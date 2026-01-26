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

  // 验证助记词格式（12个单词）
  const isValidMnemonic = (m: string) => {
    const words = m.trim().split(/\s+/)
    return words.length === 12 && words.every(w => w.length > 0)
  }

  // 验证私钥格式
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
          throw new Error('请输入有效的12个单词助记词')
        }
        body.mnemonic = mnemonic.trim()
      } else {
        if (!isValidPrivateKey(privateKey)) {
          throw new Error('请输入有效的私钥（64位十六进制）')
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
        throw new Error(data.error || '导入失败')
      }

      setSuccess(`钱包导入成功！地址: ${data.wallet.address}`)
      
      // 清空表单
      setMnemonic('')
      setPrivateKey('')

      // 2秒后跳转到钱包列表
      setTimeout(() => {
        router.push('/wallets')
      }, 2000)

    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败')
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
          <h1 className="text-3xl font-bold text-gray-900">导入钱包</h1>
          <p className="mt-2 text-gray-600">
            通过助记词或私钥导入您现有的钱包
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {/* 导入方式选择 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              选择导入方式
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
                <div className="font-medium">助记词</div>
                <div className="text-xs text-gray-500 mt-1">12个单词</div>
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
                <div className="font-medium">私钥</div>
                <div className="text-xs text-gray-500 mt-1">64位十六进制</div>
              </button>
            </div>
          </div>

          {/* 助记词输入 */}
          {importMethod === 'mnemonic' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                助记词（12个单词，用空格分隔）
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
                  请输入12个单词，用空格分隔
                </p>
              )}
              {mnemonic && isValidMnemonic(mnemonic) && (
                <p className="mt-2 text-sm text-green-600">
                  ✓ 助记词格式正确
                </p>
              )}
            </div>
          )}

          {/* 私钥输入 */}
          {importMethod === 'privateKey' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                私钥
              </label>
              <input
                type="password"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="0x... 或 64位十六进制字符"
                disabled={loading}
              />
              {privateKey && !isValidPrivateKey(privateKey) && (
                <p className="mt-2 text-sm text-red-600">
                  请输入有效的私钥（64位十六进制，可带0x前缀）
                </p>
              )}
              {privateKey && isValidPrivateKey(privateKey) && (
                <p className="mt-2 text-sm text-green-600">
                  ✓ 私钥格式正确
                </p>
              )}
            </div>
          )}

          {/* 钱包类型选择 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              钱包类型
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
                <div className="font-medium text-gray-900">🔓 非托管钱包</div>
                <div className="text-xs text-gray-500 mt-1">
                  私钥不存储在服务器，更安全
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
                <div className="font-medium text-gray-900">🔐 托管钱包</div>
                <div className="text-xs text-gray-500 mt-1">
                  私钥加密存储，支持服务端转账
                </div>
              </button>
            </div>
          </div>

          {/* 成功提示 */}
          {success && (
            <div className="mb-6 rounded-md bg-green-50 p-4">
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="mb-6 rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* 按钮 */}
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
              导入钱包
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/wallets')}
              disabled={loading}
            >
              取消
            </Button>
          </div>

          {/* 安全提示 */}
          <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="text-sm font-medium text-yellow-900 mb-2">
              ⚠️ 安全提示
            </h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• 请确保在安全的环境下输入助记词或私钥</li>
              <li>• 不要在公共场所或不安全的网络下操作</li>
              <li>• 选择"非托管钱包"时，私钥不会存储在服务器</li>
              <li>• 选择"托管钱包"时，私钥会加密存储以支持服务端转账</li>
            </ul>
          </div>
        </div>

        {/* 返回按钮 */}
        <div className="mt-6">
          <Button
            variant="outline"
            onClick={() => router.push('/wallets')}
          >
            返回钱包列表
          </Button>
        </div>
      </div>
    </div>
  )
}






