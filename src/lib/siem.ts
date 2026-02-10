import { prisma } from './prisma'

// SQLite does not support enums, using string constants
export type SiemEventType = 'LOGIN' | 'LOGOUT' | 'TRANSACTION' | 'WALLET_CREATED' | 'KYC_SUBMITTED' | 'KYC_APPROVED' | 'KYC_REJECTED' | 'ADMIN_ACTION' | 'SECURITY_ALERT'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface SiemEventData {
  userId?: string
  eventType: SiemEventType
  details: Record<string, any>
  riskLevel?: RiskLevel
  ipAddress?: string
  userAgent?: string
}

export class SiemLogger {
  static async logEvent(data: SiemEventData) {
    try {
      await prisma.siemEvent.create({
        data: {
          userId: data.userId,
          eventType: data.eventType,
          details: JSON.stringify(data.details),
          riskLevel: data.riskLevel || 'LOW',
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        }
      })
    } catch (error) {
      console.error('Failed to log SIEM event:', error)
    }
  }

  static async logLogin(userId: string, success: boolean, ipAddress?: string, userAgent?: string) {
    await this.logEvent({
      userId,
      eventType: 'LOGIN',
      details: { success, timestamp: new Date().toISOString() },
      riskLevel: success ? 'LOW' : 'MEDIUM',
      ipAddress,
      userAgent
    })
  }

  static async logTransaction(userId: string, transactionId: string, amount: string, fromAddress: string, toAddress: string) {
    await this.logEvent({
      userId,
      eventType: 'TRANSACTION',
      details: {
        transactionId,
        amount,
        fromAddress,
        toAddress,
        timestamp: new Date().toISOString()
      },
      riskLevel: 'MEDIUM'
    })
  }

  static async logWalletCreated(userId: string, walletAddress: string, walletType: string) {
    await this.logEvent({
      userId,
      eventType: 'WALLET_CREATED',
      details: {
        walletAddress,
        walletType,
        timestamp: new Date().toISOString()
      },
      riskLevel: 'LOW'
    })
  }

  static async logKycSubmitted(userId: string, documentType: string) {
    await this.logEvent({
      userId,
      eventType: 'KYC_SUBMITTED',
      details: {
        documentType,
        timestamp: new Date().toISOString()
      },
      riskLevel: 'LOW'
    })
  }

  static async logSecurityAlert(userId: string | undefined, alertType: string, details: Record<string, any>) {
    await this.logEvent({
      userId,
      eventType: 'SECURITY_ALERT',
      details: {
        alertType,
        ...details,
        timestamp: new Date().toISOString()
      },
      riskLevel: 'HIGH'
    })
  }

  static async logPasswordChangeAttempt(userId: string, success: boolean, reason?: string, ipAddress?: string) {
    await this.logEvent({
      userId,
      eventType: 'SECURITY_ALERT',
      details: {
        action: 'password_change',
        success,
        reason: reason || 'Password change attempt',
        timestamp: new Date().toISOString()
      },
      riskLevel: success ? 'LOW' : 'MEDIUM',
      ipAddress
    })
  }
}

// Convenience export function
export async function logEvent(data: {
  userId?: string
  eventType: string
  riskLevel?: string
  ipAddress?: string
  userAgent?: string
  eventData: string
}) {
  try {
    await prisma.siemEvent.create({
      data: {
        userId: data.userId,
        eventType: data.eventType,
        details: data.eventData,
        riskLevel: data.riskLevel || 'LOW',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      }
    })
  } catch (error) {
    console.error('Failed to log event:', error)
  }
}
