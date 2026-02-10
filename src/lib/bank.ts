// Simulated bank API service

export interface BankAccount {
  accountNumber: string
  accountHolder: string
  bankName: string
  bankCode: string
  balance: number
}

export interface PaymentMethod {
  id: string
  type: 'BANK_CARD' | 'ALIPAY' | 'WECHAT'
  name: string
  identifier: string // Card number/Account number
  isDefault: boolean
}

export interface BankTransferRequest {
  fromAccount: string
  toAccount: string
  amount: number
  currency: string
  reference: string
  memo?: string
}

export interface BankTransferResponse {
  transactionId: string
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  message: string
  fee: number
  estimatedTime: string
}

// Simulated bank account data
const MOCK_BANK_ACCOUNTS: BankAccount[] = [
  {
    accountNumber: '6222021234567890',
    accountHolder: 'NestWallet Platform',
    bankName: 'Industrial and Commercial Bank of China',
    bankCode: 'ICBC',
    balance: 1000000
  },
  {
    accountNumber: '6228481234567890',
    accountHolder: 'NestWallet Reserve',
    bankName: 'Agricultural Bank of China',
    bankCode: 'ABC',
    balance: 500000
  }
]

// Simulated payment methods
const MOCK_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'pm_1',
    type: 'BANK_CARD',
    name: 'ICBC Debit Card',
    identifier: '**** **** **** 7890',
    isDefault: true
  },
  {
    id: 'pm_2',
    type: 'ALIPAY',
    name: 'Alipay',
    identifier: '138****8888',
    isDefault: false
  },
  {
    id: 'pm_3',
    type: 'WECHAT',
    name: 'WeChat Pay',
    identifier: 'wx_****8888',
    isDefault: false
  }
]

// Simulate bank transfer
export async function simulateBankTransfer(request: BankTransferRequest): Promise<BankTransferResponse> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
  
  // Simulate success rate (95%)
  const isSuccess = Math.random() > 0.05
  
  if (!isSuccess) {
    return {
      transactionId: `TXN_${Date.now()}_FAIL`,
      status: 'FAILED',
      message: 'Bank system temporarily unavailable, please try again later',
      fee: 0,
      estimatedTime: '0 minutes'
    }
  }
  
  // Calculate fee (0.1% minimum 2 CNY)
  const fee = Math.max(request.amount * 0.001, 2)
  
  // Simulate processing time
  const processingTime = request.amount > 50000 ? '1-3 business days' : 'Instant arrival'
  
  return {
    transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: request.amount > 50000 ? 'PENDING' : 'SUCCESS',
    message: 'Transfer request submitted',
    fee,
    estimatedTime: processingTime
  }
}

// Validate bank card number
export function validateBankCard(cardNumber: string): boolean {
  // Simple bank card validation - only check length
  const digits = cardNumber.replace(/\D/g, '')
  // Chinese bank cards are generally 16-19 digits
  if (digits.length < 16 || digits.length > 19) return false
  
  // In mock environment, pass validation if length is correct
  // Production should use Luhn algorithm
  return true
}

// Get bank info
export function getBankInfo(cardNumber: string): { bankName: string; cardType: string } | null {
  const digits = cardNumber.replace(/\D/g, '')
  const prefix = digits.substring(0, 6)
  
  // Simulate bank card BIN recognition
  const bankMap: Record<string, { bankName: string; cardType: string }> = {
    '622202': { bankName: 'Industrial and Commercial Bank of China', cardType: 'Debit Card' },
    '622848': { bankName: 'Agricultural Bank of China', cardType: 'Debit Card' },
    '436742': { bankName: 'Bank of China', cardType: 'Credit Card' },
    '622580': { bankName: 'Postal Savings Bank of China', cardType: 'Debit Card' },
    '621785': { bankName: 'China Merchants Bank', cardType: 'Debit Card' },
    '622588': { bankName: 'China Construction Bank', cardType: 'Debit Card' }
  }
  
  return bankMap[prefix] || { bankName: 'Unknown Bank', cardType: 'Debit Card' }
}

// Get payment methods list
export function getPaymentMethods(): PaymentMethod[] {
  return [...MOCK_PAYMENT_METHODS]
}

// Get bank accounts list
export function getBankAccounts(): BankAccount[] {
  return [...MOCK_BANK_ACCOUNTS]
}

// Simulate Alipay/WeChat payment
export async function simulateThirdPartyPayment(
  method: 'ALIPAY' | 'WECHAT',
  amount: number,
  orderId: string
): Promise<{ success: boolean; paymentUrl?: string; message: string }> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Simulate success rate (98%)
  const isSuccess = Math.random() > 0.02
  
  if (!isSuccess) {
    return {
      success: false,
      message: `${method === 'ALIPAY' ? 'Alipay' : 'WeChat'} payment service temporarily unavailable`
    }
  }
  
  // Generate simulated payment URL
  const paymentUrl = `https://mock-${method.toLowerCase()}.com/pay?order=${orderId}&amount=${amount}`
  
  return {
    success: true,
    paymentUrl,
    message: 'Payment link generated, please complete payment in new window'
  }
}

// Query transaction status
export async function queryTransactionStatus(transactionId: string): Promise<{
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  message: string
  completedAt?: string
}> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300))
  
  // Simulate different statuses based on transaction ID
  if (transactionId.includes('FAIL')) {
    return {
      status: 'FAILED',
      message: 'Transaction failed'
    }
  }
  
  if (transactionId.includes('PENDING')) {
    // 30% chance to become successful
    const isCompleted = Math.random() > 0.7
    if (isCompleted) {
      return {
        status: 'SUCCESS',
        message: 'Transaction completed',
        completedAt: new Date().toISOString()
      }
    } else {
      return {
        status: 'PENDING',
        message: 'Transaction processing, please wait patiently'
      }
    }
  }
  
  return {
    status: 'SUCCESS',
    message: 'Transaction completed',
    completedAt: new Date().toISOString()
  }
}
