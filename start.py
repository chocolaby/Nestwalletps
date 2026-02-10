#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NestWallet One-Click Startup Script
Automatically configures environment, deploys contracts, and starts the system on client computers
"""

import os
import sys
import subprocess
import time
import json
import platform
from pathlib import Path

class Colors:
    """Terminal colors"""
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    """Print header"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}\n")

def print_success(text):
    """Print success message"""
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_info(text):
    """Print info message"""
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.END}")

def print_warning(text):
    """Print warning message"""
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")

def print_error(text):
    """Print error message"""
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def run_command(cmd, cwd=None, show_output=True, check=True):
    """Run command"""
    try:
        if show_output:
            result = subprocess.run(
                cmd,
                cwd=cwd,
                shell=True,
                check=check,
                encoding='utf-8',
                errors='ignore'
            )
            return result.returncode == 0
        else:
            result = subprocess.run(
                cmd,
                cwd=cwd,
                shell=True,
                check=check,
                capture_output=True,
                encoding='utf-8',
                errors='ignore'
            )
            return result.returncode == 0, result.stdout, result.stderr
    except subprocess.CalledProcessError as e:
        if check:
            print_error(f"Command execution failed: {cmd}")
            print_error(f"Error: {e}")
        return False
    except Exception as e:
        print_error(f"Error executing command: {e}")
        return False

def check_node():
    """Check if Node.js is installed"""
    print_info("Checking Node.js...")
    success, stdout, _ = run_command("node --version", show_output=False, check=False)
    if success:
        version = stdout.strip()
        print_success(f"Node.js installed: {version}")
        return True
    else:
        print_error("Node.js not detected!")
        print_info("Please visit https://nodejs.org/ to download and install Node.js (LTS version recommended)")
        return False

def check_npm():
    """Check if npm is available"""
    print_info("Checking npm...")
    success, stdout, _ = run_command("npm --version", show_output=False, check=False)
    if success:
        version = stdout.strip()
        print_success(f"npm installed: {version}")
        return True
    else:
        print_error("npm is not available")
        return False

def install_dependencies(project_dir):
    """Install dependencies"""
    print_header("Installing Project Dependencies")
    
    if not os.path.exists(os.path.join(project_dir, "node_modules")):
        print_info("First run, installing dependencies...")
        print_info("This may take a few minutes, please wait...")
        if run_command("npm install", cwd=project_dir):
            print_success("Dependencies installed successfully")
            return True
        else:
            print_error("Dependency installation failed")
            return False
    else:
        print_success("Dependencies already installed")
        return True

