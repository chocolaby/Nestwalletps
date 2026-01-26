'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

interface Document {
  id: string
  documentType: string
  fileName: string
  fileSize: number
  status: string
  createdAt: string
}

interface LivenessStatus {
  hasCompleted: boolean
  latestCheck: {
    id: string
    status: string
    confidence: number
    completedAt: string
    createdAt: string
  } | null
  stats: {
    total: number
    passed: number
  }
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  ID_CARD: '身份证',
  PASSPORT: '护照',
  DRIVER_LICENSE: '驾驶证',
  UTILITY_BILL: '水电账单',
  BANK_STATEMENT: '银行对账单'
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待审核',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  PASSED: '已通过',
  FAILED: '未通过'
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  PASSED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800'
}

// KYC 步骤定义
const KYC_STEPS = [
  { id: 'document', label: '证件上传', description: '上传身份证明文件' },
  { id: 'liveness', label: '活体检测', description: '完成人脸验证' },
  { id: 'review', label: '人工审核', description: '等待审核通过' }
]

export default function KYCStatusPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [status, setStatus] = useState<string>('PENDING')
  const [livenessStatus, setLivenessStatus] = useState<LivenessStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    fetchStatus()
  }, [user, router])

  const fetchStatus = async () => {
    try {
      // 并行获取文档状态和活体检测状态
      const [docResponse, livenessResponse] = await Promise.all([
        fetch('/api/kyc/status'),
        fetch('/api/kyc/liveness')
      ])

      if (docResponse.ok) {
        const data = await docResponse.json()
        setDocuments(data.documents || [])
        setStatus(data.status || 'PENDING')
      }

      if (livenessResponse.ok) {
        const livenessData = await livenessResponse.json()
        setLivenessStatus(livenessData)
      }
    } catch (error) {
      console.error('获取KYC状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 计算当前步骤
  const getCurrentStep = () => {
    const hasDocuments = documents.length > 0
    const hasApprovedDoc = documents.some(d => d.status === 'APPROVED')
    const hasLiveness = livenessStatus?.hasCompleted

    if (status === 'APPROVED') return 3 // 全部完成
    if (hasApprovedDoc && hasLiveness) return 2 // 等待最终审核
    if (hasDocuments && hasLiveness) return 2 // 等待审核
    if (hasDocuments) return 1 // 需要活体检测
    return 0 // 需要上传文档
  }

  const currentStep = getCurrentStep()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">KYC认证状态</h1>
          <p className="mt-2 text-gray-600">
            查看您的身份认证状态和进度
          </p>
        </div>

        {/* 步骤进度条 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">认证进度</h2>
          <div className="relative">
            {/* 进度线 */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${(currentStep / (KYC_STEPS.length - 1)) * 100}%` }}
              />
            </div>

            {/* 步骤点 */}
            <div className="relative flex justify-between">
              {KYC_STEPS.map((step, index) => {
                const isCompleted = index < currentStep
                const isCurrent = index === currentStep
                const isPending = index > currentStep

                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium z-10 transition-colors ${
                      isCompleted
                        ? 'bg-blue-600 text-white'
                        : isCurrent
                        ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-600'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {isCompleted ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <p className={`text-sm font-medium ${isCurrent ? 'text-blue-600' : 'text-gray-900'}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{step.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 总体状态卡片 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                认证状态
              </h2>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>
                {STATUS_LABELS[status] || status}
              </span>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => router.push('/kyc/upload')}>
                上传文档
              </Button>
              <Button onClick={() => router.push('/kyc/liveness')}>
                活体检测
              </Button>
            </div>
          </div>

          {status === 'PENDING' && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800">
                {currentStep === 0 && '请先上传身份证明文件'}
                {currentStep === 1 && '请完成活体检测以继续认证流程'}
                {currentStep === 2 && '您的文档正在审核中，通常需要1-3个工作日'}
              </p>
            </div>
          )}

          {status === 'APPROVED' && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">
                您的身份已通过认证，可以使用完整功能
              </p>
            </div>
          )}

          {status === 'REJECTED' && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800">
                您的认证未通过，请重新上传清晰的文档
              </p>
            </div>
          )}
        </div>

        {/* 活体检测状态卡片 */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              活体检测
            </h2>
            {livenessStatus?.hasCompleted && (
              <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                已完成
              </span>
            )}
          </div>

          <div className="p-6">
            {livenessStatus?.hasCompleted ? (
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">活体检测已通过</p>
                  <p className="text-sm text-gray-500">
                    置信度: {((livenessStatus.latestCheck?.confidence || 0) * 100).toFixed(0)}%
                  </p>
                  {livenessStatus.latestCheck?.completedAt && (
                    <p className="text-xs text-gray-400">
                      完成时间: {new Date(livenessStatus.latestCheck.completedAt).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  尚未完成活体检测，请点击下方按钮开始
                </p>
                <Button onClick={() => router.push('/kyc/liveness')}>
                  开始活体检测
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 文档列表 */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              已上传文档
            </h2>
          </div>

          {documents.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-600">
                还没有上传任何文档
              </p>
              <Button
                onClick={() => router.push('/kyc/upload')}
                className="mt-4"
              >
                立即上传
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {documents.map((doc) => (
                <div key={doc.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <svg
                            className="h-10 w-10 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                          </p>
                          <p className="text-sm text-gray-500">
                            {doc.fileName} · {(doc.fileSize / 1024 / 1024).toFixed(2)} MB
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(doc.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[doc.status] || 'bg-gray-100 text-gray-800'}`}>
                        {STATUS_LABELS[doc.status] || doc.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 返回按钮 */}
        <div className="mt-6">
          <Button
            variant="outline"
            onClick={() => router.push('/dashboard')}
          >
            返回Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
