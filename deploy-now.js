const { ethers } = require('ethers');
const solc = require('solc');
const fs = require('fs');
const path = require('path');

async function deploy() {
  console.log('\n🚀 部署 NestToken 合约到 Ganache\n');

  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  
  // 从Ganache获取账户
  console.log('📡 连接到 Ganache...');
  const accounts = await provider.listAccounts();
  const signer = await provider.getSigner(0);  // 使用第一个账户
  
  console.log('✅ 连接成功');
  console.log('👤 部署账户:', await signer.getAddress());
  const balance = await provider.getBalance(await signer.getAddress());
  console.log('💰 账户余额:', ethers.formatEther(balance), 'ETH\n');

  // 读取并编译合约
  console.log('📝 编译合约...');
  const contractPath = path.join(__dirname, 'contracts', 'src', 'NestToken.sol');
  const contractSource = fs.readFileSync(contractPath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      'NestToken.sol': {
        content: contractSource
      }
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      },
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  };

  function findImports(importPath) {
    try {
      if (importPath.startsWith('@openzeppelin/')) {
        const ozPath = path.join(__dirname, 'node_modules', importPath);
        if (fs.existsSync(ozPath)) {
          return { contents: fs.readFileSync(ozPath, 'utf8') };
        }
      }
      return { error: 'File not found: ' + importPath };
    } catch (error) {
      return { error: error.message };
    }
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      console.error('❌ 编译失败:');
      errors.forEach(err => console.error('  ', err.formattedMessage));
      process.exit(1);
    }
  }

  const contract = output.contracts['NestToken.sol']['NestToken'];
  const abi = contract.abi;
  const bytecode = '0x' + contract.evm.bytecode.object;
  
  console.log('✅ 合约编译成功\n');

  // 部署
  console.log('🚀 部署合约...');
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  
  const deployTx = await factory.deploy(
    "NestToken",
    "NEST",
    18,
    ethers.parseUnits("1000000", 18)
  );
  
  console.log('📤 部署交易已发送:', deployTx.deploymentTransaction().hash);
  console.log('⏳ 等待确认...\n');
  
  await deployTx.waitForDeployment();
  const contractAddress = await deployTx.getAddress();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 合约部署成功！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📍 合约地址:', contractAddress);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 验证
  const deployedContract = new ethers.Contract(contractAddress, abi, provider);
  const name = await deployedContract.name();
  const symbol = await deployedContract.symbol();
  const totalSupply = await deployedContract.totalSupply();
  
  console.log('✅ 名称:', name);
  console.log('✅ 符号:', symbol);
  console.log('✅ 总供应:', ethers.formatUnits(totalSupply, 18), symbol);
  console.log('');

  // 保存配置
  const envPath = path.join(__dirname, '.env.local');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  if (envContent.includes('NEXT_PUBLIC_NEST_TOKEN_ADDRESS=')) {
    envContent = envContent.replace(
      /NEXT_PUBLIC_NEST_TOKEN_ADDRESS=.*/,
      `NEXT_PUBLIC_NEST_TOKEN_ADDRESS=${contractAddress}`
    );
  } else {
    envContent += `\n# NestToken 合约地址\nNEXT_PUBLIC_NEST_TOKEN_ADDRESS=${contractAddress}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ 已更新 .env.local\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 下一步：');
  console.log('1. 重启: npm run dev');
  console.log('2. 访问: http://localhost:3000/admin/mint');
  console.log('3. 测试铸造代币！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ 部署失败:', error.message);
    console.error(error);
    process.exit(1);
  });
