import { ethers } from 'ethers'
import crypto from 'crypto'

// Hardcoded encryption key for consistency
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'nest-wallet-encryption-key-32chars'

console.log('Wallet module loaded, ENCRYPTION_KEY length:', ENCRYPTION_KEY.length)

// Encrypt private key
export function encryptPrivateKey(privateKey: string): string {
  const algorithm = 'aes-256-cbc'
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
  const iv = crypto.randomBytes(16)
  
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(privateKey, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return iv.toString('hex') + ':' + encrypted
}

// Decrypt private key
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

// Create new wallet
export function createWallet(): { address: string; privateKey: string; mnemonic: string } {
  const wallet = ethers.Wallet.createRandom()
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic?.phrase || ''
  }
}

// Recover wallet from private key
export function walletFromPrivateKey(privateKey: string): ethers.Wallet {
  return new ethers.Wallet(privateKey)
}

// Recover wallet from mnemonic phrase
export function walletFromMnemonic(mnemonic: string): ethers.HDNodeWallet {
  return ethers.Wallet.fromPhrase(mnemonic)
}

// Get provider
export function getProvider(): ethers.JsonRpcProvider {
  // Prefer Sepolia testnet, use local RPC if configured
  const rpcUrl = process.env.RPC_URL ||
    process.env.ANVIL_RPC_URL ||
    'https://ethereum-sepolia-rpc.publicnode.com'
  console.log('Using RPC URL:', rpcUrl)
  return new ethers.JsonRpcProvider(rpcUrl)
}

// Get wallet connected to provider
export function getConnectedWallet(privateKey: string): ethers.Wallet {
  const provider = getProvider()
  return new ethers.Wallet(privateKey, provider)
}

// Get ETH balance
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

// Get ERC-20 token balance
export async function getTokenBalance(tokenAddress: string, walletAddress: string): Promise<string> {
  try {
    const provider = getProvider()
    
    // ERC-20 ABI (only includes balanceOf function)
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

// Send ETH
export async function sendEth(
  fromPrivateKey: string,
  toAddress: string,
  amount: string
): Promise<{ txHash: string; gasUsed: string; gasPrice: string }> {
  const wallet = getConnectedWallet(fromPrivateKey)
  
  // Check if balance is sufficient
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
  
  console.log('Transfer details:')
  console.log('  Balance:', ethers.formatEther(balance), 'ETH')
  console.log('  Transfer amount:', amount, 'ETH')
  console.log('  Gas fee:', ethers.formatEther(gasCost), 'ETH')
  console.log('  Total required:', ethers.formatEther(totalCost), 'ETH')
  
  if (balance < totalCost) {
    throw new Error(`Insufficient balance: need ${ethers.formatEther(totalCost)} ETH, but only have ${ethers.formatEther(balance)} ETH`)
  }
  
  const tx = await wallet.sendTransaction({
    to: toAddress,
    value: amountWei,
    gasLimit: gasLimit,
    gasPrice: gasPrice
  })
  
  console.log('Transaction sent:', tx.hash)
  
  const receipt = await tx.wait()
  
  console.log('Transaction confirmed:', receipt?.status === 1 ? 'Success' : 'Failed')
  
  return {
    txHash: tx.hash,
    gasUsed: receipt?.gasUsed.toString() || '0',
    gasPrice: tx.gasPrice?.toString() || '0'
  }
}

// Send ERC-20 tokens
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
  
  console.log('Sending tokens:', { tokenAddress, toAddress, amount })
  
  const contract = new ethers.Contract(tokenAddress, erc20Abi, wallet)
  const decimals = await contract.decimals()
  const amountInWei = ethers.parseUnits(amount, decimals)
  
  console.log('Token transfer parameters:', { decimals, amountInWei: amountInWei.toString() })
  
  const tx = await contract.transfer(toAddress, amountInWei)
  console.log('Token transfer sent:', tx.hash)
  
  const receipt = await tx.wait()
  console.log('Token transfer confirmed')
  
  return {
    txHash: tx.hash,
    gasUsed: receipt?.gasUsed.toString() || '0',
    gasPrice: tx.gasPrice?.toString() || '0'
  }
}
