const { ethers } = require('ethers')
const solc = require('solc')
const fs = require('fs')
const path = require('path')

// Sepolia configuration
const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'
const PRIVATE_KEY = process.env.PRIVATE_KEY

// Contract source code
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
  console.log('📦 Compiling contract...')

  const input = {
    language: 'Solidity',
    sources: { 'NestToken.sol': { content: contractSource } },
    settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } }
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))

  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error')
    if (errors.length > 0) {
      console.error('Compilation error:', errors)
      process.exit(1)
    }
  }

  const contract = output.contracts['NestToken.sol']['NestToken']
  console.log('   Compilation successful!')
  return { abi: contract.abi, bytecode: contract.evm.bytecode.object }
}

async function main() {
  console.log('='.repeat(50))
  console.log('NestToken Deployment Script - Sepolia Testnet')
  console.log('='.repeat(50))

  if (!PRIVATE_KEY) {
    console.error('\n❌ Please set PRIVATE_KEY environment variable')
    console.log('\nUsage:')
    console.log('  set PRIVATE_KEY=your_private_key && node deploy-sepolia.js')
    process.exit(1)
  }

  // Compile contract
  const { abi, bytecode } = compileContract()

  // Connect to Sepolia
  console.log('\n📡 Connecting to Sepolia...')
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC)
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

  const balance = await provider.getBalance(wallet.address)
  console.log(`   Address: ${wallet.address}`)
  console.log(`   Balance: ${ethers.formatEther(balance)} ETH`)

  if (balance === 0n) {
    console.error('\n❌ Balance is 0, please get test tokens first: https://sepoliafaucet.com')
    process.exit(1)
  }

  // Deploy
  console.log('\n🚀 Deploying contract...')
  const factory = new ethers.ContractFactory(abi, bytecode, wallet)
  const contract = await factory.deploy('NestToken', 'NEST', 18, 1000000)

  console.log(`   Transaction: ${contract.deploymentTransaction().hash}`)
  console.log('   Waiting for confirmation...')

  await contract.waitForDeployment()
  const address = await contract.getAddress()

  console.log('\n✅ Deployment successful!')
  console.log(`   Contract address: ${address}`)
  console.log(`   View at: https://sepolia.etherscan.io/address/${address}`)

  // Save information
  const info = { address, abi, deployer: wallet.address, network: 'sepolia' }
  fs.writeFileSync('deployment-sepolia.json', JSON.stringify(info, null, 2))
  console.log('\n📄 Saved to deployment-sepolia.json')
}

main().catch(console.error)
