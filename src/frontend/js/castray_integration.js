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

        if (!tabBtns || tabBtns.length === 0) return;

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                const targetEl = document.getElementById(targetTab);

                if (!targetEl) {
                    console.warn(`Tab target element not found: ${targetTab}`);
                    return;
                }

                // 移除所有活跃状态（防护性检查，避免 null.classList 抛错）
                tabBtns.forEach(b => { if (b && b.classList) b.classList.remove('active'); });
                tabContents.forEach(content => { if (content && content.classList) content.classList.remove('active'); });
                
                // 添加活跃状态（同样做空值检查）
                if (btn && btn.classList) btn.classList.add('active');
                if (targetEl && targetEl.classList) targetEl.classList.add('active');
            });
        });
    }

    setupEventListeners() {
        // 连接CastRay按钮
        const castrayConnectBtn = document.getElementById('castrayConnectBtn');
        if (castrayConnectBtn) castrayConnectBtn.addEventListener('click', () => this.connectToCastRay());

        const createNodeBtn = document.getElementById('createNodeBtn');
        if (createNodeBtn) createNodeBtn.addEventListener('click', () => this.createNode());

        const startTransferBtn = document.getElementById('startTransferBtn');
        if (startTransferBtn) startTransferBtn.addEventListener('click', () => this.startFileTransfer());

        const refreshFilesBtn = document.getElementById('refreshFilesBtn');
        if (refreshFilesBtn) refreshFilesBtn.addEventListener('click', () => this.fetchAvailableFiles());

        const discoverClustersBtn = document.getElementById('discoverClustersBtn');
        if (discoverClustersBtn) discoverClustersBtn.addEventListener('click', () => this.discoverExternalClusters());

        const generateFileBtn = document.getElementById('generateFileBtn');
        if (generateFileBtn) generateFileBtn.addEventListener('click', () => this.generateCustomFile());
    }

    async connectToCastRay() {
        try {
            console.log('正在连接CastRay后端...');
            
            // 更新状态为连接中（防护性检查）
            const statusEl = document.getElementById('castrayStatus');
            if (statusEl) {
                statusEl.textContent = '连接中...';
                statusEl.className = 'status-connecting';
            }
            
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
            if (statusEl) {
                statusEl.textContent = '已连接';
                statusEl.className = 'status-connected';
            }

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
            if (statusEl) {
                statusEl.textContent = `连接失败: ${error.message}`;
                statusEl.className = 'status-disconnected';
            }
            
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
                    const countEl = document.getElementById('castrayNodeCount');
                    if (countEl) countEl.textContent = status.total_nodes || this.castrayNodes.length;
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
            if (!response.ok) {
                console.warn(`fetch /api/files returned ${response.status}`);
                return;
            }
            const result = await response.json();
            
            const fileSelect = document.getElementById('fileName');
            if (fileSelect) fileSelect.innerHTML = '<option value="">选择文件</option>';
            
            if (result.files && result.files.length > 0) {
                result.files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file.name;
                    option.textContent = `${file.name} (${this.formatFileSize(file.size)})`;
                    if (fileSelect) fileSelect.appendChild(option);
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
        let container = document.getElementById('castrayNodesContainer');
        if (!container) {
            console.warn('castrayNodesContainer not found in DOM, attempting to recreate it');
            const nodesSection = document.querySelector('.nodes-section');
            if (nodesSection) {
                const wrapper = document.createElement('div');
                wrapper.className = 'node-category';
                wrapper.innerHTML = `\n                  <h3><i class="fas fa-network-wired"></i> CastRay传输节点</h3>\n                  <div id="castrayNodesContainer" class="castray-nodes-container"></div>\n                `;
                nodesSection.appendChild(wrapper);
                container = document.getElementById('castrayNodesContainer');
            } else {
                console.error('nodes-section not found in DOM; cannot render CastRay node cards');
                return;
            }
        }
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

    // === 新增功能：Ray集群自动发现 ===
    async discoverExternalClusters() {
        try {
            console.log('开始发现外部Ray集群...');
            document.getElementById('clusterDiscoveryStatus').textContent = '发现中...';
            
            const response = await fetch(`${this.castrayApiBase}/api/cluster/discover-external`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('集群发现结果:', result);

            if (result.success) {
                const clusters = result.discovered_clusters || [];
                const externalNodes = result.external_nodes || {};
                
                document.getElementById('clusterDiscoveryStatus').textContent = 
                    `发现 ${clusters.length} 个集群，${Object.keys(externalNodes).length} 个外部节点`;
                    
                // 更新集群列表显示
                this.updateDiscoveredClustersDisplay(clusters);
                
                // 刷新节点列表
                await this.fetchCastRayNodes();
                
            } else {
                document.getElementById('clusterDiscoveryStatus').textContent = 
                    `发现失败: ${result.error || '未知错误'}`;
            }

        } catch (error) {
            console.error('发现外部集群失败:', error);
            document.getElementById('clusterDiscoveryStatus').textContent = `发现失败: ${error.message}`;
        }
    }

    updateDiscoveredClustersDisplay(clusters) {
        const container = document.getElementById('discoveredClusters');
        container.innerHTML = '';

        if (clusters.length === 0) {
            container.innerHTML = '<div class="no-data">未发现外部集群</div>';
            return;
        }

        clusters.forEach(cluster => {
            const clusterDiv = document.createElement('div');
            clusterDiv.className = 'cluster-item';
            
            const status = cluster.status || 'unknown';
            const statusClass = status === 'active' ? 'status-connected' : 'status-disconnected';
            
            clusterDiv.innerHTML = `
                <div class="cluster-header">
                    <h4>集群 (${cluster.source})</h4>
                    <span class="status ${statusClass}">${status}</span>
                </div>
                <div class="cluster-details">
                    <p><strong>节点数:</strong> ${cluster.nodes || 0}</p>
                    ${cluster.dashboard_url ? `<p><strong>Dashboard:</strong> <a href="${cluster.dashboard_url}" target="_blank">${cluster.dashboard_url}</a></p>` : ''}
                    ${cluster.resources ? `<p><strong>资源:</strong> ${JSON.stringify(cluster.resources)}</p>` : ''}
                </div>
            `;
            
            container.appendChild(clusterDiv);
        });
    }

    // === 新增功能：自定义文件生成 ===
    async generateCustomFile() {
        const fileName = document.getElementById('customFileName').value.trim();
        const fileSize = document.getElementById('customFileSize').value.trim();
        const contentType = document.getElementById('customContentType').value;

        if (!fileName) {
            alert('请输入文件名');
            return;
        }

        if (!fileSize) {
            alert('请输入文件大小');
            return;
        }

        try {
            console.log(`生成自定义文件: ${fileName} (${fileSize})`);
            document.getElementById('fileGenerationStatus').textContent = '生成中...';
            
            const response = await fetch(`${this.castrayApiBase}/api/files/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_name: fileName,
                    size: fileSize,
                    content_type: contentType
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('文件生成结果:', result);

            if (result.success) {
                document.getElementById('fileGenerationStatus').textContent = 
                    `文件生成成功: ${result.file_info.file_name} (${this.formatFileSize(result.file_info.actual_size)})`;
                
                // 清空输入框
                document.getElementById('customFileName').value = '';
                document.getElementById('customFileSize').value = '';
                
                // 刷新文件列表
                await this.fetchAvailableFiles();
                
            } else {
                document.getElementById('fileGenerationStatus').textContent = 
                    `生成失败: ${result.error || '未知错误'}`;
            }

        } catch (error) {
            console.error('生成自定义文件失败:', error);
            document.getElementById('fileGenerationStatus').textContent = `生成失败: ${error.message}`;
        }
    }

    // 预设大小快速生成
    async generatePresetFile(preset) {
        const presetSizes = {
            'tiny': '1KB',
            'small': '10KB', 
            'medium': '100KB',
            'large': '1MB',
            'huge': '10MB',
            'massive': '100MB'
        };

        const size = presetSizes[preset];
        if (!size) {
            console.error('Unknown preset:', preset);
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `${preset}_file_${timestamp}.txt`;

        // 设置表单值
        document.getElementById('customFileName').value = fileName;
        document.getElementById('customFileSize').value = size;
        document.getElementById('customContentType').value = 'text';

        // 生成文件
        await this.generateCustomFile();
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
}

// 初始化CastRay集成
let castrayIntegration;
document.addEventListener('DOMContentLoaded', () => {
    castrayIntegration = new CastRayIntegration();
});
