import { ethers } from 'ethers'
import { getProvider } from './wallet'

// NestToken合约ABI
const NEST_TOKEN_ABI = [
  "constructor(string memory name, string memory symbol, uint8 decimals_, uint256 initialSupply)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function burn(uint256 amount)",
  "function burnFrom(address account, uint256 amount)",
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)"
]

// 合约字节码 (简化版，实际应该从编译结果获取)
const NEST_TOKEN_BYTECODE = "0x608060405234801561001057600080fd5b50..." // 这里应该是完整的字节码

interface DeployContractParams {
  name: string
  symbol: string
  decimals: number
  initialSupply: number
}

interface DeployResult {
  address: string
  abi: any[]
  bytecode: string
  txHash: string
  blockNumber: number
}

// 部署合约
export async function deployContract(params: DeployContractParams): Promise<DeployResult> {
  const { name, symbol, decimals, initialSupply } = params
  
  try {
    const provider = getProvider()
    
    // 使用预设的部署账户私钥
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || 
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    
    const wallet = new ethers.Wallet(deployerPrivateKey, provider)
    
    console.log('部署合约，账户:', wallet.address)
    
    // 检查网络连接和余额
    const blockNumber = await provider.getBlockNumber()
    const balance = await provider.getBalance(wallet.address)
    
    if (balance === BigInt(0)) {
      throw new Error('部署账户余额不足')
    }

    console.log(`部署账户余额: ${ethers.formatEther(balance)} ETH`)
    
    // ⚠️ 注意: 实际部署需要完整的合约字节码
    // 建议使用 Foundry 在命令行部署，然后在这里使用部署好的合约地址
    // 如果要在代码中部署，需要:
    // 1. 从 contracts/out/NestToken.sol/NestToken.json 获取完整字节码
    // 2. 使用 ContractFactory 部署
    
    throw new Error(
      '请使用 Foundry 部署合约：\n' +
      'cd contracts && forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL --broadcast\n' +
      '然后将合约地址配置到 NEXT_PUBLIC_NEST_TOKEN_ADDRESS'
    )
    
  } catch (error) {
    console.error('Contract deployment failed:', error)
    throw new Error(`合约部署失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// 获取合约实例
export function getContractInstance(address: string, signerPrivateKey?: string) {
  const provider = getProvider()
  
  if (signerPrivateKey) {
    const wallet = new ethers.Wallet(signerPrivateKey, provider)
    return new ethers.Contract(address, NEST_TOKEN_ABI, wallet)
  }
  
  return new ethers.Contract(address, NEST_TOKEN_ABI, provider)
}

// 铸造代币（真实实现）
export async function mintTokens(
  contractAddress: string,
  toAddress: string,
  amount: string,
  signerPrivateKey: string
): Promise<{ txHash: string; gasUsed: string }> {
  try {
    console.log(`铸造 ${amount} 代币到地址 ${toAddress}`)
    console.log(`合约地址: ${contractAddress}`)
    
    // 验证地址格式
    if (!ethers.isAddress(toAddress)) {
      throw new Error('无效的接收地址')
    }
    
    if (!ethers.isAddress(contractAddress)) {
      throw new Error('无效的合约地址')
    }
    
    // 验证金额
    const amountNum = parseFloat(amount)
    if (amountNum <= 0) {
      throw new Error('铸造金额必须大于0')
    }
    
    // 获取 provider 和 wallet
    const provider = getProvider()
    const wallet = new ethers.Wallet(signerPrivateKey, provider)
    
    console.log('铸造账户:', wallet.address)
    
    // 创建合约实例
    const contract = new ethers.Contract(contractAddress, NEST_TOKEN_ABI, wallet)
    
    // 转换金额为 Wei (假设 18 decimals)
    const amountWei = ethers.parseUnits(amount, 18)
    
    console.log('发送铸造交易...')
    
    // 发送真实交易
    const tx = await contract.mint(toAddress, amountWei)
    console.log('交易已发送:', tx.hash)
    console.log('等待确认...')
    
    // 等待交易确认
    const receipt = await tx.wait()
    console.log('✅ 交易已确认:', receipt.hash)
    console.log('Gas 使用量:', receipt.gasUsed.toString())
    console.log('区块号:', receipt.blockNumber)
    
    return {
      txHash: receipt.hash,
      gasUsed: receipt.gasUsed.toString()
    }
    
  } catch (error) {
    console.error('Token minting failed:', error)
    throw new Error(`代币铸造失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// 获取代币信息（真实实现）
export async function getTokenInfo(contractAddress: string) {
  try {
    console.log(`获取合约信息: ${contractAddress}`)
    
    // 验证合约地址格式
    if (!ethers.isAddress(contractAddress)) {
      throw new Error('无效的合约地址')
    }
    
    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, NEST_TOKEN_ABI, provider)
    
    // 真实调用合约方法
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply()
    ])
    
    console.log('代币信息:', { name, symbol, decimals, totalSupply: totalSupply.toString() })
    
    return {
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: ethers.formatUnits(totalSupply, decimals)
    }
    
  } catch (error) {
    console.error('Failed to get token info:', error)
    throw new Error(`获取代币信息失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// 获取代币余额（真实实现）
export async function getTokenBalance(contractAddress: string, accountAddress: string): Promise<string> {
  try {
    console.log(`获取代币余额: ${contractAddress} -> ${accountAddress}`)
    
    // 验证地址格式
    if (!ethers.isAddress(contractAddress)) {
      throw new Error('无效的合约地址')
    }
    
    if (!ethers.isAddress(accountAddress)) {
      throw new Error('无效的账户地址')
    }
    
    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, NEST_TOKEN_ABI, provider)
    
    // 真实调用 balanceOf
    const balance = await contract.balanceOf(accountAddress)
    const decimals = await contract.decimals()
    
    const formattedBalance = ethers.formatUnits(balance, decimals)
    console.log(`余额: ${formattedBalance} NEST`)
    
    return formattedBalance
    
  } catch (error) {
    console.error('Failed to get token balance:', error)
    return '0'
  }
}
