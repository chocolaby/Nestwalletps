const { ethers } = require('ethers')
const solc = require('solc')
const fs = require('fs')
const path = require('path')

// Sepolia 配置
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
const PRIVATE_KEY = process.env.PRIVATE_KEY

// 合约源码
const contractSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract NestToken {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(string memory _name, string memory _symbol, uint8 _decimals, uint256 _initialSupply) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        owner = msg.sender;
        _mint(msg.sender, _initialSupply * 10**_decimals);
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) public {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }

    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "Mint to zero address");
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}
`

function compileContract() {
  console.log('📦 编译合约...')

  const input = {
    language: 'Solidity',
    sources: { 'NestToken.sol': { content: contractSource } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } }
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))

  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error')
    if (errors.length > 0) {
      console.error('编译错误:', errors)
      process.exit(1)
    }
  }

  const contract = output.contracts['NestToken.sol']['NestToken']
  console.log('   编译成功!')
  return { abi: contract.abi, bytecode: contract.evm.bytecode.object }
}

async function main() {
  console.log('='.repeat(50))
  console.log('NestToken 部署脚本 - Sepolia 测试网')
  console.log('='.repeat(50))

  if (!PRIVATE_KEY) {
    console.error('\n❌ 请设置 PRIVATE_KEY 环境变量')
    console.log('\n运行方式:')
    console.log('  set PRIVATE_KEY=你的私钥 && node deploy-sepolia.js')
    process.exit(1)
  }

  // 编译合约
  const { abi, bytecode } = compileContract()

  // 连接 Sepolia
  console.log('\n📡 连接 Sepolia...')
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

  const balance = await provider.getBalance(wallet.address)
  console.log(`   地址: ${wallet.address}`)
  console.log(`   余额: ${ethers.formatEther(balance)} ETH`)

  if (balance === 0n) {
    console.error('\n❌ 余额为 0，请先领取测试币: https://sepoliafaucet.com')
    process.exit(1)
  }

  // 部署
  console.log('\n🚀 部署合约...')
  const factory = new ethers.ContractFactory(abi, bytecode, wallet)
  const contract = await factory.deploy('NestToken', 'NEST', 18, 1000000)

  console.log(`   交易: ${contract.deploymentTransaction().hash}`)
  console.log('   等待确认...')

  await contract.waitForDeployment()
  const address = await contract.getAddress()

  console.log('\n✅ 部署成功!')
  console.log(`   合约地址: ${address}`)
  console.log(`   查看: https://sepolia.etherscan.io/address/${address}`)

  // 保存信息
  const info = { address, abi, deployer: wallet.address, network: 'sepolia' }
  fs.writeFileSync('deployment-sepolia.json', JSON.stringify(info, null, 2))
  console.log('\n📄 已保存到 deployment-sepolia.json')
}

main().catch(console.error)
