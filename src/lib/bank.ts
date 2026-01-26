// 模拟银行API服务

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
  identifier: string // 卡号/账号
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

// 模拟银行账户数据
const MOCK_BANK_ACCOUNTS: BankAccount[] = [
  {
    accountNumber: '6222021234567890',
    accountHolder: 'NestWallet Platform',
    bankName: '中国工商银行',
    bankCode: 'ICBC',
    balance: 1000000
  },
  {
    accountNumber: '6228481234567890',
    accountHolder: 'NestWallet Reserve',
    bankName: '中国农业银行',
    bankCode: 'ABC',
    balance: 500000
  }
]

// 模拟支付方式
const MOCK_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'pm_1',
    type: 'BANK_CARD',
    name: '工商银行储蓄卡',
    identifier: '**** **** **** 7890',
    isDefault: true
  },
  {
    id: 'pm_2',
    type: 'ALIPAY',
    name: '支付宝',
    identifier: '138****8888',
    isDefault: false
  },
  {
    id: 'pm_3',
    type: 'WECHAT',
    name: '微信支付',
    identifier: 'wx_****8888',
    isDefault: false
  }
]

// 模拟银行转账
export async function simulateBankTransfer(request: BankTransferRequest): Promise<BankTransferResponse> {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
  
  // 模拟成功率 (95%)
  const isSuccess = Math.random() > 0.05
  
  if (!isSuccess) {
    return {
      transactionId: `TXN_${Date.now()}_FAIL`,
      status: 'FAILED',
      message: '银行系统暂时不可用，请稍后重试',
      fee: 0,
      estimatedTime: '0分钟'
    }
  }
  
  // 计算手续费 (0.1% 最低2元)
  const fee = Math.max(request.amount * 0.001, 2)
  
  // 模拟处理时间
  const processingTime = request.amount > 50000 ? '1-3个工作日' : '实时到账'
  
  return {
    transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: request.amount > 50000 ? 'PENDING' : 'SUCCESS',
    message: '转账请求已提交',
    fee,
    estimatedTime: processingTime
  }
}

// 验证银行卡号
export function validateBankCard(cardNumber: string): boolean {
  // 简单的银行卡号验证 - 只检查长度
  const digits = cardNumber.replace(/\D/g, '')
  // 中国银行卡一般是16-19位
  if (digits.length < 16 || digits.length > 19) return false
  
  // 模拟环境下，只要长度正确就通过验证
  // 生产环境应该使用Luhn算法
  return true
}

// 获取银行信息
export function getBankInfo(cardNumber: string): { bankName: string; cardType: string } | null {
  const digits = cardNumber.replace(/\D/g, '')
  const prefix = digits.substring(0, 6)
  
  // 模拟银行卡BIN识别
  const bankMap: Record<string, { bankName: string; cardType: string }> = {
    '622202': { bankName: '中国工商银行', cardType: '储蓄卡' },
    '622848': { bankName: '中国农业银行', cardType: '储蓄卡' },
    '436742': { bankName: '中国银行', cardType: '信用卡' },
    '622580': { bankName: '中国邮政储蓄银行', cardType: '储蓄卡' },
    '621785': { bankName: '招商银行', cardType: '储蓄卡' },
    '622588': { bankName: '中国建设银行', cardType: '储蓄卡' }
  }
  
  return bankMap[prefix] || { bankName: '未知银行', cardType: '储蓄卡' }
}

// 获取支付方式列表
export function getPaymentMethods(): PaymentMethod[] {
  return [...MOCK_PAYMENT_METHODS]
}

// 获取银行账户列表
export function getBankAccounts(): BankAccount[] {
  return [...MOCK_BANK_ACCOUNTS]
}

// 模拟支付宝/微信支付
export async function simulateThirdPartyPayment(
  method: 'ALIPAY' | 'WECHAT',
  amount: number,
  orderId: string
): Promise<{ success: boolean; paymentUrl?: string; message: string }> {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // 模拟成功率 (98%)
  const isSuccess = Math.random() > 0.02
  
  if (!isSuccess) {
    return {
      success: false,
      message: `${method === 'ALIPAY' ? '支付宝' : '微信'}支付服务暂时不可用`
    }
  }
  
  // 生成模拟支付URL
  const paymentUrl = `https://mock-${method.toLowerCase()}.com/pay?order=${orderId}&amount=${amount}`
  
  return {
    success: true,
    paymentUrl,
    message: '支付链接已生成，请在新窗口中完成支付'
  }
}

// 查询交易状态
export async function queryTransactionStatus(transactionId: string): Promise<{
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  message: string
  completedAt?: string
}> {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 300))
  
  // 根据交易ID模拟不同状态
  if (transactionId.includes('FAIL')) {
    return {
      status: 'FAILED',
      message: '交易失败'
    }
  }
  
  if (transactionId.includes('PENDING')) {
    // 30% 概率变为成功
    const isCompleted = Math.random() > 0.7
    if (isCompleted) {
      return {
        status: 'SUCCESS',
        message: '交易已完成',
        completedAt: new Date().toISOString()
      }
    } else {
      return {
        status: 'PENDING',
        message: '交易处理中，请耐心等待'
      }
    }
  }
  
  return {
    status: 'SUCCESS',
    message: '交易已完成',
    completedAt: new Date().toISOString()
  }
}
