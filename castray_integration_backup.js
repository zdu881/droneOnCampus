// CastRay集成模块
class CastRayIntegration {
    constructor() {
        this.castrayApiBase = 'http://10.30.2.11:8000';
        this.websocket = null;
        this.castrayNodes = [];
        this.transferLog = [];
        this.isConnected = false;
        
        this.init();
    }

    init() {
        console.log('初始化CastRay集成...');
        this.setupTabNavigation();
        this.setupEventListeners();
        this.connectToCastRay();
    }

    setupTabNavigation() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // 移除所有活跃状态
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                
                // 添加活跃状态
                btn.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
            });
        });
    }

    setupEventListeners() {
        // 连接CastRay按钮
        document.getElementById('castrayConnectBtn').addEventListener('click', () => {
            this.connectToCastRay();
        });

        // 创建节点按钮
        document.getElementById('createNodeBtn').addEventListener('click', () => {
            this.createNode();
        });

        // 开始传输按钮
        document.getElementById('startTransferBtn').addEventListener('click', () => {
            this.startFileTransfer();
        });

        // 刷新文件列表按钮
        document.getElementById('refreshFilesBtn').addEventListener('click', () => {
            this.fetchAvailableFiles();
        });
    }

    async connectToCastRay() {
        try {
            console.log('正在连接CastRay后端...');
            
            // 更新状态为连接中
            document.getElementById('castrayStatus').textContent = '连接中...';
            document.getElementById('castrayStatus').className = 'status-connecting';
            
            // 测试API连接 - 添加更详细的错误处理
            const response = await fetch(`${this.castrayApiBase}/api/status`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                mode: 'cors'  // 明确指定CORS模式
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const status = await response.json();
            console.log('CastRay状态:', status);

            this.isConnected = true;
            document.getElementById('castrayStatus').textContent = '已连接';
            document.getElementById('castrayStatus').className = 'status-connected';

            // 更新统计信息
            if (status.total_nodes) {
                document.getElementById('castrayNodeCount').textContent = status.total_nodes;
            }

            // 获取节点列表
            await this.fetchCastRayNodes();

            // 获取可用文件列表
            await this.fetchAvailableFiles();

            // 建立WebSocket连接
            this.connectWebSocket();

            // 定期更新数据
            this.startPeriodicUpdates();

        } catch (error) {
            console.error('连接CastRay失败:', error);
            this.isConnected = false;
            document.getElementById('castrayStatus').textContent = `连接失败: ${error.message}`;
            document.getElementById('castrayStatus').className = 'status-disconnected';
            
            // 5秒后重试连接
            setTimeout(() => {
                console.log('5秒后重试连接...');
                this.connectToCastRay();
            }, 5000);
        }
    }

    connectWebSocket() {
        try {
            this.websocket = new WebSocket('ws://10.30.2.11:8000/ws');
            
            this.websocket.onopen = () => {
                console.log('WebSocket连接已建立');
            };

            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
            };

            this.websocket.onclose = () => {
                console.log('WebSocket连接已关闭');
                // 5秒后重连
                setTimeout(() => {
                    if (this.isConnected) {
                        this.connectWebSocket();
                    }
                }, 5000);
            };

        } catch (error) {
            console.error('WebSocket连接失败:', error);
        }
    }

    handleWebSocketMessage(data) {
        if (data.type === 'status_update') {
            this.updateCastRayStatus(data.data);
        } else if (data.type === 'transfer_update') {
            this.updateTransferLog(data.data);
        }
    }

    async fetchCastRayNodes() {
        try {
            const response = await fetch(`${this.castrayApiBase}/api/status`);
            if (response.ok) {
                const status = await response.json();
                // 从状态响应中提取节点信息
                if (status.node_statuses) {
                    this.castrayNodes = status.node_statuses;
                    this.updateCastRayNodesDisplay();
                    this.updateNodeSelectors();
                    
                    // 更新节点计数
                    document.getElementById('castrayNodeCount').textContent = status.total_nodes || this.castrayNodes.length;
                }
            }
        } catch (error) {
            console.error('获取CastRay节点失败:', error);
        }
    }

    async createNode() {
        const nodeId = document.getElementById('newNodeId').value.trim();
        if (!nodeId) {
            alert('请输入节点ID');
            return;
        }

        try {
            const response = await fetch(`${this.castrayApiBase}/api/nodes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    node_id: nodeId,
                    port: 0 // 自动分配端口
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log(`节点 ${nodeId} 创建成功`);
                document.getElementById('newNodeId').value = '';
                await this.fetchCastRayNodes();
            } else {
                alert(`创建节点失败: ${result.message}`);
            }
        } catch (error) {
            console.error('创建节点失败:', error);
            alert('创建节点失败');
        }
    }

    async fetchAvailableFiles() {
        try {
            const response = await fetch(`${this.castrayApiBase}/api/files`);
            const result = await response.json();
            
            const fileSelect = document.getElementById('fileName');
            fileSelect.innerHTML = '<option value="">选择文件</option>';
            
            if (result.files && result.files.length > 0) {
                result.files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file.name;
                    option.textContent = `${file.name} (${this.formatFileSize(file.size)})`;
                    fileSelect.appendChild(option);
                });
                console.log(`加载了 ${result.files.length} 个可用文件`);
            } else {
                console.log('没有找到可用文件');
            }
        } catch (error) {
            console.error('获取文件列表失败:', error);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async startFileTransfer() {
        const sourceNode = document.getElementById('sourceNode').value;
        const targetNode = document.getElementById('targetNode').value;
        const fileName = document.getElementById('fileName').value;

        if (!sourceNode || !targetNode || !fileName) {
            alert('请填写完整的传输信息');
            return;
        }

        try {
            const response = await fetch(`${this.castrayApiBase}/api/file-transfers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source_node: sourceNode,
                    target_node: targetNode,
                    file_name: fileName
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('文件传输已启动');
                this.addTransferLog(`启动传输: ${sourceNode} -> ${targetNode}, 文件: ${fileName}`);
            } else {
                alert(`传输失败: ${result.message}`);
            }
        } catch (error) {
            console.error('启动文件传输失败:', error);
            alert('启动文件传输失败');
        }
    }

    updateCastRayStatus(status) {
        if (status.nodes) {
            document.getElementById('castrayNodeCount').textContent = Object.keys(status.nodes).length;
            this.castrayNodes = Object.values(status.nodes);
            this.updateCastRayNodesDisplay();
        }

        if (status.transfers) {
            const activeTransfers = status.transfers.filter(t => t.status === 'active').length;
            document.getElementById('activeTransfers').textContent = activeTransfers;
        }
    }

    updateCastRayNodesDisplay() {
        const container = document.getElementById('castrayNodesContainer');
        container.innerHTML = '';

        this.castrayNodes.forEach(node => {
            const nodeCard = document.createElement('div');
            nodeCard.className = 'castray-node-card';
            nodeCard.innerHTML = `
                <div class="node-header">
                    <h4>${node.node_id}</h4>
                    <span class="node-status ${node.is_running ? 'running' : 'stopped'}">${node.is_running ? '运行中' : '已停止'}</span>
                </div>
                <div class="node-details">
                    <p>端口: ${node.port || 'N/A'}</p>
                    <p>已发送消息: ${node.sent_count || 0}</p>
                    <p>已接收消息: ${node.received_count || 0}</p>
                    <p>活跃传输: ${node.active_transfers || 0}</p>
                    <p>传输队列: ${node.auto_transfer_queue || 0}</p>
                    <p>成功传输: ${node.file_transfer_stats?.successful_transfers || 0}</p>
                </div>
                <div class="node-actions">
                    <button onclick="castrayIntegration.removeNode('${node.node_id}')">删除</button>
                </div>
            `;
            container.appendChild(nodeCard);
        });
    }

    updateNodeSelectors() {
        const sourceSelect = document.getElementById('sourceNode');
        const targetSelect = document.getElementById('targetNode');
        
        // 清空现有选项
        sourceSelect.innerHTML = '<option value="">选择源节点</option>';
        targetSelect.innerHTML = '<option value="">选择目标节点</option>';

        // 添加节点选项
        this.castrayNodes.forEach(node => {
            const nodeId = node.node_id;
            const option1 = document.createElement('option');
            option1.value = nodeId;
            option1.textContent = `${nodeId} (端口: ${node.port})`;
            sourceSelect.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = nodeId;
            option2.textContent = `${nodeId} (端口: ${node.port})`;
            targetSelect.appendChild(option2);
        });
    }

    async removeNode(nodeId) {
        if (!confirm(`确定要删除节点 ${nodeId} 吗？`)) {
            return;
        }

        try {
            const response = await fetch(`${this.castrayApiBase}/api/nodes/${nodeId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            if (result.success) {
                console.log(`节点 ${nodeId} 已删除`);
                await this.fetchCastRayNodes();
            } else {
                alert(`删除节点失败: ${result.message}`);
            }
        } catch (error) {
            console.error('删除节点失败:', error);
            alert('删除节点失败');
        }
    }

    addTransferLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.transferLog.unshift(`[${timestamp}] ${message}`);
        
        // 保持日志数量在100条以内
        if (this.transferLog.length > 100) {
            this.transferLog = this.transferLog.slice(0, 100);
        }

        this.updateTransferLogDisplay();
    }

    updateTransferLogDisplay() {
        const container = document.getElementById('transferLogContainer');
        container.innerHTML = this.transferLog.map(log => 
            `<div class="log-entry">${log}</div>`
        ).join('');
    }

    async fetchFileTransferStatus() {
        try {
            const response = await fetch(`${this.castrayApiBase}/api/file-transfers/status`);
            if (response.ok) {
                const status = await response.json();
                
                document.getElementById('totalTransfers').textContent = status.total || 0;
                document.getElementById('successfulTransfers').textContent = status.successful || 0;
                document.getElementById('ongoingTransfers').textContent = status.ongoing || 0;
            }
        } catch (error) {
            console.error('获取文件传输状态失败:', error);
        }
    }

    startPeriodicUpdates() {
        // 每5秒更新一次数据
        setInterval(() => {
            if (this.isConnected) {
                this.fetchCastRayNodes();
                this.fetchFileTransferStatus();
            }
        }, 5000);
    }
}

// 初始化CastRay集成
let castrayIntegration;
document.addEventListener('DOMContentLoaded', () => {
    castrayIntegration = new CastRayIntegration();
});
