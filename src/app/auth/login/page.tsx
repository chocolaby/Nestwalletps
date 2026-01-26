'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🚀 表单提交了！', { email, password: '***' })
    setLoading(true)
    setError('')

    try {
      console.log('📡 正在调用登录API...')
      await login(email, password)
      console.log('✅ 登录API成功！')
      
      // 检查cookie是否已设置
      console.log('🍪 当前cookies:', document.cookie)
      
      // 增加延迟，确保cookie完全设置
      console.log('⏳ 等待500ms让cookie生效...')
      await new Promise(resolve => setTimeout(resolve, 500))
      
      console.log('🍪 延迟后cookies:', document.cookie)
      console.log('🔄 开始跳转到dashboard...')
      
      // 使用router.push跳转，这样AuthContext的user状态会被保留
      router.push('/dashboard')
    } catch (err) {
      console.error('❌ 登录出错了:', err)
      setError(err instanceof Error ? err.message : 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            登录 NestWallet
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            还没有账户？{' '}
            <Link href="/auth/register" className="font-medium text-blue-600 hover:text-blue-500">
              立即注册
            </Link>
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              label="邮箱地址"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="请输入邮箱"
            />
            
            <Input
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            loading={loading}
          >
            登录
          </Button>
        </form>
      </div>
    </div>
  )
}
