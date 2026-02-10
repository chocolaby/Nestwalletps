// HSM/MPC signing simulation service

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

// Simulated signing request storage
const signingRequests = new Map<string, SigningRequest>()
const signingApprovals = new Map<string, SigningApproval[]>()

// Simulated HSM key storage
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

// Create signing request
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
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires after 24 hours
  }
  
  signingRequests.set(requestId, request)
  signingApprovals.set(requestId, [])
  
  return request
}

// Approve signing request
export function approveSigningRequest(
  requestId: string,
  approverId: string,
  approved: boolean,
  comment?: string
): { success: boolean; message: string; request?: SigningRequest } {
  const request = signingRequests.get(requestId)
  if (!request) {
    return { success: false, message: 'Signing request does not exist' }
  }
  
  if (request.status !== 'PENDING') {
    return { success: false, message: 'Signing request already processed' }
  }
  
  if (new Date() > request.expiresAt) {
    request.status = 'REJECTED'
    return { success: false, message: 'Signing request has expired' }
  }
  
  const approvals = signingApprovals.get(requestId) || []
  
  // Check if already approved
  const existingApproval = approvals.find(a => a.approverId === approverId)
  if (existingApproval) {
    return { success: false, message: 'You have already processed this request' }
  }
  
  // Add approval record
  const approval: SigningApproval = {
    requestId,
    approverId,
    approved,
    comment,
    timestamp: new Date()
  }
  
  approvals.push(approval)
  signingApprovals.set(requestId, approvals)
  
  // Update request status
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
  
  return { success: true, message: 'Processing successful', request }
}

// Execute HSM signing
export async function executeHSMSigning(
  requestId: string,
  keyType: 'platform' | 'custody' = 'platform'
): Promise<{ success: boolean; message: string; result?: HSMSigningResult }> {
  const request = signingRequests.get(requestId)
  if (!request) {
    return { success: false, message: 'Signing request does not exist' }
  }
  
  if (request.status !== 'APPROVED') {
    return { success: false, message: 'Signing request has not received sufficient approvals' }
  }
  
  try {
    const hsmKey = HSM_KEYS[keyType]
    const wallet = new ethers.Wallet(hsmKey.privateKey)
    
    // Construct transaction data
    const txData = request.transactionData
    const messageHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(txData)))
    
    // Execute signing
    const signature = await wallet.signMessage(ethers.getBytes(messageHash))
    const sig = ethers.Signature.from(signature)
    
    const result: HSMSigningResult = {
      signature: signature,
      recoveryId: sig.v,
      messageHash: messageHash,
      signedBy: hsmKey.keyId,
      timestamp: new Date()
    }
    
    // Update request status
    request.status = 'SIGNED'
    signingRequests.set(requestId, request)
    
    return { success: true, message: 'Signing successful', result }
    
  } catch (error) {
    console.error('HSM signing error:', error)
    return { success: false, message: `Signing failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

// Get signing request
export function getSigningRequest(requestId: string): SigningRequest | null {
  return signingRequests.get(requestId) || null
}

// Get user's signing request list
export function getUserSigningRequests(userId: string): SigningRequest[] {
  return Array.from(signingRequests.values()).filter(req => req.userId === userId)
}

// Get pending signing requests
export function getPendingSigningRequests(): SigningRequest[] {
  return Array.from(signingRequests.values()).filter(req => req.status === 'PENDING')
}

// Get approval records for signing request
export function getSigningApprovals(requestId: string): SigningApproval[] {
  return signingApprovals.get(requestId) || []
}

// Verify signature
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

// Simulate MPC key generation
export function generateMPCKey(participants: string[], threshold: number): {
  keyId: string
  publicKey: string
  participants: string[]
  threshold: number
  shares: Record<string, string>
} {
  // This is a simplified simulation, actual MPC would be more complex
  const keyId = `mpc_${crypto.randomUUID()}`
  const masterKey = ethers.Wallet.createRandom()
  
  // Simulate key sharding
  const shares: Record<string, string> = {}
  participants.forEach((participant, index) => {
    // Simple XOR sharding simulation
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

// Cleanup expired requests
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
