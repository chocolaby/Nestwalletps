import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from './prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key'

export interface JWTPayload {
  userId: string
  email: string
  role: string
}

// Generate JWT token
export function generateToken(payload: JWTPayload): string {
  console.log('🔐 Generating Token...', {
    payload,
    secretPreview: JWT_SECRET.substring(0, 10) + '...'
  })
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
  console.log('✅ Token generated successfully, length:', token.length)
  return token
}

// Verify JWT token
export function verifyToken(token: string): JWTPayload | null {
  try {
    console.log('🔑 Verifying Token...', {
      tokenPreview: token.substring(0, 30) + '...',
      secretPreview: JWT_SECRET.substring(0, 10) + '...'
    })
    const result = jwt.verify(token, JWT_SECRET) as JWTPayload
    console.log('✅ Token verified successfully:', result)
    return result
  } catch (error) {
    console.error('❌ Token verification failed:', error instanceof Error ? error.message : error)
    return null
  }
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

// Get user information from request
export async function getUserFromRequest(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  
  if (!token) {
    return null
  }

  const payload = verifyToken(token)
  if (!payload) {
    return null
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        kycStatus: true,
        twoFactorEnabled: true,
        createdAt: true,
      }
    })
    return user
  } catch (error) {
    return null
  }
}

// Check user permissions
export function hasPermission(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = {
    USER: 0,
    COMPLIANCE: 1,
    ADMIN: 2
  }
  
  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] ?? -1
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] ?? 999
  
  return userLevel >= requiredLevel
}
