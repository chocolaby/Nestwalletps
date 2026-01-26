# -*- coding: utf-8 -*-
"""
U盘诊断工具 - 检查隐藏文件、系统文件、磁盘空间等
输出结果到txt文件
"""

import os
import sys
import ctypes
import subprocess
from pathlib import Path
import string
from datetime import datetime

# 全局输出列表，用于保存到文件
output_lines = []

def log(text=""):
    """同时打印到控制台和保存到输出列表"""
    print(text)
    output_lines.append(text)

def get_removable_drives():
    """获取所有可移动磁盘"""
    drives = []
    bitmask = ctypes.windll.kernel32.GetLogicalDrives()
    
    for letter in string.ascii_uppercase:
        if bitmask & 1:
            drive = f"{letter}:"
            drive_type = ctypes.windll.kernel32.GetDriveTypeW(f"{drive}\\")
            # 2 = DRIVE_REMOVABLE, 3 = DRIVE_FIXED, 4 = DRIVE_REMOTE, 5 = DRIVE_CDROM, 6 = DRIVE_RAMDISK
            type_names = {
                0: "未知",
                1: "无效路径", 
                2: "可移动磁盘(U盘)",
                3: "本地硬盘",
                4: "网络驱动器",
                5: "光驱",
                6: "RAM磁盘"
            }
            type_name = type_names.get(drive_type, "未知")
            
            # 获取卷标
            volume_name = ctypes.create_unicode_buffer(1024)
            ctypes.windll.kernel32.GetVolumeInformationW(
                f"{drive}\\",
                volume_name,
                1024,
                None, None, None, None, 0
            )
            label = volume_name.value if volume_name.value else "无标签"
            
            drives.append({
                'letter': drive,
                'type': drive_type,
                'type_name': type_name,
                'label': label
            })
        bitmask >>= 1
    
    return drives

def select_drive():
    """让用户选择磁盘"""
    print("\n检测到的磁盘:")
    print("-" * 50)
    
    drives = get_removable_drives()
    
    for i, drive in enumerate(drives):
        # 获取磁盘大小
        try:
            free_bytes = ctypes.c_ulonglong(0)
            total_bytes = ctypes.c_ulonglong(0)
            ctypes.windll.kernel32.GetDiskFreeSpaceExW(
                f"{drive['letter']}\\",
                None,
                ctypes.byref(total_bytes),
                ctypes.byref(free_bytes)
            )
            total_gb = total_bytes.value / (1024**3)
            free_gb = free_bytes.value / (1024**3)
            size_info = f"总计: {total_gb:.1f}GB, 可用: {free_gb:.1f}GB"
        except:
            size_info = "无法获取大小"
        
        # 标记可移动磁盘
        marker = " ★" if drive['type'] == 2 else ""
        print(f"  [{i+1}] {drive['letter']} - {drive['label']} ({drive['type_name']}){marker}")
        print(f"       {size_info}")
    
    print("-" * 50)
    print("  ★ 标记的是可移动磁盘(U盘)")
    print()
    
    while True:
        choice = input("请输入序号选择要诊断的磁盘 (或直接输入盘符如 E:): ").strip()
        
        if not choice:
            continue
            
        # 如果输入的是数字
        if choice.isdigit():
            idx = int(choice) - 1
            if 0 <= idx < len(drives):
                return drives[idx]['letter']
            else:
                print("无效的序号，请重新输入")
                continue
        
        # 如果输入的是盘符
        if len(choice) == 1 and choice.upper() in string.ascii_uppercase:
            return choice.upper() + ":"
        if len(choice) == 2 and choice[0].upper() in string.ascii_uppercase and choice[1] == ':':
            return choice.upper()
        
        print("无效的输入，请重新输入")

def get_file_attributes(filepath):
    """获取文件属性"""
    try:
        attrs = ctypes.windll.kernel32.GetFileAttributesW(str(filepath))
        if attrs == -1:
            return None, 0
        
        attr_list = []
        if attrs & 0x1:
            attr_list.append("只读")
        if attrs & 0x2:
            attr_list.append("隐藏")
        if attrs & 0x4:
            attr_list.append("系统")
        if attrs & 0x10:
            attr_list.append("目录")
        if attrs & 0x20:
            attr_list.append("存档")
        if attrs & 0x400:
            attr_list.append("重解析点/符号链接")
        if attrs & 0x800:
            attr_list.append("压缩")
        if attrs & 0x2000:
            attr_list.append("非索引内容")
        if attrs & 0x4000:
            attr_list.append("加密")
        
        return attr_list if attr_list else ["普通"], attrs
    except Exception as e:
        return [f"错误: {e}"], 0

