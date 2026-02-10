const { ethers } = require('ethers');
const solc = require('solc');
const fs = require('fs');
const path = require('path');

async function deploy() {
  console.log('\n🚀 Deploying NestToken contract to Ganache\n');

  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  
  // Get account from Ganache
  console.log('📡 Connecting to Ganache...');
  const accounts = await provider.listAccounts();
  const signer = await provider.getSigner(0);  // Use first account
  
  console.log('✅ Connection successful');
  console.log('👤 Deploying account:', await signer.getAddress());
  const balance = await provider.getBalance(await signer.getAddress());
  console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH\n');

  // Read and compile contract
  console.log('📝 Compiling contract...');
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
      console.error('❌ Compilation failed:');
      errors.forEach(err => console.error('  ', err.formattedMessage));
      process.exit(1);
    }
  }

  const contract = output.contracts['NestToken.sol']['NestToken'];
  const abi = contract.abi;
  const bytecode = '0x' + contract.evm.bytecode.object;
  
  console.log('✅ Contract compiled successfully\n');

  // Deploy
  console.log('🚀 Deploying contract...');
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  
  const deployTx = await factory.deploy(
    "NestToken",
    "NEST",
    18,
    ethers.parseUnits("1000000", 18)
  );
  
  console.log('📤 Deployment transaction sent:', deployTx.deploymentTransaction().hash);
  console.log('⏳ Waiting for confirmation...\n');
  
  await deployTx.waitForDeployment();
  const contractAddress = await deployTx.getAddress();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Contract deployed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📍 Contract address:', contractAddress);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Verify
  const deployedContract = new ethers.Contract(contractAddress, abi, provider);
  const name = await deployedContract.name();
  const symbol = await deployedContract.symbol();
  const totalSupply = await deployedContract.totalSupply();
  
  console.log('✅ Name:', name);
  console.log('✅ Symbol:', symbol);
  console.log('✅ Total supply:', ethers.formatUnits(totalSupply, 18), symbol);
  console.log('');

  // Save configuration
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
    envContent += `\n# NestToken contract address\nNEXT_PUBLIC_NEST_TOKEN_ADDRESS=${contractAddress}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Updated .env.local\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📝 Next steps:');
  console.log('1. Restart: npm run dev');
  console.log('2. Visit: http://localhost:3000/admin/mint');
  console.log('3. Test token minting!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

deploy()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error.message);
    console.error(error);
    process.exit(1);
  });
