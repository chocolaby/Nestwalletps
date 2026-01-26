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
  
  // 修改密码相关状态
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // 2FA相关状态
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [twoFactorToken, setTwoFactorToken] = useState('')
  const [twoFactorError, setTwoFactorError] = useState('')
  const [twoFactorSuccess, setTwoFactorSuccess] = useState('')
  
  // 通知设置状态
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

  // 获取通知设置
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
      console.error('获取通知设置失败:', error)
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
        setNotificationSuccess('通知设置已保存')
        setTimeout(() => setNotificationSuccess(''), 3000)
      } else {
        console.error('保存通知设置失败:', data.error)
      }
    } catch (error) {
      console.error('保存通知设置失败:', error)
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

    // 客户端验证
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('请填写所有字段')
      setChangingPassword(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('新密码和确认密码不匹配')
      setChangingPassword(false)
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('新密码至少需要8个字符')
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
        throw new Error(error.error || '密码修改失败')
      }

      setPasswordSuccess('密码修改成功！')
      // 清空表单
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : '密码修改失败')
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
        throw new Error(error.error || '生成2FA密钥失败')
      }

      const data = await response.json()
      setQrCode(data.qrCode)
      setManualKey(data.manualEntryKey)
      setShowSetup2FA(true)
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : '生成2FA密钥失败')
    } finally {
      setSettingUp2FA(false)
    }
  }

  const handleVerify2FA = async () => {
    if (!twoFactorToken) {
      setTwoFactorError('请输入验证码')
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
        throw new Error(error.error || '验证失败')
      }

      setTwoFactorSuccess('两步验证已成功启用！')
      setTwoFactorEnabled(true)
      setShowSetup2FA(false)
      setTwoFactorToken('')
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : '验证失败')
    } finally {
      setSettingUp2FA(false)
    }
  }

  const handleDisable2FA = async () => {
    if (!twoFactorToken || !currentPassword) {
      setTwoFactorError('请输入验证码和当前密码')
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
        throw new Error(error.error || '禁用失败')
      }

      setTwoFactorSuccess('两步验证已成功禁用！')
      setTwoFactorEnabled(false)
      setTwoFactorToken('')
      setCurrentPassword('')
    } catch (err) {
      setTwoFactorError(err instanceof Error ? err.message : '禁用失败')
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
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">⚙️ 设置</h1>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              返回Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex gap-6">
            {/* 侧边栏 */}
            <div className="w-64 flex-shrink-0">
              <nav className="bg-white shadow rounded-lg p-4 space-y-2">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full text-left px-4 py-2 rounded-lg ${
                    activeTab === 'profile' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  👤 个人信息
                </button>
                <button
                  onClick={() => setActiveTab('security')}
                  className={`w-full text-left px-4 py-2 rounded-lg ${
                    activeTab === 'security' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🔒 安全设置
                </button>
                <button
                  onClick={() => setActiveTab('kyc')}
                  className={`w-full text-left px-4 py-2 rounded-lg ${
                    activeTab === 'kyc' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🆔 KYC认证
                </button>
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`w-full text-left px-4 py-2 rounded-lg ${
                    activeTab === 'notifications' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  🔔 通知设置
                </button>
              </nav>
            </div>

            {/* 内容区域 */}
            <div className="flex-1">
              {/* 个人信息 */}
              {activeTab === 'profile' && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">个人信息</h2>
                  
                  <div className="space-y-4 max-w-2xl">
                    <Input
                      label="邮箱地址"
                      value={user.email}
                      disabled
                      helperText="邮箱地址不可修改"
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        账户角色
                      </label>
                      <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-700">
                        {user.role === 'ADMIN' ? '🔱 管理员' : '👤 普通用户'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        KYC状态
                      </label>
                      <div className="px-4 py-2 bg-gray-50 rounded-lg">
                        {user.kycStatus === 'VERIFIED' && <span className="text-green-600">✅ 已认证</span>}
                        {user.kycStatus === 'PENDING' && <span className="text-yellow-600">⏳ 审核中</span>}
                        {user.kycStatus === 'NONE' && <span className="text-gray-600">❌ 未认证</span>}
                        {user.kycStatus === 'REJECTED' && <span className="text-red-600">❌ 已拒绝</span>}
                      </div>
                    </div>

                    <div className="pt-4">
                      <Button onClick={() => router.push('/kyc/status')}>
                        查看KYC状态
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 安全设置 */}
              {activeTab === 'security' && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">安全设置</h2>
                  
                  <div className="space-y-6 max-w-2xl">
                    <div className="border-b border-gray-200 pb-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-4">修改密码</h3>
                      <div className="space-y-4">
                        <Input
                          label="当前密码"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="请输入当前密码"
                          disabled={changingPassword}
                        />
                        <Input
                          label="新密码"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="请输入新密码"
                          helperText="至少8个字符"
                          disabled={changingPassword}
                        />
                        <Input
                          label="确认新密码"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="请再次输入新密码"
                          disabled={changingPassword}
                        />
                        
                        {/* 成功提示 */}
                        {passwordSuccess && (
                          <div className="rounded-md bg-green-50 p-4">
                            <div className="text-sm text-green-700">{passwordSuccess}</div>
                          </div>
                        )}
                        
                        {/* 错误提示 */}
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
                          修改密码
                        </Button>
                      </div>
                    </div>

                    <div className="border-b border-gray-200 pb-6">
                      <h3 className="text-sm font-medium text-gray-900 mb-4">两步验证</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        启用两步验证后，登录时需要额外的验证码
                      </p>
                      
                      {!twoFactorEnabled && !showSetup2FA && (
                        <Button 
                          variant="outline" 
                          onClick={handleSetup2FA}
                          loading={settingUp2FA}
                        >
                          启用两步验证
                        </Button>
                      )}

                      {showSetup2FA && (
                        <div className="space-y-4">
                          <div className="p-4 bg-blue-50 rounded-lg">
                            <h4 className="font-medium text-blue-900 mb-2">扫描二维码</h4>
                            <p className="text-sm text-blue-800 mb-4">
                              使用Google Authenticator或其他TOTP应用扫描下方二维码
                            </p>
                            {qrCode && (
                              <div className="flex justify-center mb-4">
                                <img src={qrCode} alt="2FA QR Code" className="border rounded" />
                              </div>
                            )}
                            <p className="text-xs text-blue-700 mb-2">手动输入密钥：</p>
                            <code className="text-xs bg-blue-100 p-2 rounded block break-all">
                              {manualKey}
                            </code>
                          </div>
                          
                          <Input
                            label="验证码"
                            value={twoFactorToken}
                            onChange={(e) => setTwoFactorToken(e.target.value)}
                            placeholder="请输入6位验证码"
                            disabled={settingUp2FA}
                          />
                          
                          <div className="flex space-x-2">
                            <Button 
                              onClick={handleVerify2FA}
                              loading={settingUp2FA}
                              disabled={!twoFactorToken}
                            >
                              验证并启用
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => setShowSetup2FA(false)}
                              disabled={settingUp2FA}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      )}

                      {twoFactorEnabled && (
                        <div className="space-y-4">
                          <div className="p-4 bg-green-50 rounded-lg">
                            <p className="text-sm text-green-800">
                              ✅ 两步验证已启用，您的账户更安全了
                            </p>
                          </div>
                          
                          <div className="space-y-4">
                            <Input
                              label="当前密码"
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="请输入当前密码"
                              disabled={settingUp2FA}
                            />
                            <Input
                              label="验证码"
                              value={twoFactorToken}
                              onChange={(e) => setTwoFactorToken(e.target.value)}
                              placeholder="请输入6位验证码"
                              disabled={settingUp2FA}
                            />
                            <Button 
                              variant="danger"
                              onClick={handleDisable2FA}
                              loading={settingUp2FA}
                              disabled={!twoFactorToken || !currentPassword}
                            >
                              禁用两步验证
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* 成功提示 */}
                      {twoFactorSuccess && (
                        <div className="mt-4 rounded-md bg-green-50 p-4">
                          <div className="text-sm text-green-700">{twoFactorSuccess}</div>
                        </div>
                      )}
                      
                      {/* 错误提示 */}
                      {twoFactorError && (
                        <div className="mt-4 rounded-md bg-red-50 p-4">
                          <div className="text-sm text-red-700">{twoFactorError}</div>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-4">登录历史</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        查看您账户的登录记录
                      </p>
                      <Button variant="outline" onClick={() => router.push('/settings/login-history')}>
                        查看登录历史
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* KYC认证 */}
              {activeTab === 'kyc' && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">KYC认证</h2>
                  
                  <div className="max-w-2xl">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <p className="text-sm text-blue-800">
                        KYC（Know Your Customer）认证可以提升账户安全性，解锁更多功能
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div>
                          <div className="font-medium text-gray-900">认证状态</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {user.kycStatus === 'VERIFIED' && '已通过认证'}
                            {user.kycStatus === 'PENDING' && '审核中，请耐心等待'}
                            {user.kycStatus === 'NONE' && '未提交认证'}
                            {user.kycStatus === 'REJECTED' && '认证被拒绝，请重新提交'}
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
                          {user.kycStatus === 'NONE' || user.kycStatus === 'REJECTED' ? '开始认证' : '重新上传'}
                        </Button>
                        <Button variant="outline" onClick={() => router.push('/kyc/status')}>
                          查看详情
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 通知设置 */}
              {activeTab === 'notifications' && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">通知设置</h2>
                  
                  <div className="max-w-2xl space-y-4">
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">邮件通知</div>
                        <div className="text-sm text-gray-500">接收交易和账户相关邮件</div>
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
                        <div className="font-medium text-gray-900">交易通知</div>
                        <div className="text-sm text-gray-500">每笔交易完成后发送通知</div>
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
                        <div className="font-medium text-gray-900">安全提醒</div>
                        <div className="text-sm text-gray-500">登录和敏感操作时提醒</div>
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
                        <div className="font-medium text-gray-900">系统通知</div>
                        <div className="text-sm text-gray-500">系统维护和重要更新通知</div>
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
                        <div className="font-medium text-gray-900">营销通知</div>
                        <div className="text-sm text-gray-500">产品推广和活动信息</div>
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

                    {/* 成功提示 */}
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
                        保存设置
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
