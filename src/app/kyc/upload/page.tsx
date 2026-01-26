'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

const DOCUMENT_TYPES = [
  { value: 'ID_CARD', label: '身份证' },
  { value: 'PASSPORT', label: '护照' },
  { value: 'DRIVER_LICENSE', label: '驾驶证' },
  { value: 'UTILITY_BILL', label: '水电账单' },
  { value: 'BANK_STATEMENT', label: '银行对账单' }
]

export default function KYCUploadPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [documentType, setDocumentType] = useState('ID_CARD')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // 验证文件类型
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
    if (!validTypes.includes(selectedFile.type)) {
      setError('只支持 JPG、PNG、GIF 或 PDF 格式')
      return
    }

    // 验证文件大小 (5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('文件大小不能超过 5MB')
      return
    }

    setFile(selectedFile)
    setError('')

    // 生成预览
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(selectedFile)
    } else {
      setPreview(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('请选择要上传的文件')
      return
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('documentType', documentType)

      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/kyc/upload', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '上传失败')
      }

      const data = await response.json()
      
      // 延迟跳转，让用户看到100%
      setTimeout(() => {
        router.push('/kyc/status')
      }, 500)

    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
      setUploadProgress(0)
    } finally {
      setUploading(false)
    }
  }

  if (!user) {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">KYC身份认证</h1>
          <p className="mt-2 text-gray-600">
            上传您的身份证明文件以完成身份验证
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {/* 文档类型选择 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              证件类型
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={uploading}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* 文件上传区域 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              上传文件
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              {!preview && !file ? (
                <div>
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
                    点击选择文件或拖拽文件到此处
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    支持 JPG、PNG、GIF、PDF，最大5MB
                  </p>
                </div>
              ) : (
                <div>
                  {preview && (
                    <img
                      src={preview}
                      alt="预览"
                      className="max-h-64 mx-auto rounded"
                    />
                  )}
                  <p className="mt-2 text-sm text-gray-600">
                    {file?.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file!.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
              
              <input
                type="file"
                onChange={handleFileChange}
                accept="image/*,.pdf"
                className="hidden"
                id="file-upload"
                disabled={uploading}
              />
              <label
                htmlFor="file-upload"
                className="mt-4 inline-block cursor-pointer bg-white px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                选择文件
              </label>
            </div>
          </div>

          {/* 上传进度 */}
          {uploading && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>上传中...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
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
              onClick={handleUpload}
              disabled={!file || uploading}
              loading={uploading}
              className="flex-1"
            >
              {uploading ? '上传中...' : '上传文件'}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              disabled={uploading}
            >
              取消
            </Button>
          </div>

          {/* 说明 */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-2">
              📋 上传说明
            </h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 请确保照片清晰，信息完整可见</li>
              <li>• 身份证需要上传正反两面</li>
              <li>• 文件将被安全加密存储</li>
              <li>• 审核通常在1-3个工作日内完成</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
