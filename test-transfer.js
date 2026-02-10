const { ethers } = require('ethers')

// Configuration
const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com'
const PRIVATE_KEY = '5ac3da7626899d3bc9595ed73f5ae8ba0fbd1082f3be9d6f3aad6e284e885567'
const TOKEN_ADDRESS = '0x9fB3658e8810b35E5eb573629F4FA25de772544C'

const TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
]

async function main() {
  console.log('='.repeat(50))
  console.log('NestToken Transfer Test - Sepolia')
  console.log('='.repeat(50))

  // Connect
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  const contract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, wallet)

  console.log('\n📍 Account info:')
  console.log(`   Address: ${wallet.address}`)

  // Query balance
  const ethBalance = await provider.getBalance(wallet.address)
  console.log(`   ETH balance: ${ethers.formatEther(ethBalance)} ETH`)

  const tokenBalance = await contract.balanceOf(wallet.address)
  const decimals = await contract.decimals()
  console.log(`   NEST balance: ${ethers.formatUnits(tokenBalance, decimals)} NEST`)

  // Create test receiver address
  const testReceiver = ethers.Wallet.createRandom().address
  console.log(`\n📤 Transfer test:`)
  console.log(`   Receiver address: ${testReceiver}`)
  console.log(`   Transfer amount: 100 NEST`)

  // Execute transfer
  console.log('\n🚀 Sending transaction...')
  const amount = ethers.parseUnits('100', decimals)
  const tx = await contract.transfer(testReceiver, amount)
  console.log(`   Transaction hash: ${tx.hash}`)
  console.log('   Waiting for confirmation...')

  const receipt = await tx.wait()
  console.log(`\n✅ Transfer successful!`)
  console.log(`   Block number: ${receipt.blockNumber}`)
  console.log(`   Gas used: ${receipt.gasUsed.toString()}`)

  // Query post-transfer balance
  const newBalance = await contract.balanceOf(wallet.address)
  const receiverBalance = await contract.balanceOf(testReceiver)
  console.log(`\n📊 Post-transfer balance:`)
  console.log(`   Sender: ${ethers.formatUnits(newBalance, decimals)} NEST`)
  console.log(`   Receiver: ${ethers.formatUnits(receiverBalance, decimals)} NEST`)

  console.log(`\n🔗 View transaction: https://sepolia.etherscan.io/tx/${tx.hash}`)
}

main().catch(console.error)
