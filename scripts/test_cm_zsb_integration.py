#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试CM-ZSB与droneOnCampus集成的脚本
"""

import requests
import time
import json
from datetime import datetime

# 配置
CASTRAY_URL = "http://10.30.2.11:8000"
CM_ZSB_PORT = 8000

def print_header(title):
    """打印标题"""
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60 + "\n")

def test_cm_zsb_service(node_ip):
    """测试CM-ZSB监控服务"""
    print_header(f"测试CM-ZSB服务 - {node_ip}")
    
    # 测试健康检查
    try:
        url = f"http://{node_ip}:{CM_ZSB_PORT}/api/health"
        print(f"请求: GET {url}")
        resp = requests.get(url, timeout=2)
        print(f"状态码: {resp.status_code}")
        print(f"响应: {json.dumps(resp.json(), indent=2, ensure_ascii=False)}")
        print("✓ 健康检查通过")
    except Exception as e:
        print(f"✗ 健康检查失败: {e}")
        return False
    
    # 测试状态查询
    try:
        url = f"http://{node_ip}:{CM_ZSB_PORT}/api/status"
        print(f"\n请求: GET {url}")
        resp = requests.get(url, timeout=2)
        print(f"状态码: {resp.status_code}")
        data = resp.json()
        print(f"响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
        print(f"✓ 当前状态: {data.get('status', 'unknown')}")
    except Exception as e:
        print(f"✗ 状态查询失败: {e}")
        return False
    
    return True

def test_castray_integration():
    """测试CastRay集成"""
    print_header("测试CastRay集成")
    
    try:
        url = f"{CASTRAY_URL}/api/ray-dashboard"
        print(f"请求: GET {url}")
        resp = requests.get(url, timeout=5)
        print(f"状态码: {resp.status_code}")
        
        data = resp.json()
        nodes = data.get('data', {}).get('nodes', [])
        
        print(f"\n✓ 获取到 {len(nodes)} 个节点")
        
        # 显示前3个节点的工作状态
        print("\n节点工作状态样例:")
        print("-" * 60)
        for i, node in enumerate(nodes[:3]):
            print(f"{i+1}. {node.get('name', 'Unknown')}")
            print(f"   IP: {node.get('nodeIp', 'N/A')}")
            print(f"   工作状态: {node.get('workStatus', 'unknown')}")
            print(f"   时间戳: {node.get('workStatusTimestamp', 'N/A')}")
            print()
        
        # 统计各状态数量
        status_count = {'idle': 0, 'detecting': 0, 'sending': 0, 'unknown': 0}
        for node in nodes:
            status = node.get('workStatus', 'unknown')
            status_count[status] = status_count.get(status, 0) + 1
        
        print("状态统计:")
        print(f"  空闲 (idle):      {status_count.get('idle', 0)}")
        print(f"  检测中 (detecting): {status_count.get('detecting', 0)}")
        print(f"  服务端 (sending):   {status_count.get('sending', 0)}")
        print(f"  未知 (unknown):     {status_count.get('unknown', 0)}")
        
        return True
        
    except Exception as e:
        print(f"✗ CastRay集成测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False

def simulate_status_change(node_ip, status):
    """模拟状态变化"""
    print_header(f"模拟状态变化: {status}")
    
    try:
        url = f"http://{node_ip}:{CM_ZSB_PORT}/api/update_status"
        payload = {
            "status": status,
            "message": f"测试 - 切换到{status}状态",
            "task_info": {
                "test": True,
                "timestamp": datetime.now().isoformat()
            }
        }
        print(f"请求: POST {url}")
        print(f"数据: {json.dumps(payload, indent=2, ensure_ascii=False)}")
        
        resp = requests.post(url, json=payload, timeout=2)
        print(f"状态码: {resp.status_code}")
        print(f"响应: {json.dumps(resp.json(), indent=2, ensure_ascii=False)}")
        print(f"✓ 状态更新成功")
        return True
        
    except Exception as e:
        print(f"✗ 状态更新失败: {e}")
        return False

def main():
    """主函数"""
    print("="*60)
    print("  CM-ZSB 与 droneOnCampus 集成测试")
    print("="*60)
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 测试节点IP (使用head节点)
    test_node_ip = "10.30.2.11"
    
    # 1. 测试CM-ZSB服务
    if not test_cm_zsb_service(test_node_ip):
        print("\n⚠ CM-ZSB服务未运行,请先启动监控服务:")
        print(f"   ssh {test_node_ip}")
        print(f"   cd /data/home/sim6g/rayCode/CM-ZSB/experiment/scripts")
        print(f"   python3 monitoring_service_extended.py")
        return
    
    # 2. 测试CastRay集成
    test_castray_integration()
    
    # 3. 测试状态切换 (可选)
    print("\n")
    choice = input("是否测试状态切换? [y/N]: ").strip().lower()
    
    if choice == 'y':
        print("\n将依次测试三种状态,每种状态持续5秒...")
        
        for status in ['detecting', 'sending', 'idle']:
            simulate_status_change(test_node_ip, status)
            
            print(f"\n等待5秒,然后检查CastRay...")
            time.sleep(5)
            
            # 验证状态
            try:
                resp = requests.get(f"{CASTRAY_URL}/api/ray-dashboard", timeout=5)
                nodes = resp.json().get('data', {}).get('nodes', [])
                head_node = next((n for n in nodes if n['nodeIp'] == test_node_ip), None)
                
                if head_node:
                    current_status = head_node.get('workStatus', 'unknown')
                    if current_status == status:
                        print(f"✓ 状态同步成功: {status}")
                    else:
                        print(f"⚠ 状态不匹配: 期望 {status}, 实际 {current_status}")
                else:
                    print("⚠ 未找到测试节点")
                    
            except Exception as e:
                print(f"✗ 状态验证失败: {e}")
        
        # 恢复到idle状态
        simulate_status_change(test_node_ip, 'idle')
    
    print_header("测试完成")
    print("\n前往浏览器查看效果:")
    print(f"  http://10.30.2.11:8080/droneOnCampus/dashboard.html")
    print("\n状态指示灯说明:")
    print("  ● 绿灯 - 空闲 (idle)")
    print("  ● 蓝灯 - 本地检测中 (detecting)")
    print("  ● 红灯 - 服务端检测中 (sending)")
    print()

if __name__ == "__main__":
    main()
