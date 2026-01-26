import { ethers } from 'ethers'
import crypto from 'crypto'

// 硬编码加密密钥，确保一致性
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'nest-wallet-encryption-key-32chars'

console.log('Wallet module loaded, ENCRYPTION_KEY length:', ENCRYPTION_KEY.length)

// 加密私钥
export function encryptPrivateKey(privateKey: string): string {
  const algorithm = 'aes-256-cbc'
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(privateKey, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return iv.toString('hex') + ':' + encrypted
}

// 解密私钥
export function decryptPrivateKey(encryptedPrivateKey: string): string {
  const algorithm = 'aes-256-cbc'
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  
  const parts = encryptedPrivateKey.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encryptedText = parts[1]
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

// 创建新钱包
export function createWallet(): { address: string; privateKey: string; mnemonic: string } {
  const wallet = ethers.Wallet.createRandom()
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase || ''
  }
}

// 从私钥恢复钱包
export function walletFromPrivateKey(privateKey: string): ethers.Wallet {
  return new ethers.Wallet(privateKey)
}

// 从助记词恢复钱包
export function walletFromMnemonic(mnemonic: string): ethers.HDNodeWallet {
  return ethers.Wallet.fromPhrase(mnemonic)
}

// 获取提供者
export function getProvider(): ethers.JsonRpcProvider {
  // 优先使用 Sepolia 测试网，如果设置了本地 RPC 则使用本地
  const rpcUrl = process.env.RPC_URL ||
    process.env.ANVIL_RPC_URL ||
    'https://ethereum-sepolia-rpc.publicnode.com'
  console.log('Using RPC URL:', rpcUrl)
  return new ethers.JsonRpcProvider(rpcUrl)
}

// 获取连接到提供者的钱包
export function getConnectedWallet(privateKey: string): ethers.Wallet {
  const provider = getProvider()
  return new ethers.Wallet(privateKey, provider)
}

// 获取ETH余额
export async function getEthBalance(address: string): Promise<string> {
  try {
    const provider = getProvider()
    const balance = await provider.getBalance(address)
    return ethers.formatEther(balance)
  } catch (error) {
    console.error('Error getting ETH balance:', error)
    return '0'
  }
}

// 获取ERC-20代币余额
export async function getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
  try {
    const provider = getProvider()
    
    // ERC-20 ABI (只包含balanceOf函数)
    const erc20Abi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function symbol() view returns (string)',
      'function name() view returns (string)'
    ]
    
    const contract = new ethers.Contract(tokenAddress, erc20Abi, provider)
    const balance = await contract.balanceOf(walletAddress)
    const decimals = await contract.decimals()
    
    return ethers.formatUnits(balance, decimals)
  } catch (error) {
    console.error('Error getting token balance:', error)
    return '0'
  }
}

// 发送ETH
export async function sendEth(
  fromPrivateKey: string,
  toAddress: string,
  amount: string
): Promise<{ txHash: string; gasUsed: string; gasPrice: string }> {
  const wallet = getConnectedWallet(fromPrivateKey)
  
  // 检查余额是否足够
  const provider = wallet.provider
  if (!provider) {
    throw new Error('Provider not available')
  }
  
  const balance = await provider.getBalance(wallet.address)
  const amountWei = ethers.parseEther(amount)
  const gasLimit = BigInt(21000)
  const gasPrice = ethers.parseUnits('20', 'gwei') // 20 Gwei
  const gasCost = gasLimit * gasPrice
  const totalCost = amountWei + gasCost
  
  console.log('转账详情:')
  console.log('  余额:', ethers.formatEther(balance), 'ETH')
  console.log('  转账金额:', amount, 'ETH')
  console.log('  Gas费用:', ethers.formatEther(gasCost), 'ETH')
  console.log('  总需要:', ethers.formatEther(totalCost), 'ETH')
  
  if (balance < totalCost) {
    throw new Error(`余额不足: 需要 ${ethers.formatEther(totalCost)} ETH，但只有 ${ethers.formatEther(balance)} ETH`)
  }
  
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: amountWei,
    gasLimit: gasLimit,
    gasPrice: gasPrice
  })
  
  console.log('交易已发送:', tx.hash)
  
  const receipt = await tx.wait()
  
  console.log('交易已确认:', receipt?.status === 1 ? '成功' : '失败')
  
  return {
    txHash: tx.hash,
    gasUsed: receipt?.gasUsed.toString() || '0',
    gasPrice: tx.gasPrice?.toString() || '0'
  }
}

// 发送ERC-20代币
export async function sendToken(
  fromPrivateKey: string,
  toAddress: string,
  amount: string,
  tokenAddress: string
): Promise<{ txHash: string; gasUsed: string; gasPrice: string }> {
  const wallet = getConnectedWallet(fromPrivateKey)
  
  const erc20Abi = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function decimals() view returns (uint8)'
  ]
  
  console.log('发送代币:', { tokenAddress, toAddress, amount })
  
  const contract = new ethers.Contract(tokenAddress, erc20Abi, wallet)
  const decimals = await contract.decimals()
  const amountInWei = ethers.parseUnits(amount, decimals)
  
  console.log('代币转账参数:', { decimals, amountInWei: amountInWei.toString() })
  
  const tx = await contract.transfer(toAddress, amountInWei)
  console.log('代币转账已发送:', tx.hash)
  
  const receipt = await tx.wait()
  console.log('代币转账已确认')
  
  return {
    txHash: tx.hash,
    gasUsed: receipt?.gasUsed.toString() || '0',
    gasPrice: tx.gasPrice?.toString() || '0'
  }
}
