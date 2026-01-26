'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import Image from 'next/image'

export default function TwoFactorAuthPage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'status' | 'setup' | 'verify' | 'disable'>('status')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [backupCodes] = useState([
    'A1B2C3D4', 'E5F6G7H8', 'I9J0K1L2', 'M3N4O5P6',
    'Q7R8S9T0', 'U1V2W3X4', 'Y5Z6A7B8', 'C9D0E1F2'
  ])

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }
  }, [user, router])

  const handleSetup2FA = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' })
      })

      if (response.ok) {
        const data = await response.json()
        setQrCode(data.qrCode)
        setSecret(data.manualEntryKey)
        setStep('setup')
      } else {
        const error = await response.json()
        alert(error.error || '设置失败')
      }
    } catch (error) {
      alert('设置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify2FA = async () => {
    if (!verificationCode) {
      alert('请输入验证码')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'verify',
          token: verificationCode 
        })
      })

      if (response.ok) {
        alert('两步验证已成功启用！')
        setStep('status')
        setVerificationCode('')
        await refreshUser()
      } else {
        const error = await response.json()
        alert(error.error || '验证失败')
      }
    } catch (error) {
      alert('验证失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!confirm('确定要禁用两步验证吗？这将降低您的账户安全性。')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST'
      })

      if (response.ok) {
        alert('两步验证已禁用')
        setStep('status')
        await refreshUser()
      } else {
        const error = await response.json()
        alert(error.error || '禁用失败')
      }
    } catch (error) {
      alert('禁用失败')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">🔐 两步验证</h1>
            <Button variant="outline" onClick={() => router.push('/settings')}>
              返回设置
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* 状态页面 */}
          {step === 'status' && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center">
                <div className="text-6xl mb-4">
                  {user.twoFactorEnabled ? '🔒' : '🔓'}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  两步验证 {user.twoFactorEnabled ? '已启用' : '未启用'}
                </h2>
                <p className="text-gray-600 mb-8">
                  {user.twoFactorEnabled 
                    ? '您的账户已受到两步验证保护，安全性更高。'
                    : '启用两步验证可以大大提高您的账户安全性。'
                  }
                </p>
                
                {user.twoFactorEnabled ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800 text-sm">
                        ✅ 您的账户已受到两步验证保护
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setStep('disable')}
                    >
                      禁用两步验证
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 text-sm">
                        ⚠️ 建议启用两步验证以提高账户安全性
                      </p>
                    </div>
                    <Button 
                      onClick={handleSetup2FA}
                      loading={loading}
                    >
                      启用两步验证
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 设置页面 */}
          {step === 'setup' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">设置两步验证</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    步骤 1: 扫描二维码
                  </h3>
                  <p className="text-gray-600 mb-4">
                    使用您的身份验证器应用（如 Google Authenticator、Authy）扫描下方二维码：
                  </p>
                  
                  <div className="flex justify-center mb-6">
                    {qrCode && (
                      <div className="p-4 bg-white border-2 border-gray-200 rounded-lg">
                        <img 
                          src={qrCode} 
                          alt="2FA QR Code" 
                          className="w-48 h-48"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    步骤 2: 手动输入密钥（可选）
                  </h3>
                  <p className="text-gray-600 mb-2">
                    如果无法扫描二维码，请手动输入以下密钥：
                  </p>
                  <div className="bg-gray-100 p-3 rounded font-mono text-sm break-all">
                    {secret}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      navigator.clipboard.writeText(secret)
                      alert('密钥已复制到剪贴板')
                    }}
                  >
                    📋 复制密钥
                  </Button>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    步骤 3: 验证设置
                  </h3>
                  <p className="text-gray-600 mb-4">
                    请输入身份验证器应用中显示的6位验证码：
                  </p>
                  <div className="flex space-x-4">
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono"
                      placeholder="000000"
                      maxLength={6}
                    />
                    <Button 
                      onClick={handleVerify2FA}
                      loading={loading}
                      disabled={verificationCode.length !== 6}
                    >
                      验证并启用
                    </Button>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setStep('status')}
                  >
                    取消
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 禁用确认页面 */}
          {step === 'disable' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">禁用两步验证</h2>
              
              <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="text-red-400 text-xl mr-3">⚠️</div>
                    <div>
                      <h3 className="text-red-800 font-medium">安全警告</h3>
                      <p className="text-red-700 text-sm mt-1">
                        禁用两步验证将降低您的账户安全性。建议只在必要时才禁用此功能。
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-gray-600 mb-4">
                    确定要禁用两步验证吗？禁用后，您的账户将只使用密码保护。
                  </p>
                </div>

                <div className="flex space-x-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setStep('status')}
                  >
                    取消
                  </Button>
                  <Button 
                    variant="danger"
                    onClick={handleDisable2FA}
                    loading={loading}
                  >
                    确认禁用
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 说明信息 */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-blue-900 font-medium mb-3">💡 关于两步验证</h3>
            <div className="text-blue-800 text-sm space-y-2">
              <p>• 两步验证为您的账户增加了额外的安全层</p>
              <p>• 即使密码被泄露，攻击者也无法访问您的账户</p>
              <p>• 推荐使用 Google Authenticator、Authy 或类似的身份验证器应用</p>
              <p>• 请妥善保管您的备份码，以防手机丢失</p>
            </div>
          </div>

          {/* 推荐应用 */}
          <div className="mt-6 bg-white shadow rounded-lg p-6">
            <h3 className="text-gray-900 font-medium mb-4">📱 推荐的身份验证器应用</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="text-2xl">📱</div>
                <div>
                  <div className="font-medium">Google Authenticator</div>
                  <div className="text-sm text-gray-500">Google 官方应用</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="text-2xl">🔐</div>
                <div>
                  <div className="font-medium">Authy</div>
                  <div className="text-sm text-gray-500">支持云同步</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="text-2xl">🛡️</div>
                <div>
                  <div className="font-medium">Microsoft Authenticator</div>
                  <div className="text-sm text-gray-500">微软官方应用</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="text-2xl">🔒</div>
                <div>
                  <div className="font-medium">1Password</div>
                  <div className="text-sm text-gray-500">密码管理器集成</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