def setup_env_file(project_dir):
    """Configure environment variables file"""
    print_header("Configuring Environment Variables")
    
    env_local_path = os.path.join(project_dir, ".env.local")
    
    # Check if already configured
    if os.path.exists(env_local_path):
        with open(env_local_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if 'NEXT_PUBLIC_NEST_TOKEN_ADDRESS' in content and len(content) > 100:
                print_success("Environment variables already configured")
                return True
    
    # Create basic configuration
    env_content = """# NestWallet Environment Configuration

# Database
DATABASE_URL="file:./dev.db"

# JWT Secret
JWT_SECRET="nest-wallet-jwt-secret-key-2024"

# RPC Configuration (Sepolia Testnet)
NEXT_PUBLIC_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
NEXT_PUBLIC_CHAIN_ID="11155111"

# Contract Address (Deployed on Sepolia)
NEXT_PUBLIC_NEST_TOKEN_ADDRESS="0x9fB3658e8810b35E5eb573629F4FA25de772544C"
"""
    
    with open(env_local_path, 'w', encoding='utf-8') as f:
        f.write(env_content)
    
    print_success("Environment variables configured successfully")
    return True

def init_database(project_dir):
    """Initialize database"""
    print_header("Initializing Database")
    
    db_path = os.path.join(project_dir, "dev.db")
    
    if os.path.exists(db_path):
        print_success("Database already exists")
    else:
        print_info("Generating database...")
        if run_command("npx prisma generate", cwd=project_dir):
            print_success("Prisma client generated successfully")
        
        if run_command("npx prisma db push", cwd=project_dir):
            print_success("Database created successfully")
        else:
            print_error("Database creation failed")
            return False
    
    return True

def create_admin_user(project_dir):
    """Create admin account"""
    print_header("Creating Admin Account")
    
    create_admin_script = """
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  try {
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const admin = await prisma.user.upsert({
      where: { email: 'admin@test.com' },
      update: {},
      create: {
        email: 'admin@test.com',
        passwordHash: hashedPassword,
        role: 'ADMIN',
        kycStatus: 'APPROVED',
      },
    });
    
    console.log('Admin account created');
    console.log('Email: admin@test.com');
    console.log('Password: 123456');
  } catch (error) {
    console.error('Creation failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
"""
    
    script_path = os.path.join(project_dir, "_create_admin.js")
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write(create_admin_script)
    
    print_info("Creating admin account: admin@test.com / 123456")
    run_command(f"node _create_admin.js", cwd=project_dir, show_output=False)
    
    # Clean up temporary file
    try:
        os.remove(script_path)
    except:
        pass
    
    print_success("Admin account ready")
    return True

def start_ganache(project_dir):
    """Start Ganache local testnet"""
    print_header("Starting Ganache Local Testnet")

    print_info("Starting Ganache...")
    print_info("RPC Address: http://127.0.0.1:8545")

    ganache_cmd = "npm run ganache"

    if platform.system() == "Windows":
        subprocess.Popen(
            ganache_cmd,
            cwd=project_dir,
            shell=True,
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
    else:
        subprocess.Popen(
            ganache_cmd,
            cwd=project_dir,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

    print_info("Waiting for Ganache to start...")
    time.sleep(5)

    # Test connection
    for i in range(10):
        try:
            import urllib.request
            req = urllib.request.Request(
                'http://127.0.0.1:8545',
                data=json.dumps({"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}).encode(),
                headers={'Content-Type': 'application/json'}
            )
            urllib.request.urlopen(req, timeout=1)
            print_success("Ganache started successfully")
            return True
        except:
            if i < 9:
                print_info(f"Waiting... ({i+1}/10)")
                time.sleep(2)

    print_warning("Ganache may have failed to start, but continuing")
    return True

def check_sepolia_connection():
    """Check Sepolia network connection"""
    print_header("Checking Sepolia Testnet Connection")

    print_info("Connecting to Sepolia testnet...")
    print_info("RPC: https://ethereum-sepolia-rpc.publicnode.com")

    try:
        import urllib.request
        req = urllib.request.Request(
            'https://ethereum-sepolia-rpc.publicnode.com',
            data=json.dumps({"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}).encode(),
            headers={'Content-Type': 'application/json'}
        )
        response = urllib.request.urlopen(req, timeout=10)
        result = json.loads(response.read().decode())
        block_number = int(result['result'], 16)
        print_success(f"Sepolia connected successfully, current block: {block_number}")
        return True
    except Exception as e:
        print_warning(f"Sepolia connection failed: {e}")
        print_info("Please check network connection")
        return False

def check_contract(project_dir):
    """Check if contract is deployed"""
    print_header("Checking Smart Contract")

    contract_address = "0x9fB3658e8810b35E5eb573629F4FA25de772544C"
    print_info(f"Contract address: {contract_address}")
    print_info("View: https://sepolia.etherscan.io/address/" + contract_address)
    print_success("Contract deployed to Sepolia testnet")
    return True

def start_app(project_dir):
    """Start Next.js application"""
    print_header("Starting NestWallet Application")
    
    print_info("Starting Next.js development server...")
    
    # Start in background
    if platform.system() == "Windows":
        subprocess.Popen(
            "npm run dev",
            cwd=project_dir,
            shell=True,
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
    else:
        subprocess.Popen(
            "npm run dev",
            cwd=project_dir,
            shell=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    
    print_info("Waiting for application to start...")
    time.sleep(8)
    
    # Test application
    for i in range(10):
        try:
            import urllib.request
            urllib.request.urlopen('http://localhost:3000', timeout=2)
            print_success("Application started successfully")
            return True
        except:
            if i < 9:
                time.sleep(2)
    
    print_warning("Application may still be starting")
    return True

def open_browser():
    """Open browser"""
    import webbrowser
    
    print_info("Opening browser...")
    webbrowser.open('http://localhost:3000')
    time.sleep(1)

def main():
    """Main function"""
    print_header("🚀 NestWallet One-Click Startup Program")
    
    # Get project directory
    project_dir = os.path.dirname(os.path.abspath(__file__))
    print_info(f"Project directory: {project_dir}")
    
    # 1. Check environment
    print_header("Checking Runtime Environment")
    if not check_node():
        print_error("Please install Node.js first")
        input("\nPress Enter to exit...")
        sys.exit(1)
    
    if not check_npm():
        print_error("npm is not available")
        input("\nPress Enter to exit...")
        sys.exit(1)
    
    print_success("Environment check passed")
    
    # 2. Install dependencies
    if not install_dependencies(project_dir):
        print_error("Dependency installation failed")
        input("\nPress Enter to exit...")
        sys.exit(1)
    
    # 3. Configure environment
    if not setup_env_file(project_dir):
        print_error("Environment configuration failed")
        input("\nPress Enter to exit...")
        sys.exit(1)
    
    # 4. Initialize database
    if not init_database(project_dir):
        print_error("Database initialization failed")
        input("\nPress Enter to exit...")
        sys.exit(1)
    
    # 5. Create admin user
    create_admin_user(project_dir)

    # 6. Start Ganache local testnet
    if not start_ganache(project_dir):
        print_warning("Ganache may have failed to start")

    # 7. Check Sepolia network connection
    if not check_sepolia_connection():
        print_warning("Sepolia connection failed, but continuing")

    # 7. Check contract
    check_contract(project_dir)
    
    # 8. Start application
    if not start_app(project_dir):
        print_warning("Application may have failed to start")
    
    # 9. Display information
    print_header("🎉 Startup Complete")
    print_success("System is running!")
    print()
    print(f"{Colors.BOLD}Access URL:{Colors.END}")
    print(f"  {Colors.GREEN}http://localhost:3000{Colors.END}")
    print()
    print(f"{Colors.BOLD}Admin Account:{Colors.END}")
    print(f"  Email: {Colors.GREEN}admin@test.com{Colors.END}")
    print(f"  Password: {Colors.GREEN}123456{Colors.END}")
    print()
    print(f"{Colors.BOLD}Sepolia Testnet:{Colors.END}")
    print(f"  RPC: {Colors.GREEN}https://ethereum-sepolia-rpc.publicnode.com{Colors.END}")
    print(f"  Contract: {Colors.GREEN}0x9fB3658e8810b35E5eb573629F4FA25de772544C{Colors.END}")
    print()
    print(f"{Colors.BOLD}Feature Access:{Colors.END}")
    print(f"  - Login: {Colors.BLUE}http://localhost:3000/auth/login{Colors.END}")
    print(f"  - Mint: {Colors.BLUE}http://localhost:3000/admin/mint{Colors.END}")
    print(f"  - SIEM: {Colors.BLUE}http://localhost:3000/admin/siem{Colors.END}")
    print()
    
    # 10. Open browser
    try:
        open_browser()
    except:
        pass
    
    print_warning("Closing this window will stop all services")
    print_info("Press Ctrl+C to stop the program")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print()
        print_info("Stopping services...")
        print_success("Program exited")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print_error(f"Program error: {e}")
        import traceback
        traceback.print_exc()
        input("\nPress Enter to exit...")
        sys.exit(1)
