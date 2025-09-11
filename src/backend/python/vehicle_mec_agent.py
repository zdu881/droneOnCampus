#!/usr/bin/env python3
"""
自动驾驶汽车MEC切换Agent后端服务
处理智能决策和网络配置更新
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import yaml
import time
import logging
import subprocess
import threading
from datetime import datetime
import requests

app = Flask(__name__)
CORS(app)

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VehicleMECAgent:
    def __init__(self):
        self.current_config = {}
        self.decision_history = []
        self.mec_servers = {
            'east': {
                'name': '东区MEC',
                'ip': '192.168.1.10',
                'upf_name': 'upf-east',
                'position': {'x': 1000, 'y': 0},
                'coverage_radius': 500
            },
            'west': {
                'name': '西区MEC',
                'ip': '192.168.1.20',
                'upf_name': 'upf-west',
                'position': {'x': -1000, 'y': 0},
                'coverage_radius': 500
            },
            'north': {
                'name': '北区MEC',
                'ip': '192.168.1.30',
                'upf_name': 'upf-north',
                'position': {'x': 0, 'y': 1000},
                'coverage_radius': 500
            }
        }
        
        # SMF配置模板
        self.smf_config_template = {
            'configuration': {
                'smfName': 'SMF',
                'sbi': {
                    'scheme': 'http',
                    'registerIPv4': '127.0.0.12',
                    'bindingIPv4': '127.0.0.12',
                    'port': 8000
                },
                'serviceNameList': ['nsmf-pdusession', 'nsmf-event-exposure', 'nsmf-oam'],
                'snssaiInfos': [
                    {
                        'sNssai': {'sst': 1, 'sd': '010203'},
                        'dnnInfos': [
                            {
                                'dnn': 'internet',
                                'dns': {'ipv4': '8.8.8.8'}
                            }
                        ]
                    }
                ],
                'plmnList': [
                    {
                        'plmnId': {'mcc': '208', 'mnc': '93'},
                        'snssaiList': [{'sst': 1, 'sd': '010203'}]
                    }
                ],
                'locality': 'area1',
                'pfcp': {
                    'addr': '127.0.0.12'
                },
                'userplaneInformation': {
                    'upNodes': {},  # 动态配置
                    'links': []     # 动态配置
                },
                'nrfUri': 'http://127.0.0.10:8000',
                'ulcl': False
            }
        }

    def analyze_position_and_decide(self, vehicle_position, current_mec, reasoning_request=True):
        """
        基于车辆位置进行智能决策分析
        """
        logger.info(f"分析车辆位置: {vehicle_position}, 当前MEC: {current_mec}")
        
        # 计算到各个MEC的距离
        distances = {}
        for mec_id, mec_info in self.mec_servers.items():
            dx = vehicle_position['x'] - mec_info['position']['x']
            dy = vehicle_position['y'] - mec_info['position']['y']
            distances[mec_id] = (dx**2 + dy**2)**0.5
        
        # 找到最近的MEC
        nearest_mec = min(distances.keys(), key=lambda k: distances[k])
        nearest_distance = distances[nearest_mec]
        current_distance = distances[current_mec]
        
        # 决策逻辑
        distance_improvement = current_distance - nearest_distance
        should_switch = (nearest_mec != current_mec and 
                        distance_improvement > 200 and  # 距离改善阈值
                        nearest_distance < self.mec_servers[nearest_mec]['coverage_radius'])
        
        # 生成推理文本
        if reasoning_request and should_switch:
            reasoning = self._generate_llm_reasoning(
                vehicle_position, current_mec, nearest_mec, 
                current_distance, nearest_distance, distance_improvement
            )
        else:
            reasoning = f"车辆位置分析完成。当前最优MEC: {nearest_mec}"
        
        decision = {
            'timestamp': datetime.now().isoformat(),
            'vehicle_position': vehicle_position,
            'current_mec': current_mec,
            'nearest_mec': nearest_mec,
            'distances': distances,
            'should_switch': should_switch,
            'reasoning': reasoning,
            'confidence': 0.85 if should_switch else 0.7
        }
        
        # 记录决策历史
        self.decision_history.append(decision)
        
        return decision

    def _generate_llm_reasoning(self, vehicle_pos, current_mec, target_mec, 
                               current_dist, target_dist, improvement):
        """
        生成类似LLM的推理文本
        """
        templates = [
            f"根据车辆当前坐标 ({vehicle_pos['x']}, {vehicle_pos['y']})，我分析得出车辆位于城市{self._get_area_description(vehicle_pos)}区域。"
            f"当前连接的是{self.mec_servers[current_mec]['name']}，距离为{current_dist:.0f}单位。"
            f"而{self.mec_servers[target_mec]['name']}距离仅为{target_dist:.0f}单位，更加接近。"
            f"为了获得最低的访问延迟，建议将UE会话路由到{self.mec_servers[target_mec]['upf_name']}。",
            
            f"车辆移动轨迹显示其正在向{self._get_area_description(vehicle_pos)}方向行驶。"
            f"基于地理位置优化原则，{self.mec_servers[target_mec]['name']}是当前最优选择。"
            f"距离优势达到{improvement:.0f}单位，预计可显著降低网络延迟。执行MEC切换操作。"
        ]
        
        return templates[0]  # 使用第一个模板

    def _get_area_description(self, position):
        """根据坐标判断区域"""
        if position['x'] > 500:
            return "东"
        elif position['x'] < -500:
            return "西"
        elif position['y'] > 500:
            return "北"
        else:
            return "中心"

    def update_smf_configuration(self, target_upf):
        """
        更新SMF配置以路由到指定的UPF
        """
        logger.info(f"更新SMF配置，目标UPF: {target_upf}")
        
        try:
            # 创建新的SMF配置
            new_config = self.smf_config_template.copy()
            
            # 配置用户面信息
            if target_upf == 'upf-east':
                upf_config = {
                    'upf-east': {
                        'type': 'UPF',
                        'nodeID': '127.0.0.8',
                        'addr': '127.0.0.8',
                        'sNssaiUpfInfos': [
                            {
                                'sNssai': {'sst': 1, 'sd': '010203'},
                                'dnnUpfInfoList': [
                                    {
                                        'dnn': 'internet',
                                        'pools': [{'cidr': '10.60.0.0/16'}],
                                        'staticPools': [{'cidr': '10.60.100.0/24'}]
                                    }
                                ]
                            }
                        ],
                        'interfaces': [
                            {
                                'interfaceType': 'N3',
                                'endpoints': ['127.0.0.8'],
                                'networkInstance': 'internet'
                            }
                        ]
                    }
                }
            elif target_upf == 'upf-west':
                upf_config = {
                    'upf-west': {
                        'type': 'UPF',
                        'nodeID': '127.0.0.18',
                        'addr': '127.0.0.18',
                        'sNssaiUpfInfos': [
                            {
                                'sNssai': {'sst': 1, 'sd': '010203'},
                                'dnnUpfInfoList': [
                                    {
                                        'dnn': 'internet',
                                        'pools': [{'cidr': '10.61.0.0/16'}],
                                        'staticPools': [{'cidr': '10.61.100.0/24'}]
                                    }
                                ]
                            }
                        ],
                        'interfaces': [
                            {
                                'interfaceType': 'N3',
                                'endpoints': ['127.0.0.18'],
                                'networkInstance': 'internet'
                            }
                        ]
                    }
                }
            else:  # upf-north
                upf_config = {
                    'upf-north': {
                        'type': 'UPF',
                        'nodeID': '127.0.0.28',
                        'addr': '127.0.0.28',
                        'sNssaiUpfInfos': [
                            {
                                'sNssai': {'sst': 1, 'sd': '010203'},
                                'dnnUpfInfoList': [
                                    {
                                        'dnn': 'internet',
                                        'pools': [{'cidr': '10.62.0.0/16'}],
                                        'staticPools': [{'cidr': '10.62.100.0/24'}]
                                    }
                                ]
                            }
                        ],
                        'interfaces': [
                            {
                                'interfaceType': 'N3',
                                'endpoints': ['127.0.0.28'],
                                'networkInstance': 'internet'
                            }
                        ]
                    }
                }
            
            new_config['configuration']['userplaneInformation']['upNodes'] = upf_config
            
            # 写入配置文件
            config_path = '/tmp/smf.yaml'
            with open(config_path, 'w') as f:
                yaml.dump(new_config, f, default_flow_style=False)
            
            logger.info(f"SMF配置已更新: {config_path}")
            
            # 模拟重启SMF服务
            self._restart_smf_service()
            
            return True
            
        except Exception as e:
            logger.error(f"更新SMF配置失败: {e}")
            return False

    def _restart_smf_service(self):
        """
        模拟重启SMF服务
        """
        logger.info("重启SMF服务...")
        # 在实际环境中，这里会执行真正的服务重启命令
        # subprocess.run(['systemctl', 'restart', 'free5gc-smf'])
        time.sleep(2)  # 模拟重启时间
        logger.info("SMF服务重启完成")

    def measure_latency(self, target_ip):
        """
        测量到目标IP的延迟
        """
        try:
            # 执行ping命令
            result = subprocess.run(
                ['ping', '-c', '3', target_ip],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                # 解析ping结果
                lines = result.stdout.split('\n')
                for line in lines:
                    if 'avg' in line:
                        # 提取平均延迟
                        parts = line.split('/')
                        if len(parts) >= 5:
                            avg_latency = float(parts[4])
                            return avg_latency
                
                # 如果没有找到avg，返回模拟值
                return 10 + (hash(target_ip) % 20)  # 10-30ms
            else:
                logger.warning(f"Ping到{target_ip}失败")
                return None
                
        except Exception as e:
            logger.error(f"延迟测量失败: {e}")
            # 返回模拟延迟
            return 15 + (hash(target_ip) % 25)  # 15-40ms

# 全局Agent实例
agent = VehicleMECAgent()

@app.route('/api/agent/decision', methods=['POST'])
def agent_decision():
    """
    Agent决策API端点
    """
    try:
        data = request.json
        vehicle_position = data.get('vehicle_position', {})
        current_mec = data.get('current_mec', 'east')
        
        # 执行决策分析
        decision = agent.analyze_position_and_decide(vehicle_position, current_mec)
        
        return jsonify({
            'success': True,
            'decision': decision,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"决策API错误: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/network/config', methods=['POST'])
def update_network_config():
    """
    网络配置更新API端点
    """
    try:
        data = request.json
        action = data.get('action')
        target_upf = data.get('target_upf')
        ue_id = data.get('ue_id', 'vehicle-001')
        
        if action == 'update_smf':
            # 更新SMF配置
            success = agent.update_smf_configuration(target_upf)
            
            if success:
                return jsonify({
                    'success': True,
                    'message': f'SMF配置已更新为{target_upf}',
                    'timestamp': datetime.now().isoformat()
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'SMF配置更新失败'
                }), 500
        else:
            return jsonify({
                'success': False,
                'error': f'未知操作: {action}'
            }), 400
            
    except Exception as e:
        logger.error(f"网络配置API错误: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/network/latency', methods=['POST'])
def measure_latency():
    """
    延迟测量API端点
    """
    try:
        data = request.json
        target_ips = data.get('target_ips', [])
        
        results = {}
        for ip in target_ips:
            latency = agent.measure_latency(ip)
            results[ip] = latency
        
        return jsonify({
            'success': True,
            'latencies': results,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"延迟测量API错误: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/vehicle/status', methods=['GET'])
def get_vehicle_status():
    """
    获取车辆和网络状态
    """
    try:
        # 模拟车辆状态
        status = {
            'vehicle': {
                'position': {'x': 0, 'y': 0},
                'speed': 45.5,
                'direction': 'North'
            },
            'network': {
                'current_mec': 'east',
                'latencies': {
                    'east': 12.5,
                    'west': 45.2,
                    'north': 38.7
                }
            },
            'decisions': len(agent.decision_history)
        }
        
        return jsonify({
            'success': True,
            'status': status,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"状态获取API错误: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/agent/history', methods=['GET'])
def get_decision_history():
    """
    获取决策历史
    """
    try:
        return jsonify({
            'success': True,
            'history': agent.decision_history[-20:],  # 最近20条
            'total_decisions': len(agent.decision_history)
        })
        
    except Exception as e:
        logger.error(f"历史获取API错误: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    logger.info("启动车辆MEC切换Agent服务...")
    app.run(host='0.0.0.0', port=5000, debug=True)
