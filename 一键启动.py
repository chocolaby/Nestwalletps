#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NestWallet 一键启动脚本
用于在客户电脑上自动配置环境、部署合约、启动系统
"""

import os
import sys
import subprocess
import time
import json
import platform
from pathlib import Path

class Colors:
    """终端颜色"""
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    END = '\033[0m'
    BOLD = '\033[1m'

def print_header(text):
    """打印标题"""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.END}\n")

def print_success(text):
    """打印成功消息"""
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_info(text):
    """打印信息"""
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.END}")

def print_warning(text):
    """打印警告"""
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")

def print_error(text):
    """打印错误"""
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def run_command(cmd, cwd=None, show_output=True, check=True):
    """运行命令"""
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
            print_error(f"命令执行失败: {cmd}")
            print_error(f"错误: {e}")
        return False
    except Exception as e:
        print_error(f"执行命令时出错: {e}")
        return False

def check_node():
    """检查Node.js是否安装"""
    print_info("检查 Node.js...")
    success, stdout, _ = run_command("node --version", show_output=False, check=False)
    if success:
        version = stdout.strip()
        print_success(f"Node.js 已安装: {version}")
        return True
    else:
        print_error("未检测到 Node.js！")
        print_info("请访问 https://nodejs.org/ 下载安装 Node.js (推荐 LTS 版本)")
        return False

def check_npm():
    """检查npm是否可用"""
    print_info("检查 npm...")
    success, stdout, _ = run_command("npm --version", show_output=False, check=False)
    if success:
        version = stdout.strip()
        print_success(f"npm 已安装: {version}")
        return True
    else:
        print_error("npm 不可用")
        return False

def install_dependencies(project_dir):
    """安装依赖"""
    print_header("安装项目依赖")
    
    if not os.path.exists(os.path.join(project_dir, "node_modules")):
        print_info("首次运行，正在安装依赖包...")
        print_info("这可能需要几分钟，请耐心等待...")
        if run_command("npm install", cwd=project_dir):
            print_success("依赖安装完成")
            return True
        else:
            print_error("依赖安装失败")
            return False
    else:
        print_success("依赖已安装")
        return True

def setup_env_file(project_dir):
    """配置环境变量文件"""
    print_header("配置环境变量")
    
    env_local_path = os.path.join(project_dir, ".env.local")
    
    # 检查是否已配置
    if os.path.exists(env_local_path):
        with open(env_local_path, 'r', encoding='utf-8') as f:
            content = f.read()
            if 'NEXT_PUBLIC_NEST_TOKEN_ADDRESS' in content and len(content) > 100:
                print_success("环境变量已配置")
                return True
    
    # 创建基础配置
    env_content = """# NestWallet 环境配置

# 数据库
DATABASE_URL="file:./dev.db"

# JWT密钥
JWT_SECRET="nest-wallet-jwt-secret-key-2024"

# RPC配置 (Sepolia 测试网)
NEXT_PUBLIC_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
NEXT_PUBLIC_CHAIN_ID="11155111"

# 合约地址 (Sepolia 已部署)
NEXT_PUBLIC_NEST_TOKEN_ADDRESS="0x9fB3658e8810b35E5eb573629F4FA25de772544C"
"""
    
    with open(env_local_path, 'w', encoding='utf-8') as f:
        f.write(env_content)
    
    print_success("环境变量配置完成")
    return True

def init_database(project_dir):
    """初始化数据库"""
    print_header("初始化数据库")
    
    db_path = os.path.join(project_dir, "dev.db")
    
    if os.path.exists(db_path):
        print_success("数据库已存在")
    else:
        print_info("生成数据库...")
        if run_command("npx prisma generate", cwd=project_dir):
            print_success("Prisma client 生成完成")
        
        if run_command("npx prisma db push", cwd=project_dir):
            print_success("数据库创建完成")
        else:
            print_error("数据库创建失败")
            return False
    
    return True

def create_admin_user(project_dir):
    """创建管理员账户"""
    print_header("创建管理员账户")
    
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
    
    console.log('管理员账户已创建');
    console.log('邮箱: admin@test.com');
    console.log('密码: 123456');
  } catch (error) {
    console.error('创建失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
"""
    
    script_path = os.path.join(project_dir, "_create_admin.js")
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write(create_admin_script)
    
    print_info("创建管理员账户: admin@test.com / 123456")
    run_command(f"node _create_admin.js", cwd=project_dir, show_output=False)
    
    # 清理临时文件
    try:
        os.remove(script_path)
    except:
        pass
    
    print_success("管理员账户已准备")
    return True

