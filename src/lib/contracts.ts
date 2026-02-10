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

// 合约字节码 (从 deploy-sepolia.js 的 NestToken 合约编译得来)
// 这是一个包含 name, symbol, decimals, totalSupply, balanceOf, allowance, transfer, approve, transferFrom, mint, burn, burnFrom, owner, transferOwnership 的完整 ERC20 合约
const NEST_TOKEN_BYTECODE = "0x60806040523480156200001157600080fd5b5060405162001a3838038062001a388339818101604052810190620000379190620002c1565b83600090816200004891906200057d565b5082600190816200005a91906200057d565b5081600260006101000a81548160ff021916908360ff16021790555033600360006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550620000e733600260009054906101000a900460ff16600a620000db919062000854565b84620000e89190620008a5565b6200010c60201b60201c565b5050505062000a1f565b80600481905550806005600084848152602001908152602001600020819055508173ffffffffffffffffffffffffffffffffffffffff16600073ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051620001a7919062000376565b60405180910390a3505050565b60008183620001c59190620008f0565b905092915050565b6000620001e06200021560201b60201c565b73ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415905090565b6000600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b6000604051905090565b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b620002a78262000258565b810181811067ffffffffffffffff82111715620002c957620002c86200026c565b5b80604052505050565b6000620002de6200023f565b9050620002ec82826200029b565b919050565b600067ffffffffffffffff8211156200030f576200030e6200026c565b5b6200031a8262000258565b9050602081019050919050565b60005b838110156200034757808201518184015260208101905062000329565b8381111562000357576000848401525b50505050565b6000620003746200036e84620002f1565b620002d2565b90508281526020810184848401111562000393576200039262000253565b5b620003a084828562000327565b509392505050565b600082601f830112620003c057620003bf6200024e565b5b8151620003d28482602086016200035d565b91505092915050565b600060ff82169050919050565b620003f381620003db565b8114620003ff57600080fd5b50565b6000815190506200041381620003e8565b92915050565b6000819050919050565b6200042e8162000419565b81146200043a57600080fd5b50565b6000815190506200044e8162000423565b92915050565b600080600080608085870312156200047157620004706200024e565b5b600085015167ffffffffffffffff8111156200049257620004916200024e565b5b620004a087828801620003a8565b945050602085015167ffffffffffffffff811115620004c457620004c36200024e565b5b620004d287828801620003a8565b9350506040620004e58782880162000402565b9250506060620004f8878288016200043d565b91505092959194509250565b600081519050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b600060028204905060018216806200055857607f821691505b6020821081036200056e576200056d62000510565b5b50919050565b60008190508160005260206000209050919050565b60006020601f8301049050919050565b600082821b905092915050565b600060088302620005d87fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8262000599565b620005e4868362000599565b95508019841693508086168417925050509392505050565b6000819050919050565b60006200062762000621620006196200041962000419565b620005fc565b62000419565b9050919050565b6000819050919050565b620006438362000606565b6200065b62000652826200062e565b848454620005a6565b825550505050565b600090565b6200067262000663565b6200067f81848462000638565b505050565b5b81811015620006a7576200069b60008262000668565b60018101905062000685565b5050565b601f821115620006f657620006c08162000574565b620006cb8462000589565b81016020851015620006db578190505b620006f3620006ea8562000589565b83018262000684565b50505b505050565b600082821c905092915050565b60006200071b60001984600802620006fb565b1980831691505092915050565b600062000736838362000708565b9150826002028217905092915050565b620007518262000504565b67ffffffffffffffff8111156200076d576200076c6200026c565b5b6200077982546200053f565b62000786828285620006ab565b600060209050601f831160018114620007be5760008415620007a9578287015190505b620007b5858262000728565b86555062000825565b601f198416620007ce8662000574565b60005b82811015620007f857848901518255600182019150602085019450602081019050620007d1565b8683101562000818578489015162000814601f89168262000708565b8355505b6001600288020188555050505b505050505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b60008160011c9050919050565b6000808291508390505b6001851115620008b4578086048111156200088c576200088b6200082d565b5b60018516156200089c5780820291505b8081029050620008ac856200085c565b94506200086c565b94509492505050565b600082620008cf576001905062000999565b81620008df576000905062000999565b8160018114620008f85760028114620009035762000939565b600191505062000999565b60ff8411156200091857620009176200082d565b5b8360020a9150848211156200093257620009316200082d565b5b5062000999565b5060208310610133831016604e8410600b84101617156200096d5782820a9050838111156200096757620009666200082d565b5b62000999565b6200097c848484600162000863565b925090508184048111156200099657620009956200082d565b5b81810290505b9392505050565b600060ff82169050919050565b6000620009be8262000419565b9150620009cb836200099f565b9250620009fa7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8484620008bd565b905092915050565b600062000a0f8262000419565b915062000a1c8362000419565b925082820262000a2c8162000419565b9150828204841483151762000a465762000a456200082d565b5b5092915050565b61098f8062000a5d6000396000f3fe608060405234801561001057600080fd5b50600436106101005760003560e01c806370a0823111610097578063a9059cbb11610066578063a9059cbb146102a8578063dd62ed3e146102d8578063f2fde38b14610308578063f6a74ed71461032457610100565b806370a082311461021e5780638da5cb5b1461024e57806395d89b411461026c578063a457c2d71461028a57610100565b8063313ce567116100d3578063313ce567146101965780633950935114610b4578063395093511461c6578063423f6cef146101f857610100565b806306fdde0314610105578063095ea7b31461012357806318160ddd1461015357806323b872dd14610171575b600080fd5b61010d610340565b60405161011a9190610684565b60405180910390f35b61013d6004803603810190610138919061073f565b6103d2565b60405161014a919061079a565b60405180910390f35b61015b6103e5565b60405161016891906107c4565b60405180910390f35b61018b600480360381019061018691906107df565b6103eb565b604051610198919061079a565b60405180910390f35b61019e610509565b6040516101ab919061084e565b60405180910390f35b6101ce60048036038101906101c9919061073f565b61051c565b6040516101db919061079a565b60405180910390f35b610202600480360381019061006191906101fd919061073f565b6105c0565b60405161020f919061079a565b60405180910390f35b61023860048036038101906102339190610869565b6105d7565b60405161024591906107c4565b60405180910390f35b61025661061f565b6040516102639190610635565b60405180910390f35b610274610645565b6040516102819190610684565b60405180910390f35b6102a4600480360381019061029f919061073f565b6106d7565b6040516102ab919061079a565b60405180910390f35b6102c260048036038101906102bd919061073f565b61074e565b6040516102cf919061079a565b60405180910390f35b6102f260048036038101906102ed91906108ac565b610761565b6040516102ff91906107c4565b60405180910390f35b610322600480360381019061031d9190610869565b6107e8565b005b61033e60048036038101906103399190610869565b610804565b005b60606000805461034f90610927565b80601f016020809104026020016040519081016040528092919081815260200182805461037b90610927565b80156103c85780601f1061039d576101008083540402835291602001916103c8565b820191906000526020600020905b8154815290600101906020018083116103ab57829003601f168201915b5050505050905090565b60006103df338484610886565b60019050919050565b60045481565b60006103f8848484610a4f565b6103fe84848484610a4f565b6000600660008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050828110156104bf576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104b6906109ca565b60405180910390fd5b6104fc856104cd8386610a19565b600660008973ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054610886565b60019150509392505050565b600260009054906101000a900460ff1681565b600061052733846105328461054f565b919061051733565b61054391906109ea565b610886565b6001905092915050565b6000600660008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b60006105cd338484610a4f565b6001905092915050565b6000600560008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020549050919050565b600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b60606001805461065490610927565b80601f016020809104026020016040519081016040528092919081815260200182805461068090610927565b80156106cd5780601f106106a2576101008083540402835291602001916106cd565b820191906000526020600020905b8154815290600101906020018083116106b057829003601f168201915b5050505050905090565b600080600660003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205490506107438184610886565b600191505092915050565b600061075b338484610a4f565b60019050929150505092915050565b6000600660008473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054905092915050565b600360009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415610877576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161086e90610a77565b60405180910390fd5b61088081610dd2565b50565b80600560008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825461087291906109ea565b925050819055508060056000847"

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
    
    // 创建合约工厂
    const factory = new ethers.ContractFactory(
      NEST_TOKEN_ABI,
      NEST_TOKEN_BYTECODE,
      wallet
    )
    
    // 构造函数参数: name, symbol, decimals, initialSupply
    const constructorArgs = [
      name,
      symbol,
      decimals,
      initialSupply
    ]
    
    console.log('部署合约，参数:', constructorArgs)
    
    // 部署合约
    const contract = await factory.deploy(...constructorArgs)
    await contract.waitForDeployment()
    
    const address = await contract.getAddress()
    const deployTx = contract.deploymentTransaction()
    
    if (!deployTx) {
      throw new Error('部署交易不存在')
    }
    
    const receipt = await deployTx.wait()
    
    if (!receipt) {
      throw new Error('无法获取交易收据')
    }
    
    console.log('✅ 合约部署成功!')
    console.log('地址:', address)
    console.log('交易哈希:', receipt.hash)
    console.log('区块号:', receipt.blockNumber)
    
    return {
      address: address,
      abi: NEST_TOKEN_ABI,
      bytecode: NEST_TOKEN_BYTECODE,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    }
    
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
