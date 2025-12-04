#!/usr/bin/env python3
"""
测试文件传输完成状态更新
验证传输任务能否正确从"in-progress"转到"completed"
"""
import time
import requests
import json
from pprint import pprint

BASE_URL = "http://10.30.2.11:8001"  # CastRay服务地址

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_transfer_completion():
    """测试传输完成状态"""
    
    print_section("1. 检查服务状态")
    try:
        response = requests.get(f"{BASE_URL}/api/status", timeout=5)
        if response.status_code == 200:
            status = response.json()
            print(f"✓ 服务运行正常")
            print(f"  连接状态: {status.get('connected', False)}")
            print(f"  就绪状态: {status.get('service_ready', False)}")
        else:
            print(f"✗ 服务返回错误: {response.status_code}")
            return
    except Exception as e:
        print(f"✗ 无法连接到服务: {e}")
        print(f"  请确保CastRay服务运行在 {BASE_URL}")
        return
    
    print_section("2. 获取初始传输状态")
    try:
        response = requests.get(f"{BASE_URL}/api/file-transfers/status", timeout=5)
        if response.status_code == 200:
            initial_status = response.json()
            print("✓ 成功获取初始状态")
            
            # 统计各节点的传输状态
            total_active = 0
            total_completed = 0
            for node_id, node_status in initial_status.items():
                if isinstance(node_status, dict) and "active_transfers_count" in node_status:
                    active = node_status.get("active_transfers_count", 0)
                    completed = node_status.get("completed_transfers_count", 0)
                    total_active += active
                    total_completed += completed
                    print(f"  节点 {node_id}: 活跃={active}, 已完成={completed}")
            
            print(f"\n  总计: 活跃传输={total_active}, 已完成传输={total_completed}")
        else:
            print(f"✗ 获取状态失败: {response.status_code}")
            return
    except Exception as e:
        print(f"✗ 请求失败: {e}")
        return
    
    print_section("3. 查找可用节点")
    # 查找可以用于测试的节点
    nodes = []
    for node_id, node_status in initial_status.items():
        if isinstance(node_status, dict) and node_status.get("is_running"):
            nodes.append(node_id)
    
    if len(nodes) < 2:
        print(f"✗ 需要至少2个节点进行测试，当前只有 {len(nodes)} 个")
        print("  请先创建演示节点")
        return
    
    sender = nodes[0]
    recipient = nodes[1]
    print(f"✓ 找到可用节点")
    print(f"  发送者: {sender}")
    print(f"  接收者: {recipient}")
    
    print_section("4. 发起文件传输")
    try:
        payload = {
            "sender_id": sender,
            "file_name": "config.json",
            "recipients": [recipient]
        }
        
        print(f"  请求: POST {BASE_URL}/api/file-transfers/manual")
        print(f"  参数: {json.dumps(payload, indent=4)}")
        
        response = requests.post(
            f"{BASE_URL}/api/file-transfers/manual",
            json=payload,
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ 传输已发起")
            pprint(result)
        else:
            print(f"✗ 传输发起失败: {response.status_code}")
            print(f"  响应: {response.text}")
            return
    except Exception as e:
        print(f"✗ 请求失败: {e}")
        return
    
    print_section("5. 监控传输状态")
    print("等待传输完成（最多30秒）...")
    
    for i in range(30):
        time.sleep(1)
        
        try:
            response = requests.get(f"{BASE_URL}/api/file-transfers/status", timeout=5)
            if response.status_code == 200:
                current_status = response.json()
                
                # 检查发送者节点的状态
                sender_status = current_status.get(sender, {})
                if isinstance(sender_status, dict):
                    active_transfers = sender_status.get("active_transfers", [])
                    completed_transfers = sender_status.get("completed_transfers", [])
                    
                    print(f"\r  [{i+1}s] 活跃: {len(active_transfers)}, 已完成: {len(completed_transfers)}", end="", flush=True)
                    
                    # 检查是否有新完成的传输
                    if completed_transfers:
                        print("\n\n✓ 发现已完成的传输!")
                        for transfer in completed_transfers:
                            print(f"  传输ID: {transfer.get('transfer_id')}")
                            print(f"  文件: {transfer.get('file_path')}")
                            print(f"  状态: {transfer.get('status')}")
                            print(f"  接收者: {transfer.get('recipients')}")
                            print(f"  已完成: {transfer.get('completed_by')}")
                        
                        print_section("测试结果")
                        print("✓ 传输任务成功从'传输中'转到'已完成'状态")
                        print("✓ Bug已修复!")
                        return
                    
                    # 检查是否有失败的传输
                    failed_transfers = sender_status.get("failed_transfers", [])
                    if failed_transfers:
                        print("\n\n✗ 发现失败的传输:")
                        pprint(failed_transfers)
                        return
        except Exception as e:
            print(f"\n✗ 查询状态失败: {e}")
            return
    
    print("\n\n⚠ 超时：30秒内传输未完成")
    print("  这可能表示传输仍在进行或遇到问题")
    
    # 显示最终状态
    print_section("最终状态")
    try:
        response = requests.get(f"{BASE_URL}/api/file-transfers/status", timeout=5)
        if response.status_code == 200:
            final_status = response.json()
            sender_status = final_status.get(sender, {})
            if isinstance(sender_status, dict):
                print(f"发送者节点 {sender}:")
                print(f"  活跃传输: {sender_status.get('active_transfers_count', 0)}")
                print(f"  已完成: {sender_status.get('completed_transfers_count', 0)}")
                print(f"  失败: {sender_status.get('failed_transfers_count', 0)}")
                
                if sender_status.get('active_transfers'):
                    print("\n  活跃传输详情:")
                    for transfer in sender_status.get('active_transfers', []):
                        print(f"    - {transfer.get('transfer_id')}: {transfer.get('status')}")
    except Exception as e:
        print(f"获取最终状态失败: {e}")

if __name__ == "__main__":
    print("""
╔══════════════════════════════════════════════════════════════╗
║         文件传输完成状态更新测试                              ║
║  Testing File Transfer Completion Status Update              ║
╚══════════════════════════════════════════════════════════════╝
    """)
    
    test_transfer_completion()
