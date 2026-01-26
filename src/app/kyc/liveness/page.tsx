'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

// 活体检测挑战类型
const CHALLENGE_TYPES = [
  { type: 'BLINK', label: '请眨眨眼', icon: '👁️', instruction: '请自然地眨眼两次' },
  { type: 'NOD', label: '请点点头', icon: '🙂', instruction: '请缓慢地点头' },
  { type: 'SHAKE', label: '请摇摇头', icon: '🙂', instruction: '请缓慢地左右摇头' },
  { type: 'SMILE', label: '请微笑', icon: '😊', instruction: '请露出微笑' },
]

type DetectionStatus = 'idle' | 'initializing' | 'detecting' | 'processing' | 'success' | 'failed'

export default function LivenessCheckPage() {
  const { user } = useAuth()
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<DetectionStatus>('idle')
  const [currentChallenge, setCurrentChallenge] = useState(0)
  const [challengeStatus, setChallengeStatus] = useState<('pending' | 'passed' | 'failed')[]>(
    CHALLENGE_TYPES.map(() => 'pending')
  )
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [faceDetected, setFaceDetected] = useState(false)
  const [progress, setProgress] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const maxAttempts = 3

  // 初始化摄像头
  const initCamera = useCallback(async () => {
    setStatus('initializing')
    setError('')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        await videoRef.current.play()
        setStatus('detecting')
        startFaceDetection()
      }
    } catch (err) {
      console.error('Camera error:', err)
      setError('无法访问摄像头，请确保已授予摄像头权限')
      setStatus('failed')
    }
  }, [])

  // 停止摄像头
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  // 模拟人脸检测（实际项目中应使用 face-api.js 或 TensorFlow.js）
  const startFaceDetection = useCallback(() => {
    // 模拟人脸检测延迟
    setTimeout(() => {
      setFaceDetected(true)
      setCountdown(3)
    }, 1500)
  }, [])

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && faceDetected && status === 'detecting') {
      // 倒计时结束，开始挑战
      startChallenge()
    }
  }, [countdown, faceDetected, status])

  // 开始挑战
  const startChallenge = useCallback(() => {
    setProgress(0)
    simulateChallengeDetection()
  }, [currentChallenge])

  // 模拟挑战检测（实际项目中应使用真实的人脸动作检测）
  const simulateChallengeDetection = useCallback(() => {
    let progressValue = 0
    const interval = setInterval(() => {
      progressValue += Math.random() * 15 + 5
      if (progressValue >= 100) {
        progressValue = 100
        clearInterval(interval)

        // 模拟检测结果（90% 成功率）
        const success = Math.random() > 0.1
        handleChallengeResult(success)
      }
      setProgress(Math.min(progressValue, 100))
    }, 300)

    return () => clearInterval(interval)
  }, [currentChallenge])

  // 处理挑战结果
  const handleChallengeResult = useCallback(async (success: boolean) => {
    const newChallengeStatus = [...challengeStatus]
    newChallengeStatus[currentChallenge] = success ? 'passed' : 'failed'
    setChallengeStatus(newChallengeStatus)

    if (success) {
      // 检查是否完成所有挑战
      if (currentChallenge >= CHALLENGE_TYPES.length - 1) {
        // 所有挑战完成
        setStatus('processing')
        await submitLivenessResult(newChallengeStatus)
      } else {
        // 进入下一个挑战
        setTimeout(() => {
          setCurrentChallenge(prev => prev + 1)
          setProgress(0)
          simulateChallengeDetection()
        }, 1000)
      }
    } else {
      // 挑战失败
      setAttempts(prev => prev + 1)
      if (attempts + 1 >= maxAttempts) {
        setStatus('failed')
        setError('检测失败次数过多，请稍后重试')
        await submitLivenessResult(newChallengeStatus, true)
      } else {
        // 重试当前挑战
        setTimeout(() => {
          setProgress(0)
          simulateChallengeDetection()
        }, 1500)
      }
    }
  }, [currentChallenge, challengeStatus, attempts])

  // 提交活体检测结果
  const submitLivenessResult = async (results: ('pending' | 'passed' | 'failed')[], failed = false) => {
    try {
      // 截取人脸图片
      let faceImage = ''
      if (videoRef.current && canvasRef.current) {
        const canvas = canvasRef.current
        const video = videoRef.current
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0)
          faceImage = canvas.toDataURL('image/jpeg', 0.8)
        }
      }

      const response = await fetch('/api/kyc/liveness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenges: CHALLENGE_TYPES.map((c, i) => ({
            type: c.type,
            result: results[i]
          })),
          faceImage,
          passed: !failed && results.every(r => r === 'passed')
        })
      })

      if (!response.ok) {
        throw new Error('提交失败')
      }

      const data = await response.json()

      if (data.passed) {
        setStatus('success')
        setTimeout(() => {
          router.push('/kyc/status')
        }, 2000)
      } else {
        setStatus('failed')
      }
    } catch (err) {
      console.error('Submit error:', err)
      setError('提交结果失败，请重试')
      setStatus('failed')
    }
  }

  // 重新开始检测
  const restartDetection = () => {
    setStatus('idle')
    setCurrentChallenge(0)
    setChallengeStatus(CHALLENGE_TYPES.map(() => 'pending'))
    setError('')
    setCountdown(0)
    setFaceDetected(false)
    setProgress(0)
    setAttempts(0)
    stopCamera()
  }

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // 未登录跳转
  if (!user) {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">活体检测</h1>
          <p className="mt-2 text-gray-600">
            请按照提示完成人脸验证，确保光线充足且面部清晰可见
          </p>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* 摄像头区域 */}
          <div className="relative bg-black aspect-[4/3]">
            {status === 'idle' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <div className="w-24 h-24 mb-4 rounded-full border-4 border-dashed border-gray-400 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-400">点击下方按钮开始检测</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* 人脸框 */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-64 h-80 border-4 rounded-[50%] transition-colors duration-300 ${
                    faceDetected ? 'border-green-500' : 'border-white'
                  }`}>
                    {/* 四角标记 */}
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-current rounded-tl-3xl" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-current rounded-tr-3xl" />
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-current rounded-bl-3xl" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-current rounded-br-3xl" />
                  </div>
                </div>

                {/* 倒计时 */}
                {countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-8xl font-bold text-white animate-pulse">
                      {countdown}
                    </div>
                  </div>
                )}

                {/* 处理中 */}
                {status === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center text-white">
                      <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-lg">正在验证...</p>
                    </div>
                  </div>
                )}

                {/* 成功 */}
                {status === 'success' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/80">
                    <div className="text-center text-white">
                      <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-4">
                        <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-2xl font-bold">验证成功</p>
                      <p className="mt-2">正在跳转...</p>
                    </div>
                  </div>
                )}

                {/* 失败 */}
                {status === 'failed' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-500/80">
                    <div className="text-center text-white">
                      <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-4">
                        <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <p className="text-2xl font-bold">验证失败</p>
                      <p className="mt-2">{error || '请重新尝试'}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 挑战提示区域 */}
          {status === 'detecting' && faceDetected && countdown === 0 && (
            <div className="p-6 bg-blue-50 border-t border-blue-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <span className="text-4xl">{CHALLENGE_TYPES[currentChallenge].icon}</span>
                  <div>
                    <p className="text-lg font-semibold text-blue-900">
                      {CHALLENGE_TYPES[currentChallenge].label}
                    </p>
                    <p className="text-sm text-blue-700">
                      {CHALLENGE_TYPES[currentChallenge].instruction}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-blue-600">
                  {currentChallenge + 1} / {CHALLENGE_TYPES.length}
                </div>
              </div>

              {/* 进度条 */}
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 挑战状态指示器 */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex justify-center space-x-4">
              {CHALLENGE_TYPES.map((challenge, index) => (
                <div
                  key={challenge.type}
                  className={`flex flex-col items-center ${
                    index === currentChallenge && status === 'detecting' ? 'opacity-100' : 'opacity-60'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                    challengeStatus[index] === 'passed'
                      ? 'bg-green-100 text-green-600'
                      : challengeStatus[index] === 'failed'
                      ? 'bg-red-100 text-red-600'
                      : index === currentChallenge && status === 'detecting'
                      ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-400'
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {challengeStatus[index] === 'passed' ? '✓' :
                     challengeStatus[index] === 'failed' ? '✗' :
                     challenge.icon}
                  </div>
                  <span className="text-xs mt-1 text-gray-500">{challenge.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 错误提示 */}
          {error && status !== 'failed' && (
            <div className="p-4 bg-red-50 border-t border-red-100">
              <p className="text-sm text-red-700 text-center">{error}</p>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="p-6 border-t border-gray-200">
            <div className="flex space-x-4">
              {status === 'idle' && (
                <Button onClick={initCamera} className="flex-1">
                  开始检测
                </Button>
              )}

              {(status === 'failed' || status === 'success') && (
                <>
                  {status === 'failed' && (
                    <Button onClick={restartDetection} className="flex-1">
                      重新检测
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => router.push('/kyc/status')}
                    className="flex-1"
                  >
                    返回
                  </Button>
                </>
              )}

              {(status === 'initializing' || status === 'detecting' || status === 'processing') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    stopCamera()
                    restartDetection()
                  }}
                  className="flex-1"
                >
                  取消
                </Button>
              )}
            </div>
          </div>

          {/* 说明 */}
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">检测说明</h3>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• 请确保光线充足，避免逆光</li>
              <li>• 请将面部置于椭圆框内</li>
              <li>• 请摘下眼镜、帽子等遮挡物</li>
              <li>• 按照提示完成相应动作</li>
              <li>• 每个动作最多尝试 {maxAttempts} 次</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
