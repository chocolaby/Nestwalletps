'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function SettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState('profile')
  const [saving, setSaving] = useState(false)
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [twoFactorToken, setTwoFactorToken] = useState('')
  const [twoFactorError, setTwoFactorError] = useState('')
  const [twoFactorSuccess, setTwoFactorSuccess] = useState('')
  
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    transactionNotifications: true,
    securityNotifications: true,
    systemNotifications: true,
    marketingNotifications: false
  })
  const [savingNotifications, setSavingNotifications] = useState(false)
  const [notificationSuccess, setNotificationSuccess] = useState('')
  const [settingUp2FA, setSettingUp2FA] = useState(false)
  const [showSetup2FA, setShowSetup2FA] = useState(false)

  useEffect(() => {
    fetchNotificationSettings()
  }, [])

  const fetchNotificationSettings = async () => {
    try {
      const response = await fetch('/api/settings/notifications')
      const data = await response.json()
      
      if (data.success) {
        setNotificationSettings(data.settings)
      }
    } catch (error) {
      console.error('Failed to fetch notification settings:', error)
    }
  }

  const saveNotificationSettings = async () => {
    setSavingNotifications(true)
    setNotificationSuccess('')
    
    try {
      const response = await fetch('/api/settings/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationSettings)
      })
      
      const data = await response.json()
      
      if (data.success) {
        setNotificationSuccess('Notification settings saved')
        setTimeout(() => setNotificationSuccess(''), 3000)
      } else {
        console.error('Failed to save notification settings:', data.error)
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error)
    } finally {
      setSavingNotifications(false)
    }
  }

  const updateNotificationSetting = (key: string, value: boolean) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleChangePassword = async () => {
    setChangingPassword(true)
    setPasswordError('')
    setPasswordSuccess('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all fields')
      setChangingPassword(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      setChangingPassword(false)
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      setChangingPassword(false)
      return
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to change password')
      }

      setPasswordSuccess('Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleSetup2FA = async () => {
    setSettingUp2FA(true)
    setTwoFactorError('')
    setTwoFactorSuccess('')

    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate 2FA key')
      }

      const data = await response.json()
      setQrCode(data.qrCode)
      setManualKey(data.manualEntryKey)
      setShowSetup2FA(true)
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'Failed to generate 2FA key')
    } finally {
      setSettingUp2FA(false)
    }
  }

  const handleVerify2FA = async () => {
    if (!twoFactorToken) {
      setTwoFactorError('Please enter verification code')
      return
    }

    setSettingUp2FA(true)
    setTwoFactorError('')

    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'verify',
          token: twoFactorToken 
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Verification failed')
      }

      setTwoFactorSuccess('Two-factor authentication enabled successfully!')
      setTwoFactorEnabled(true)
      setShowSetup2FA(false)
      setTwoFactorToken('')
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setSettingUp2FA(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!twoFactorToken || !currentPassword) {
      setTwoFactorError('Please enter verification code and current password')
      return
    }

    setSettingUp2FA(true)
    setTwoFactorError('')

    try {
      const response = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: twoFactorToken,
          password: currentPassword
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to disable')
      }

      setTwoFactorSuccess('Two-factor authentication disabled successfully!')
      setTwoFactorEnabled(false)
      setTwoFactorToken('')
      setCurrentPassword('')
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : 'Failed to disable')
    } finally {
      setSettingUp2FA(false)
    }
  }

  if (!user) {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">⚙️ Settings</h1>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex gap-6">
            <div className="w-64 flex-shrink-0">
              <nav className="bg-white shadow rounded-lg p-4 space-y-2">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full text-left px-4 py-2 rounded-lg ${
                    activeTab === 'profile' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  👤 Profile
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`w-full text-left px-4 py-2 rounded-lg ${
                    activeTab === 'security' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🔒 Security
                </button>
                <button
                  onClick={() => setActiveTab('kyc')}
                  className={`w-full text-left px-4 py-2 rounded-lg ${
                    activeTab === 'kyc' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🆔 KYC Verification
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`w-full text-left px-4 py-2 rounded-lg ${
                    activeTab === 'notifications' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🔔 Notifications
                </button>
              </nav>
            </div>

            <div className="flex-1">
              {activeTab === 'profile' && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">Profile</h2>
                  
                  <div className="space-y-4 max-w-2xl">
                    <Input
                      label="Email Address"
                      value={user.email}
                      disabled
                      helperText="Email address cannot be changed"
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Account Role
                      </label>
                      <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-700">
                        {user.role === 'ADMIN' ? '🔱 Administrator' : '👤 User'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        KYC Status
                      </label>
                      <div className="px-4 py-2 bg-gray-50 rounded-lg">
                        {user.kycStatus === 'VERIFIED' && <span className="text-green-600">✅ Verified</span>}
                        {user.kycStatus === 'PENDING' && <span className="text-yellow-600">⏳ Pending</span>}
                        {user.kycStatus === 'NONE' && <span className="text-gray-600">❌ Not Verified</span>}
                        {user.kycStatus === 'REJECTED' && <span className="text-red-600">❌ Rejected</span>}
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button onClick={() => router.push('/kyc/status')}>
                        View KYC Status
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">Security</h2>
                  
                  <div className="space-y-6 max-w-2xl">
                    <div className="border-b border-gray-200 pb-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-4">Change Password</h3>
                      <div className="space-y-4">
                        <Input
                          label="Current Password"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter current password"
                          disabled={changingPassword}
                        />
                        <Input
                          label="New Password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password"
                          helperText="At least 8 characters"
                          disabled={changingPassword}
                        />
                        <Input
                          label="Confirm New Password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Enter new password again"
                          disabled={changingPassword}
                        />
                        
                        {passwordSuccess && (
                          <div className="rounded-md bg-green-50 p-4">
                            <div className="text-sm text-green-700">{passwordSuccess}</div>
                          </div>
                        )}
                        
                        {passwordError && (
                          <div className="rounded-md bg-red-50 p-4">
                            <div className="text-sm text-red-700">{passwordError}</div>
                          </div>
                        )}
                        
                        <Button 
                          onClick={handleChangePassword}
                          loading={changingPassword}
                          disabled={!currentPassword || !newPassword || !confirmPassword || changingPassword}
                        >
                          Change Password
                        </Button>
                      </div>
                    </div>

                    <div className="border-b border-gray-200 pb-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-4">Two-Factor Authentication</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        When 2FA is enabled, you will need an additional verification code to login
                      </p>
                      
                      {!twoFactorEnabled && !showSetup2FA && (
                        <Button 
                          variant="outline" 
                          onClick={handleSetup2FA}
                          loading={settingUp2FA}
                        >
                          Enable 2FA
                        </Button>
                      )}

                      {showSetup2FA && (
                        <div className="space-y-4">
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <h4 className="font-medium text-blue-900 mb-2">Scan QR Code</h4>
                            <p className="text-sm text-blue-800 mb-4">
                              Use Google Authenticator or other TOTP app to scan the QR code below
                            </p>
                            {qrCode && (
                              <div className="flex justify-center mb-4">
                                <img src={qrCode} alt="2FA QR Code" className="border rounded" />
                              </div>
                            )}
                            <p className="text-xs text-blue-700 mb-2">Manual entry key:</p>
                            <code className="text-xs bg-blue-100 p-2 rounded block break-all">
                              {manualKey}
                            </code>
                          </div>
                          
                          <Input
                            label="Verification Code"
                            value={twoFactorToken}
                            onChange={(e) => setTwoFactorToken(e.target.value)}
                            placeholder="Enter 6-digit code"
                            disabled={settingUp2FA}
                          />
                          
                          <div className="flex space-x-2">
                            <Button 
                              onClick={handleVerify2FA}
                              loading={settingUp2FA}
                              disabled={!twoFactorToken}
                            >
                              Verify and Enable
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => setShowSetup2FA(false)}
                              disabled={settingUp2FA}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {twoFactorEnabled && (
                        <div className="space-y-4">
                          <div className="p-4 bg-green-50 rounded-lg">
                            <p className="text-sm text-green-800">
                              ✅ Two-factor authentication is enabled, your account is more secure
                            </p>
                          </div>
                          
                          <div className="space-y-4">
                            <Input
                              label="Current Password"
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="Enter current password"
                              disabled={settingUp2FA}
                            />
                            <Input
                              label="Verification Code"
                              value={twoFactorToken}
                              onChange={(e) => setTwoFactorToken(e.target.value)}
                              placeholder="Enter 6-digit code"
                              disabled={settingUp2FA}
                            />
                            <Button 
                              variant="danger"
                              onClick={handleDisable2FA}
                              loading={settingUp2FA}
                              disabled={!twoFactorToken || !currentPassword}
                            >
                              Disable 2FA
                            </Button>
                          </div>
                        </div>
                      )}

                      {twoFactorSuccess && (
                        <div className="mt-4 rounded-md bg-green-50 p-4">
                          <div className="text-sm text-green-700">{twoFactorSuccess}</div>
                        </div>
                      )}
                      
                      {twoFactorError && (
                        <div className="mt-4 rounded-md bg-red-50 p-4">
                          <div className="text-sm text-red-700">{twoFactorError}</div>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-4">Login History</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        View your account login records
                      </p>
                      <Button variant="outline" onClick={() => router.push('/settings/login-history')}>
                        View Login History
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'kyc' && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">KYC Verification</h2>
                  
                  <div className="max-w-2xl">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <p className="text-sm text-blue-800">
                        KYC (Know Your Customer) verification enhances account security and unlocks additional features
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">Verification Status</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {user.kycStatus === 'VERIFIED' && 'Verification approved'}
                            {user.kycStatus === 'PENDING' && 'Under review, please wait'}
                            {user.kycStatus === 'NONE' && 'Not submitted'}
                            {user.kycStatus === 'REJECTED' && 'Verification rejected, please resubmit'}
                          </div>
                        </div>
                        <div>
                          {user.kycStatus === 'VERIFIED' ? (
                            <span className="text-green-600 text-2xl">✅</span>
                          ) : user.kycStatus === 'PENDING' ? (
                            <span className="text-yellow-600 text-2xl">⏳</span>
                          ) : (
                            <span className="text-gray-400 text-2xl">❌</span>
                          )}
                        </div>
                      </div>

                      <div className="flex space-x-3">
                        <Button onClick={() => router.push('/kyc/upload')}>
                          {user.kycStatus === 'NONE' || user.kycStatus === 'REJECTED' ? 'Start Verification' : 'Re-upload'}
                        </Button>
                        <Button variant="outline" onClick={() => router.push('/kyc/status')}>
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">Notification Settings</h2>
                  
                  <div className="max-w-2xl space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">Email Notifications</div>
                        <div className="text-sm text-gray-500">Receive transaction and account-related emails</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={notificationSettings.emailNotifications}
                          onChange={(e) => updateNotificationSetting('emailNotifications', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">Transaction Notifications</div>
                        <div className="text-sm text-gray-500">Send notification after each transaction completes</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={notificationSettings.transactionNotifications}
                          onChange={(e) => updateNotificationSetting('transactionNotifications', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">Security Alerts</div>
                        <div className="text-sm text-gray-500">Alerts for login and sensitive operations</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={notificationSettings.securityNotifications}
                          onChange={(e) => updateNotificationSetting('securityNotifications', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">System Notifications</div>
                        <div className="text-sm text-gray-500">System maintenance and important updates</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={notificationSettings.systemNotifications}
                          onChange={(e) => updateNotificationSetting('systemNotifications', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">Marketing Notifications</div>
                        <div className="text-sm text-gray-500">Product promotions and event information</div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={notificationSettings.marketingNotifications}
                          onChange={(e) => updateNotificationSetting('marketingNotifications', e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {notificationSuccess && (
                      <div className="rounded-md bg-green-50 p-4">
                        <div className="text-sm text-green-700">{notificationSuccess}</div>
                      </div>
                    )}

                    <div className="pt-4">
                      <Button 
                        onClick={saveNotificationSettings}
                        loading={savingNotifications}
                      >
                        Save Settings
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
