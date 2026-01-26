const { ethers } = require('ethers')

// 配置
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
  console.log('NestToken 转账测试 - Sepolia')
  console.log('='.repeat(50))

  // 连接
  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
  const contract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, wallet)

  console.log('\n📍 账户信息:')
  console.log(`   地址: ${wallet.address}`)

  // 查询余额
  const ethBalance = await provider.getBalance(wallet.address)
  console.log(`   ETH 余额: ${ethers.formatEther(ethBalance)} ETH`)

  const tokenBalance = await contract.balanceOf(wallet.address)
  const decimals = await contract.decimals()
  console.log(`   NEST 余额: ${ethers.formatUnits(tokenBalance, decimals)} NEST`)

  // 创建测试接收地址
  const testReceiver = ethers.Wallet.createRandom().address
  console.log(`\n📤 转账测试:`)
  console.log(`   接收地址: ${testReceiver}`)
  console.log(`   转账金额: 100 NEST`)

  // 执行转账
  console.log('\n🚀 发送交易...')
  const amount = ethers.parseUnits('100', decimals)
  const tx = await contract.transfer(testReceiver, amount)
  console.log(`   交易哈希: ${tx.hash}`)
  console.log('   等待确认...')

  const receipt = await tx.wait()
  console.log(`\n✅ 转账成功!`)
  console.log(`   区块号: ${receipt.blockNumber}`)
  console.log(`   Gas 使用: ${receipt.gasUsed.toString()}`)

  // 查询转账后余额
  const newBalance = await contract.balanceOf(wallet.address)
  const receiverBalance = await contract.balanceOf(testReceiver)
  console.log(`\n📊 转账后余额:`)
  console.log(`   发送方: ${ethers.formatUnits(newBalance, decimals)} NEST`)
  console.log(`   接收方: ${ethers.formatUnits(receiverBalance, decimals)} NEST`)

  console.log(`\n🔗 查看交易: https://sepolia.etherscan.io/tx/${tx.hash}`)
}

main().catch(console.error)
