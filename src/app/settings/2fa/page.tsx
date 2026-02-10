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
        alert(error.error || 'Setup failed')
      }
    } catch (error) {
      alert('Setup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify2FA = async () => {
    if (!verificationCode) {
      alert('Please enter verification code')
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
        alert('Two-factor authentication enabled successfully!')
        setStep('status')
        setVerificationCode('')
        await refreshUser()
      } else {
        const error = await response.json()
        alert(error.error || 'Verification failed')
      }
    } catch (error) {
      alert('Verification failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!confirm('Are you sure you want to disable two-factor authentication? This will reduce your account security.')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST'
      })

      if (response.ok) {
        alert('Two-factor authentication disabled')
        setStep('status')
        await refreshUser()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to disable')
      }
    } catch (error) {
      alert('Failed to disable')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">🔐 Two-Factor Authentication</h1>
            <Button variant="outline" onClick={() => router.push('/settings')}>
              Back to Settings
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {step === 'status' && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center">
                <div className="text-6xl mb-4">
                  {user.twoFactorEnabled ? '🔒' : '🔓'}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Two-Factor Authentication {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </h2>
                <p className="text-gray-600 mb-8">
                  {user.twoFactorEnabled 
                    ? 'Your account is protected by two-factor authentication for enhanced security.'
                    : 'Enable two-factor authentication to greatly improve your account security.'
                  }
                </p>
                
                {user.twoFactorEnabled ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800 text-sm">
                        ✅ Your account is protected by two-factor authentication
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => setStep('disable')}
                    >
                      Disable 2FA
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800 text-sm">
                        ⚠️ We recommend enabling two-factor authentication to enhance account security
                      </p>
                    </div>
                    <Button 
                      onClick={handleSetup2FA}
                      loading={loading}
                    >
                      Enable 2FA
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'setup' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Set Up Two-Factor Authentication</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Step 1: Scan QR Code
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Use your authenticator app (such as Google Authenticator, Authy) to scan the QR code below:
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
                    Step 2: Manual Entry (Optional)
                  </h3>
                  <p className="text-gray-600 mb-2">
                    If you cannot scan the QR code, manually enter the following key:
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
                      alert('Key copied to clipboard')
                    }}
                  >
                    📋 Copy Key
                  </Button>
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Step 3: Verify Setup
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Enter the 6-digit verification code shown in your authenticator app:
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
                      Verify and Enable
                    </Button>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setStep('status')}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 'disable' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Disable Two-Factor Authentication</h2>
              
              <div className="space-y-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="text-red-400 text-xl mr-3">⚠️</div>
                    <div>
                      <h3 className="text-red-800 font-medium">Security Warning</h3>
                      <p className="text-red-700 text-sm mt-1">
                        Disabling two-factor authentication will reduce your account security. Only disable this feature when necessary.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-gray-600 mb-4">
                    Are you sure you want to disable two-factor authentication? After disabling, your account will only be protected by password.
                  </p>
                </div>

                <div className="flex space-x-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setStep('status')}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="danger"
                    onClick={handleDisable2FA}
                    loading={loading}
                  >
                    Confirm Disable
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-blue-900 font-medium mb-3">💡 About Two-Factor Authentication</h3>
            <div className="text-blue-800 text-sm space-y-2">
              <p>• Two-factor authentication adds an extra layer of security to your account</p>
              <p>• Even if your password is compromised, attackers cannot access your account</p>
              <p>• We recommend using Google Authenticator, Authy, or similar authenticator apps</p>
              <p>• Keep your backup codes safe in case your phone is lost</p>
            </div>
          </div>

          <div className="mt-6 bg-white shadow rounded-lg p-6">
            <h3 className="text-gray-900 font-medium mb-4">📱 Recommended Authenticator Apps</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="text-2xl">📱</div>
                <div>
                  <div className="font-medium">Google Authenticator</div>
                  <div className="text-sm text-gray-500">Official Google app</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="text-2xl">🔐</div>
                <div>
                  <div className="font-medium">Authy</div>
                  <div className="text-sm text-gray-500">Supports cloud sync</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="text-2xl">🛡️</div>
                <div>
                  <div className="font-medium">Microsoft Authenticator</div>
                  <div className="text-sm text-gray-500">Official Microsoft app</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="text-2xl">🔒</div>
                <div>
                  <div className="font-medium">1Password</div>
                  <div className="text-sm text-gray-500">Password manager integration</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