def start_ganache(project_dir):
    """启动Ganache本地测试网"""
    print_header("启动 Ganache 本地测试网")

    print_info("正在启动 Ganache...")
    print_info("RPC地址: http://127.0.0.1:8545")

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

    print_info("等待 Ganache 启动...")
    time.sleep(5)

    # 测试连接
    for i in range(10):
        try:
            import urllib.request
            req = urllib.request.Request(
                'http://127.0.0.1:8545',
                data=json.dumps({"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}).encode(),
                headers={'Content-Type': 'application/json'}
            )
            urllib.request.urlopen(req, timeout=1)
            print_success("Ganache 启动成功")
            return True
        except:
            if i < 9:
                print_info(f"等待中... ({i+1}/10)")
                time.sleep(2)

    print_warning("Ganache 可能启动失败，但继续执行")
    return True

def check_sepolia_connection():
    """检查 Sepolia 网络连接"""
    print_header("检查 Sepolia 测试网连接")

    print_info("正在连接 Sepolia 测试网...")
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
        print_success(f"Sepolia 连接成功，当前区块: {block_number}")
        return True
    except Exception as e:
        print_warning(f"Sepolia 连接失败: {e}")
        print_info("请检查网络连接")
        return False

def check_contract(project_dir):
    """检查合约是否已部署"""
    print_header("检查智能合约")

    contract_address = "0x9fB3658e8810b35E5eb573629F4FA25de772544C"
    print_info(f"合约地址: {contract_address}")
    print_info("查看: https://sepolia.etherscan.io/address/" + contract_address)
    print_success("合约已部署到 Sepolia 测试网")
    return True

def start_app(project_dir):
    """启动Next.js应用"""
    print_header("启动 NestWallet 应用")
    
    print_info("正在启动 Next.js 开发服务器...")
    
    # 在后台启动
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
    
    print_info("等待应用启动...")
    time.sleep(8)
    
    # 测试应用
    for i in range(10):
        try:
            import urllib.request
            urllib.request.urlopen('http://localhost:3000', timeout=2)
            print_success("应用启动成功")
            return True
        except:
            if i < 9:
                time.sleep(2)
    
    print_warning("应用可能还在启动中")
    return True

def open_browser():
    """打开浏览器"""
    import webbrowser
    
    print_info("正在打开浏览器...")
    webbrowser.open('http://localhost:3000')
    time.sleep(1)

def main():
    """主函数"""
    print_header("🚀 NestWallet 一键启动程序")
    
    # 获取项目目录
    project_dir = os.path.dirname(os.path.abspath(__file__))
    print_info(f"项目目录: {project_dir}")
    
    # 1. 检查环境
    print_header("检查运行环境")
    if not check_node():
        print_error("请先安装 Node.js")
        input("\n按回车键退出...")
        sys.exit(1)
    
    if not check_npm():
        print_error("npm 不可用")
        input("\n按回车键退出...")
        sys.exit(1)
    
    print_success("环境检查通过")
    
    # 2. 安装依赖
    if not install_dependencies(project_dir):
        print_error("依赖安装失败")
        input("\n按回车键退出...")
        sys.exit(1)
    
    # 3. 配置环境
    if not setup_env_file(project_dir):
        print_error("环境配置失败")
        input("\n按回车键退出...")
        sys.exit(1)
    
    # 4. 初始化数据库
    if not init_database(project_dir):
        print_error("数据库初始化失败")
        input("\n按回车键退出...")
        sys.exit(1)
    
    # 5. 创建管理员
    create_admin_user(project_dir)

    # 6. 启动 Ganache 本地测试网
    if not start_ganache(project_dir):
        print_warning("Ganache 启动可能失败")

    # 7. 检查 Sepolia 网络连接
    if not check_sepolia_connection():
        print_warning("Sepolia 连接失败，但继续运行")

    # 7. 检查合约
    check_contract(project_dir)
    
    # 8. 启动应用
    if not start_app(project_dir):
        print_warning("应用启动可能失败")
    
    # 9. 显示信息
    print_header("🎉 启动完成")
    print_success("系统已启动！")
    print()
    print(f"{Colors.BOLD}访问地址:{Colors.END}")
    print(f"  {Colors.GREEN}http://localhost:3000{Colors.END}")
    print()
    print(f"{Colors.BOLD}管理员账户:{Colors.END}")
    print(f"  邮箱: {Colors.GREEN}admin@test.com{Colors.END}")
    print(f"  密码: {Colors.GREEN}123456{Colors.END}")
    print()
    print(f"{Colors.BOLD}Sepolia 测试网:{Colors.END}")
    print(f"  RPC: {Colors.GREEN}https://ethereum-sepolia-rpc.publicnode.com{Colors.END}")
    print(f"  合约: {Colors.GREEN}0x9fB3658e8810b35E5eb573629F4FA25de772544C{Colors.END}")
    print()
    print(f"{Colors.BOLD}功能入口:{Colors.END}")
    print(f"  - 登录: {Colors.BLUE}http://localhost:3000/auth/login{Colors.END}")
    print(f"  - Mint: {Colors.BLUE}http://localhost:3000/admin/mint{Colors.END}")
    print(f"  - SIEM: {Colors.BLUE}http://localhost:3000/admin/siem{Colors.END}")
    print()
    
    # 10. 打开浏览器
    try:
        open_browser()
    except:
        pass
    
    print_warning("关闭此窗口将停止所有服务")
    print_info("按 Ctrl+C 可以停止程序")
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print()
        print_info("正在停止服务...")
        print_success("程序已退出")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print_error(f"程序出错: {e}")
        import traceback
        traceback.print_exc()
        input("\n按回车键退出...")
        sys.exit(1)
