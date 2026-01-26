'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface WalletModeSwitchProps {
  walletId: string
  currentType: string
  onModeChange: (walletId: string, newType: string) => void
}

export default function WalletModeSwitch({ 
  walletId, 
  currentType, 
  onModeChange 
}: WalletModeSwitchProps) {
  const [switching, setSwitching] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [targetType, setTargetType] = useState('')

  const handleSwitchMode = async (newType: string) => {
    setTargetType(newType)
    setShowConfirm(true)
  }

  const confirmSwitch = async () => {
    setSwitching(true)
    try {
      const response = await fetch(`/api/wallet/${walletId}/switch-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newType: targetType })
      })

      if (response.ok) {
        onModeChange(walletId, targetType)
        setShowConfirm(false)
      } else {
        const error = await response.json()
        alert(error.error || '切换失败')
      }
    } catch (error) {
      alert('切换失败')
    } finally {
      setSwitching(false)
    }
  }

  const getModeInfo = (type: string) => {
    return type === 'CUSTODIAL' 
      ? { name: '托管模式', icon: '🏦', color: 'text-blue-600' }
      : { name: '非托管模式', icon: '🔐', color: 'text-green-600' }
  }

  const currentMode = getModeInfo(currentType)
  const targetMode = getModeInfo(targetType)

  return (
    <div className="space-y-4">
      {/* 当前模式显示 */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{currentMode.icon}</span>
          <div>
            <div className={`font-medium ${currentMode.color}`}>
              {currentMode.name}
            </div>
            <div className="text-sm text-gray-500">
              {currentType === 'CUSTODIAL' 
                ? '私钥由平台托管，更安全便捷'
                : '私钥由用户自行保管，完全去中心化'
              }
            </div>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSwitchMode(
            currentType === 'CUSTODIAL' ? 'NON_CUSTODIAL' : 'CUSTODIAL'
          )}
          disabled={switching}
        >
          切换模式
        </Button>
      </div>

      {/* 确认弹窗 */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              ⚠️ 确认切换钱包模式
            </h3>
            
            <div className="space-y-4 mb-6">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  您正在将钱包从 <strong>{currentMode.name}</strong> 切换到 <strong>{targetMode.name}</strong>
                </p>
              </div>

              {targetType === 'NON_CUSTODIAL' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-900 mb-2">重要提醒：</h4>
                  <ul className="text-sm text-red-800 space-y-1">
                    <li>• 切换到非托管模式后，您需要自行保管私钥</li>
                    <li>• 平台将不再存储您的私钥</li>
                    <li>• 如果丢失私钥，资产将无法找回</li>
                    <li>• 请确保您已安全备份私钥</li>
                  </ul>
                </div>
              )}

              {targetType === 'CUSTODIAL' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">切换说明：</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• 切换到托管模式后，私钥将由平台安全保管</li>
                    <li>• 您可以享受更便捷的交易体验</li>
                    <li>• 平台将提供额外的安全保障</li>
                    <li>• 支持更多高级功能</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={confirmSwitch}
                loading={switching}
                className="flex-1"
                variant={targetType === 'NON_CUSTODIAL' ? 'danger' : 'primary'}
              >
                确认切换
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowConfirm(false)}
                disabled={switching}
                className="flex-1"
              >
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