def remove_hidden_attribute(filepath):
    """移除文件的隐藏和系统属性"""
    try:
        # 获取当前属性
        attrs = ctypes.windll.kernel32.GetFileAttributesW(str(filepath))
        if attrs == -1:
            return False, "无法获取属性"
        
        # 移除隐藏(0x2)和系统(0x4)属性
        new_attrs = attrs & ~0x2 & ~0x4
        
        if new_attrs != attrs:
            result = ctypes.windll.kernel32.SetFileAttributesW(str(filepath), new_attrs)
            if result:
                return True, "已移除隐藏/系统属性"
            else:
                return False, "设置属性失败"
        return True, "无需修改"
    except Exception as e:
        return False, str(e)

def get_size_str(size_bytes):
    """将字节转换为可读格式"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} PB"

def deep_scan_all_files(path, all_files_list, depth=0, max_depth=10):
    """深度递归扫描所有文件，无深度限制地计算总大小"""
    try:
        with os.scandir(path) as entries:
            for entry in entries:
                try:
                    attrs, raw_attrs = get_file_attributes(entry.path)
                    is_hidden = "隐藏" in attrs if attrs else False
                    is_system = "系统" in attrs if attrs else False
                    
                    size = 0
                    if entry.is_file(follow_symlinks=False):
                        try:
                            size = entry.stat(follow_symlinks=False).st_size
                        except:
                            size = 0
                    
                    all_files_list.append({
                        'path': entry.path,
                        'name': entry.name,
                        'is_dir': entry.is_dir(follow_symlinks=False),
                        'is_hidden': is_hidden,
                        'is_system': is_system,
                        'attrs': attrs,
                        'raw_attrs': raw_attrs,
                        'size': size,
                        'depth': depth
                    })
                    
                    # 递归扫描子目录 - 无深度限制
                    if entry.is_dir(follow_symlinks=False):
                        deep_scan_all_files(entry.path, all_files_list, depth + 1, max_depth)
                        
                except PermissionError:
                    all_files_list.append({
                        'path': entry.path,
                        'name': entry.name,
                        'error': '权限被拒绝',
                        'depth': depth
                    })
                except Exception as e:
                    all_files_list.append({
                        'path': entry.path,
                        'name': entry.name,
                        'error': str(e),
                        'depth': depth
                    })
    except PermissionError:
        pass
    except Exception as e:
        pass

def get_disk_info(drive):
    """获取磁盘信息"""
    try:
        total, used, free = 0, 0, 0
        
        # 使用 ctypes 获取磁盘空间
        free_bytes = ctypes.c_ulonglong(0)
        total_bytes = ctypes.c_ulonglong(0)
        free_bytes_to_caller = ctypes.c_ulonglong(0)
        
        ret = ctypes.windll.kernel32.GetDiskFreeSpaceExW(
            drive,
            ctypes.byref(free_bytes_to_caller),
            ctypes.byref(total_bytes),
            ctypes.byref(free_bytes)
        )
        
        if ret:
            total = total_bytes.value
            free = free_bytes.value
            used = total - free
            
        return {
            'total': total,
            'used': used,
            'free': free,
            'total_str': get_size_str(total),
            'used_str': get_size_str(used),
            'free_str': get_size_str(free)
        }
    except Exception as e:
        return {'error': str(e)}

def run_cmd(cmd):
    """运行命令并返回输出"""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, shell=True, encoding='gbk', errors='ignore')
        return result.stdout + result.stderr
    except Exception as e:
        return f"命令执行错误: {e}"

def save_to_file(drive, output_lines):
    """保存诊断结果到txt文件"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    drive_letter = drive.replace(":", "")
    filename = f"usb_debug_{drive_letter}_{timestamp}.txt"
    
    # 保存到当前脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    filepath = os.path.join(script_dir, filename)
    
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(output_lines))
        return filepath
    except Exception as e:
        # 如果失败，尝试保存到桌面
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        filepath = os.path.join(desktop, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(output_lines))
        return filepath

