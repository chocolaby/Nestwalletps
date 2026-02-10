'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

// Liveness detection challenge types
const CHALLENGE_TYPES = [
  { type: 'BLINK', label: 'Please Blink', icon: '👁️', instruction: 'Please blink naturally twice' },
  { type: 'NOD', label: 'Please Nod', icon: '🙂', instruction: 'Please nod slowly' },
  { type: 'SHAKE', label: 'Please Shake Head', icon: '🙂', instruction: 'Please shake your head left and right slowly' },
  { type: 'SMILE', label: 'Please Smile', icon: '😊', instruction: 'Please show a smile' },
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

  // Initialize camera
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
      setError('Unable to access camera, please ensure camera permissions are granted')
      setStatus('failed')
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  // Simulate face detection (in actual projects should use face-api.js or TensorFlow.js)
  const startFaceDetection = useCallback(() => {
    // Simulate face detection delay
    setTimeout(() => {
      setFaceDetected(true)
      setCountdown(3)
    }, 1500)
  }, [])

  // Countdown effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && faceDetected && status === 'detecting') {
      // Countdown ended, start challenge
      startChallenge()
    }
  }, [countdown, faceDetected, status])

  // Start challenge
  const startChallenge = useCallback(() => {
    setProgress(0)
    simulateChallengeDetection()
  }, [currentChallenge])

  // Simulate challenge detection (in actual projects should use real face motion detection)
  const simulateChallengeDetection = useCallback(() => {
    let progressValue = 0
    const interval = setInterval(() => {
      progressValue += Math.random() * 15 + 5
      if (progressValue >= 100) {
        progressValue = 100
        clearInterval(interval)

        // Simulate detection result (90% success rate)
        const success = Math.random() > 0.1
        handleChallengeResult(success)
      }
      setProgress(Math.min(progressValue, 100))
    }, 300)

    return () => clearInterval(interval)
  }, [currentChallenge])

  // Process challenge result
  const handleChallengeResult = useCallback(async (success: boolean) => {
    const newChallengeStatus = [...challengeStatus]
    newChallengeStatus[currentChallenge] = success ? 'passed' : 'failed'
    setChallengeStatus(newChallengeStatus)

    if (success) {
      // Check if all challenges are complete
      if (currentChallenge >= CHALLENGE_TYPES.length - 1) {
        // All challenges complete
        setStatus('processing')
        await submitLivenessResult(newChallengeStatus)
      } else {
        // Move to next challenge
        setTimeout(() => {
          setCurrentChallenge(prev => prev + 1)
          setProgress(0)
          simulateChallengeDetection()
        }, 1000)
      }
    } else {
      // Challenge failed
      setAttempts(prev => prev + 1)
      if (attempts + 1 >= maxAttempts) {
        setStatus('failed')
        setError('Too many failed detection attempts, please try again later')
        await submitLivenessResult(newChallengeStatus, true)
      } else {
        // Retry current challenge
        setTimeout(() => {
          setProgress(0)
          simulateChallengeDetection()
        }, 1500)
      }
    }
  }, [currentChallenge, challengeStatus, attempts])

  // Submit liveness detection result
  const submitLivenessResult = async (results: ('pending' | 'passed' | 'failed')[], failed = false) => {
    try {
      // Capture face image
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
        throw new Error('Submission failed')
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
      setError('Failed to submit results, please try again')
      setStatus('failed')
    }
  }

  // Restart detection
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

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Redirect if not logged in
  if (!user) {
    router.push('/auth/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Liveness Detection</h1>
          <p className="mt-2 text-gray-600">
            Please follow the prompts to complete face verification, ensure sufficient lighting and face is clearly visible
          </p>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Camera area */}
          <div className="relative bg-black aspect-[4/3]">
            {status === 'idle' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <div className="w-24 h-24 mb-4 rounded-full border-4 border-dashed border-gray-400 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-gray-400">Click the button below to start detection</p>
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

                {/* Face frame */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className={`w-64 h-80 border-4 rounded-[50%] transition-colors duration-300 ${
                    faceDetected ? 'border-green-500' : 'border-white'
                  }`}>
                    {/* Corner markers */}
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-current rounded-tl-3xl" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-current rounded-tr-3xl" />
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-current rounded-bl-3xl" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-current rounded-br-3xl" />
                  </div>
                </div>

                {/* Countdown */}
                {countdown > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-8xl font-bold text-white animate-pulse">
                      {countdown}
                    </div>
                  </div>
                )}

                {/* Processing */}
                {status === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center text-white">
                      <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                      <p className="text-lg">Verifying...</p>
                    </div>
                  </div>
                )}

                {/* Success */}
                {status === 'success' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/80">
                    <div className="text-center text-white">
                      <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-4">
                        <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-2xl font-bold">Verification Successful</p>
                      <p className="mt-2">Redirecting...</p>
                    </div>
                  </div>
                )}

                {/* Failed */}
                {status === 'failed' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-500/80">
                    <div className="text-center text-white">
                      <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto mb-4">
                        <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <p className="text-2xl font-bold">Verification Failed</p>
                      <p className="mt-2">{error || 'Please try again'}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Challenge prompt area */}
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

              {/* Progress bar */}
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Challenge status indicators */}
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

          {/* Error message */}
          {error && status !== 'failed' && (
            <div className="p-4 bg-red-50 border-t border-red-100">
              <p className="text-sm text-red-700 text-center">{error}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="p-6 border-t border-gray-200">
            <div className="flex space-x-4">
              {status === 'idle' && (
                <Button onClick={initCamera} className="flex-1">
                  Start Detection
                </Button>
              )}

              {(status === 'failed' || status === 'success') && (
                <>
                  {status === 'failed' && (
                    <Button onClick={restartDetection} className="flex-1">
                      Retry Detection
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => router.push('/kyc/status')}
                    className="flex-1"
                  >
                    Back
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
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Detection Instructions</h3>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Please ensure sufficient lighting and avoid backlighting</li>
              <li>• Please position your face within the oval frame</li>
              <li>• Please remove glasses, hats and other obstructions</li>
              <li>• Complete the corresponding actions as prompted</li>
              <li>• Maximum {maxAttempts} attempts per action</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
