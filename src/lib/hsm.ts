// HSM/MPC签名模拟服务

import { ethers } from 'ethers'
import crypto from 'crypto'

export interface SigningRequest {
  id: string
  userId: string
  transactionData: any
  requiredApprovals: number
  currentApprovals: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SIGNED'
  createdAt: Date
  expiresAt: Date
}

export interface SigningApproval {
  requestId: string
  approverId: string
  approved: boolean
  comment?: string
  timestamp: Date
}

export interface HSMSigningResult {
  signature: string
  recoveryId: number
  messageHash: string
  signedBy: string
  timestamp: Date
}

// 模拟签名请求存储
const signingRequests = new Map<string, SigningRequest>()
const signingApprovals = new Map<string, SigningApproval[]>()

// 模拟HSM密钥存储
const HSM_KEYS = {
  'platform': {
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    keyId: 'hsm_key_001'
  },
  'custody': {
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    keyId: 'hsm_key_002'
  }
}

// 创建签名请求
export function createSigningRequest(
  userId: string,
  transactionData: any,
  requiredApprovals: number = 2
): SigningRequest {
  const requestId = crypto.randomUUID()
  
  const request: SigningRequest = {
    id: requestId,
    userId,
    transactionData,
    requiredApprovals,
    currentApprovals: 0,
    status: 'PENDING',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
  }
  
  signingRequests.set(requestId, request)
  signingApprovals.set(requestId, [])
  
  return request
}

// 批准签名请求
export function approveSigningRequest(
  requestId: string,
  approverId: string,
  approved: boolean,
  comment?: string
): { success: boolean; message: string; request?: SigningRequest } {
  const request = signingRequests.get(requestId)
  if (!request) {
    return { success: false, message: '签名请求不存在' }
  }
  
  if (request.status !== 'PENDING') {
    return { success: false, message: '签名请求已处理' }
  }
  
  if (new Date() > request.expiresAt) {
    request.status = 'REJECTED'
    return { success: false, message: '签名请求已过期' }
  }
  
  const approvals = signingApprovals.get(requestId) || []
  
  // 检查是否已经批准过
  const existingApproval = approvals.find(a => a.approverId === approverId)
  if (existingApproval) {
    return { success: false, message: '您已经处理过此请求' }
  }
  
  // 添加批准记录
  const approval: SigningApproval = {
    requestId,
    approverId,
    approved,
    comment,
    timestamp: new Date()
  }
  
  approvals.push(approval)
  signingApprovals.set(requestId, approvals)
  
  // 更新请求状态
  if (!approved) {
    request.status = 'REJECTED'
  } else {
    const approvedCount = approvals.filter(a => a.approved).length
    request.currentApprovals = approvedCount
    
    if (approvedCount >= request.requiredApprovals) {
      request.status = 'APPROVED'
    }
  }
  
  signingRequests.set(requestId, request)
  
  return { success: true, message: '处理成功', request }
}

// 执行HSM签名
export async function executeHSMSigning(
  requestId: string,
  keyType: 'platform' | 'custody' = 'platform'
): Promise<{ success: boolean; message: string; result?: HSMSigningResult }> {
  const request = signingRequests.get(requestId)
  if (!request) {
    return { success: false, message: '签名请求不存在' }
  }
  
  if (request.status !== 'APPROVED') {
    return { success: false, message: '签名请求未获得足够批准' }
  }
  
  try {
    const hsmKey = HSM_KEYS[keyType]
    const wallet = new ethers.Wallet(hsmKey.privateKey)
    
    // 构造交易数据
    const txData = request.transactionData
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(txData)))
    
    // 执行签名
    const signature = await wallet.signMessage(ethers.getBytes(messageHash))
    const sig = ethers.Signature.from(signature)
    
    const result: HSMSigningResult = {
      signature: signature,
      recoveryId: sig.v,
      messageHash: messageHash,
      signedBy: hsmKey.keyId,
      timestamp: new Date()
    }
    
    // 更新请求状态
    request.status = 'SIGNED'
    signingRequests.set(requestId, request)
    
    return { success: true, message: '签名成功', result }
    
  } catch (error) {
    console.error('HSM signing error:', error)
    return { success: false, message: `签名失败: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

// 获取签名请求
export function getSigningRequest(requestId: string): SigningRequest | null {
  return signingRequests.get(requestId) || null
}

// 获取用户的签名请求列表
export function getUserSigningRequests(userId: string): SigningRequest[] {
  return Array.from(signingRequests.values()).filter(req => req.userId === userId)
}

// 获取待批准的签名请求
export function getPendingSigningRequests(): SigningRequest[] {
  return Array.from(signingRequests.values()).filter(req => req.status === 'PENDING')
}

// 获取签名请求的批准记录
export function getSigningApprovals(requestId: string): SigningApproval[] {
  return signingApprovals.get(requestId) || []
}

// 验证签名
export function verifySignature(
  messageHash: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), signature)
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase()
  } catch (error) {
    console.error('Signature verification error:', error)
    return false
  }
}

// 模拟MPC密钥生成
export function generateMPCKey(participants: string[], threshold: number): {
  keyId: string
  publicKey: string
  participants: string[]
  threshold: number
  shares: Record<string, string>
} {
  // 这是一个简化的模拟，实际MPC会更复杂
  const keyId = `mpc_${crypto.randomUUID()}`
  const masterKey = ethers.Wallet.createRandom()
  
  // 模拟密钥分片
  const shares: Record<string, string> = {}
  participants.forEach((participant, index) => {
    // 简单的XOR分片模拟
    const share = crypto.createHash('sha256')
      .update(masterKey.privateKey + participant + index.toString())
      .digest('hex')
    shares[participant] = share
  })
  
  return {
    keyId,
    publicKey: masterKey.address,
    participants,
    threshold,
    shares
  }
}

// 清理过期请求
export function cleanupExpiredRequests(): number {
  const now = new Date()
  let cleaned = 0
  
  for (const [requestId, request] of signingRequests.entries()) {
    if (now > request.expiresAt && request.status === 'PENDING') {
      request.status = 'REJECTED'
      signingRequests.set(requestId, request)
      cleaned++
    }
  }
  
  return cleaned
}