def main():
    global output_lines
    output_lines = []
    
    print("=" * 60)
    print("U盘诊断工具 (结果将保存到txt文件)")
    print("=" * 60)
    
    # 让用户选择磁盘
    if len(sys.argv) > 1:
        drive = sys.argv[1]
        if not drive.endswith(':'):
            drive = drive + ':'
    else:
        drive = select_drive()
    
    drive_path = drive + '\\'
    
    log("=" * 70)
    log(f"U盘诊断报告 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    log(f"诊断目标: {drive_path}")
    log("=" * 70)
    
    # 1. 磁盘空间信息
    log("\n【1. 磁盘空间信息】")
    disk_info = get_disk_info(drive_path)
    if 'error' in disk_info:
        log(f"  获取磁盘信息失败: {disk_info['error']}")
    else:
        log(f"  总容量: {disk_info['total_str']}")
        log(f"  已使用: {disk_info['used_str']}")
        log(f"  可用:   {disk_info['free_str']}")
        log(f"  使用率: {(disk_info['used'] / disk_info['total'] * 100):.1f}%" if disk_info['total'] > 0 else "  使用率: N/A")
    
    # 2. 深度扫描所有文件（包括隐藏文件）
    log("\n【2. 深度扫描所有文件 (包括隐藏文件)】")
    log("  正在扫描，请稍候...")
    
    all_files = []
    deep_scan_all_files(drive_path, all_files)
    
    # 统计
    total_file_size = 0
    total_files = 0
    total_dirs = 0
    hidden_files = []
    system_files = []
    normal_files = []
    error_items = []
    
    for item in all_files:
        if 'error' in item:
            error_items.append(item)
            continue
        
        if item['is_dir']:
            total_dirs += 1
        else:
            total_files += 1
            total_file_size += item['size']
        
        if item['is_hidden']:
            hidden_files.append(item)
        if item['is_system']:
            system_files.append(item)
        if not item['is_hidden'] and not item['is_system']:
            normal_files.append(item)
    
    log(f"\n  扫描完成!")
    log(f"  -" * 35)
    log(f"  总文件数:     {total_files}")
    log(f"  总文件夹数:   {total_dirs}")
    log(f"  隐藏项目数:   {len(hidden_files)}")
    log(f"  系统项目数:   {len(system_files)}")
    log(f"  普通项目数:   {len(normal_files)}")
    log(f"  访问错误数:   {len(error_items)}")
    log(f"  -" * 35)
    log(f"  ★ 所有文件总大小: {get_size_str(total_file_size)}")
    log(f"  ★ 磁盘已使用空间: {disk_info.get('used_str', 'N/A')}")
    
    if disk_info.get('used', 0) > 0:
        coverage = (total_file_size / disk_info['used'] * 100)
        log(f"  ★ 扫描覆盖率:     {coverage:.1f}%")
        
        missing_space = disk_info['used'] - total_file_size
        if missing_space > 1024 * 1024:  # 大于1MB
            log(f"  ★ 未识别空间:     {get_size_str(missing_space)}")
    
    # 3. 显示所有隐藏文件详情
    log("\n【3. 隐藏文件详情】")
    if hidden_files:
        log(f"  发现 {len(hidden_files)} 个隐藏项目:")
        log("")
        for item in hidden_files:
            type_str = "[目录]" if item['is_dir'] else "[文件]"
            size_str = get_size_str(item['size']) if not item['is_dir'] else ""
            attr_str = ", ".join(item['attrs']) if item['attrs'] else ""
            log(f"  {type_str} {item['path']}")
            log(f"         属性: {attr_str}")
            if size_str:
                log(f"         大小: {size_str}")
    else:
        log("  未发现隐藏文件")
    
    # 4. 显示所有系统文件详情
    log("\n【4. 系统文件详情】")
    if system_files:
        log(f"  发现 {len(system_files)} 个系统项目:")
        log("")
        for item in system_files:
            type_str = "[目录]" if item['is_dir'] else "[文件]"
            size_str = get_size_str(item['size']) if not item['is_dir'] else ""
            attr_str = ", ".join(item['attrs']) if item['attrs'] else ""
            log(f"  {type_str} {item['path']}")
            log(f"         属性: {attr_str}")
            if size_str:
                log(f"         大小: {size_str}")
    else:
        log("  未发现系统文件")
    
    # 5. 显示普通文件
    log("\n【5. 普通文件列表】")
    if normal_files:
        log(f"  发现 {len(normal_files)} 个普通项目:")
        log("")
        for item in normal_files:
            type_str = "[目录]" if item['is_dir'] else "[文件]"
            size_str = get_size_str(item['size']) if not item['is_dir'] else ""
            log(f"  {type_str} {item['path']}")
            if size_str:
                log(f"         大小: {size_str}")
    else:
        log("  未发现普通文件")
    
    # 6. 显示访问错误的项目
    if error_items:
        log("\n【6. 访问错误的项目】")
        for item in error_items:
            log(f"  [错误] {item['path']}: {item['error']}")
    
    # 7. 强制显示隐藏文件（移除隐藏属性）
    log("\n【7. 强制显示隐藏文件】")
    if hidden_files:
        log("  是否要移除所有隐藏文件的隐藏属性？")
        choice = input("  输入 Y 确认，其他键跳过: ").strip().upper()
        
        if choice == 'Y':
            log("  正在移除隐藏属性...")
            success_count = 0
            fail_count = 0
            
            for item in hidden_files:
                success, msg = remove_hidden_attribute(item['path'])
                if success and msg != "无需修改":
                    log(f"    ✓ {item['path']}: {msg}")
                    success_count += 1
                elif not success:
                    log(f"    ✗ {item['path']}: {msg}")
                    fail_count += 1
            
            log(f"\n  完成! 成功: {success_count}, 失败: {fail_count}")
            
            # 同时使用 attrib 命令移除隐藏属性
            log("\n  使用 attrib 命令批量移除隐藏属性...")
            attrib_cmd = f'attrib -h -s "{drive_path}*" /s /d'
            log(f"  执行: {attrib_cmd}")
            attrib_result = run_cmd(attrib_cmd)
            if attrib_result.strip():
                log(attrib_result)
            else:
                log("  命令执行完成")
        else:
            log("  已跳过")
    else:
        log("  没有需要处理的隐藏文件")
    
    # 8. 特殊文件夹检查
    log("\n【8. 特殊系统文件夹检查】")
    special_folders = [
        '$RECYCLE.BIN',
        'System Volume Information',
        '.Trash-1000',
        '.Spotlight-V100',
        '.fseventsd',
        'RECYCLER',
        '.Trashes'
    ]
    
    for folder in special_folders:
        folder_path = os.path.join(drive_path, folder)
        if os.path.exists(folder_path):
            log(f"  ✓ 存在: {folder}")
            # 计算文件夹大小
            try:
                folder_size = 0
                file_count = 0
                for root, dirs, files in os.walk(folder_path):
                    for f in files:
                        try:
                            folder_size += os.path.getsize(os.path.join(root, f))
                            file_count += 1
                        except:
                            pass
                log(f"      大小: {get_size_str(folder_size)} ({file_count} 个文件)")
            except Exception as e:
                log(f"      无法计算大小: {e}")
        else:
            log(f"  ✗ 不存在: {folder}")
    
    # 9. 文件系统信息
    log("\n【9. 文件系统信息】")
    fsutil_output = run_cmd(f'fsutil fsinfo volumeinfo {drive}')
    log(fsutil_output)
    
    # 10. 建议
    log("\n【10. 建议操作】")
    log("  如果发现大量空间被占用但看不到文件，建议:")
    log(f"  1. 运行: chkdsk {drive} /f  (检查并修复文件系统错误)")
    log(f"  2. 使用杀毒软件扫描U盘")
    log(f"  3. 清空回收站: 右键 $RECYCLE.BIN 文件夹删除")
    log(f"  4. 尝试使用数据恢复软件扫描")
    
    log("\n" + "=" * 70)
    log("诊断完成!")
    log("=" * 70)
    
    # 保存到文件
    try:
        saved_path = save_to_file(drive, output_lines)
        print(f"\n★ 诊断报告已保存到: {saved_path}")
    except Exception as e:
        print(f"\n保存文件失败: {e}")
    
    input("\n按回车键退出...")

if __name__ == "__main__":
    main()
