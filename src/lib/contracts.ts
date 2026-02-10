import { ethers } from 'ethers'
import { getProvider } from './wallet'

// NestToken contract ABI
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

// Contract bytecode (simplified version, should be obtained from compilation result)
const NEST_TOKEN_BYTECODE = "0x608060405234801561001057600080fd5b50..." // This should be the complete bytecode

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

// Deploy contract
export async function deployContract(params: DeployContractParams): Promise<DeployResult> {
  const { name, symbol, decimals, initialSupply } = params
  
  try {
    const provider = getProvider()
    
    // Use predefined deployer account private key
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY || 
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    
    const wallet = new ethers.Wallet(deployerPrivateKey, provider)
    
    console.log('Deploying contract, account:', wallet.address)
    
    // Check network connection and balance
    const blockNumber = await provider.getBlockNumber()
    const balance = await provider.getBalance(wallet.address)
    
    if (balance === BigInt(0)) {
      throw new Error('Deployer account has insufficient balance')
    }

    console.log(`Deployer account balance: ${ethers.formatEther(balance)} ETH`)
    
    // ⚠️ Note: Actual deployment requires complete contract bytecode
    // It is recommended to deploy using Foundry from the command line, then use the deployed contract address here
    // If you want to deploy in code, you need to:
    // 1. Get complete bytecode from contracts/out/NestToken.sol/NestToken.json
    // 2. Deploy using ContractFactory
    
    throw new Error(
      'Please deploy the contract using Foundry:\n' +
      'cd contracts && forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL --broadcast\n' +
      'Then configure the contract address to NEXT_PUBLIC_NEST_TOKEN_ADDRESS'
    )
    
  } catch (error) {
    console.error('Contract deployment failed:', error)
    throw new Error(`Contract deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Get contract instance
export function getContractInstance(address: string, signerPrivateKey?: string) {
  const provider = getProvider()
  
  if (signerPrivateKey) {
    const wallet = new ethers.Wallet(signerPrivateKey, provider)
    return new ethers.Contract(address, NEST_TOKEN_ABI, wallet)
  }
  
  return new ethers.Contract(address, NEST_TOKEN_ABI, provider)
}

// Mint tokens (actual implementation)
export async function mintTokens(
  contractAddress: string,
  toAddress: string,
  amount: string,
  signerPrivateKey: string
): Promise<{ txHash: string; gasUsed: string }> {
  try {
    console.log(`Minting ${amount} tokens to address ${toAddress}`)
    console.log(`Contract address: ${contractAddress}`)
    
    // Validate address format
    if (!ethers.isAddress(toAddress)) {
      throw new Error('Invalid recipient address')
    }
    
    if (!ethers.isAddress(contractAddress)) {
      throw new Error('Invalid contract address')
    }
    
    // Validate amount
    const amountNum = parseFloat(amount)
    if (amountNum <= 0) {
      throw new Error('Mint amount must be greater than 0')
    }
    
    // Get provider and wallet
    const provider = getProvider()
    const wallet = new ethers.Wallet(signerPrivateKey, provider)
    
    console.log('Minting account:', wallet.address)
    
    // Create contract instance
    const contract = new ethers.Contract(contractAddress, NEST_TOKEN_ABI, wallet)
    
    // Convert amount to Wei (assuming 18 decimals)
    const amountWei = ethers.parseUnits(amount, 18)
    
    console.log('Sending mint transaction...')
    
    // Send actual transaction
    const tx = await contract.mint(toAddress, amountWei)
    console.log('Transaction sent:', tx.hash)
    console.log('Waiting for confirmation...')
    
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
    throw new Error(`Token minting failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Get token info (actual implementation)
export async function getTokenInfo(contractAddress: string) {
  try {
    console.log(`Getting contract info: ${contractAddress}`)
    
    // Validate contract address format
    if (!ethers.isAddress(contractAddress)) {
      throw new Error('Invalid contract address')
    }
    
    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, NEST_TOKEN_ABI, provider)
    
    // Actually call contract methods
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply()
    ])
    
    console.log('Token info:', { name, symbol, decimals, totalSupply: totalSupply.toString() })
    
    return {
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: ethers.formatUnits(totalSupply, decimals)
    }
    
  } catch (error) {
    console.error('Failed to get token info:', error)
    throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Get token balance (actual implementation)
export async function getTokenBalance(contractAddress: string, accountAddress: string): Promise<string> {
  try {
    console.log(`Getting token balance: ${contractAddress} -> ${accountAddress}`)
    
    // Validate address format
    if (!ethers.isAddress(contractAddress)) {
      throw new Error('Invalid contract address')
    }
    
    if (!ethers.isAddress(accountAddress)) {
      throw new Error('Invalid account address')
    }
    
    const provider = getProvider()
    const contract = new ethers.Contract(contractAddress, NEST_TOKEN_ABI, provider)
    
    // Actually call balanceOf
    const balance = await contract.balanceOf(accountAddress)
    const decimals = await contract.decimals()
    
    const formattedBalance = ethers.formatUnits(balance, decimals)
    console.log(`Balance: ${formattedBalance} NEST`)
    
    return formattedBalance
    
  } catch (error) {
    console.error('Failed to get token balance:', error)
    return '0'
  }
}
