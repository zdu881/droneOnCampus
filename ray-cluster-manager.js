/**
 * Ray Cluster Manager for droneOnCampus Dashboard
 * 专为dashboard集成优化的Ray集群管理器
 */

class RayClusterManager {
    constructor() {
        this.backendUrl = 'http://localhost:8000';
        this.websocket = null;
        this.isConnected = false;
        this.clusterData = {
            totalNodes: 0,
            aliveNodes: 0,
            totalCpus: 0,
            totalMemory: 0,
            usedCpus: 0,
            usedMemory: 0
        };
        this.nodes = [];
        this.updateInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    // 初始化管理器
    async initialize() {
        console.log('Initializing Ray Cluster Manager...');
        
        // 初始化UI
        this.initializeUI();
        
        // 建立WebSocket连接
        this.connectWebSocket();
        
        // 获取初始数据
        await this.fetchClusterData();
        
        // 设置定期更新
        this.startPeriodicUpdates();
        
        console.log('Ray Cluster Manager initialized successfully');
    }

    // 初始化UI组件
    initializeUI() {
        // 绑定控制按钮事件
        this.bindControlEvents();
        
        // 显示空状态
        this.showEmptyState();
    }

    // 绑定控制按钮事件
    bindControlEvents() {
        // 刷新集群数据
        const refreshBtn = document.querySelector('#refresh-cluster-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.fetchClusterData());
        }

        // 重启集群
        const restartBtn = document.querySelector('#restart-cluster-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartCluster());
        }

        // 停止集群
        const stopBtn = document.querySelector('#stop-cluster-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopCluster());
        }
    }

    // 建立WebSocket连接
    connectWebSocket() {
        try {
            const wsUrl = this.backendUrl.replace('http', 'ws') + '/ws';
            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                console.log('WebSocket connected to Ray cluster');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected');
            };

            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.websocket.onclose = () => {
                console.log('WebSocket connection closed');
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                this.attemptReconnect();
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
            };

        } catch (error) {
            console.error('Failed to establish WebSocket connection:', error);
            this.updateConnectionStatus('disconnected');
        }
    }

    // 处理WebSocket消息
    handleWebSocketMessage(data) {
        if (data.type === 'cluster_status') {
            this.updateClusterData(data.data);
        } else if (data.type === 'node_update') {
            this.updateNodeData(data.data);
        }
    }

    // 尝试重连
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            setTimeout(() => this.connectWebSocket(), 5000);
        } else {
            console.log('Max reconnection attempts reached');
        }
    }

    // 获取集群数据
    async fetchClusterData() {
        try {
            const response = await fetch(\`\${this.backendUrl}/cluster/status\`);
            if (!response.ok) {
                throw new Error(\`HTTP error! status: \${response.status}\`);
            }
            
            const data = await response.json();
            this.updateClusterData(data);
            
        } catch (error) {
            console.error('Error fetching cluster data:', error);
            this.showEmptyState('无法连接到Ray集群');
        }
    }

    // 更新集群数据
    updateClusterData(data) {
        this.clusterData = {
            totalNodes: data.total_nodes || 0,
            aliveNodes: data.alive_nodes || 0,
            totalCpus: data.total_cpus || 0,
            totalMemory: data.total_memory || 0,
            usedCpus: data.used_cpus || 0,
            usedMemory: data.used_memory || 0
        };
        
        this.nodes = data.nodes || [];
        
        this.updateMetrics();
        this.updateNodesGrid();
    }

    // 更新指标卡片
    updateMetrics() {
        // 更新总节点数
        this.updateMetricCard('total-nodes', this.clusterData.totalNodes, '个');
        
        // 更新活跃节点数
        this.updateMetricCard('alive-nodes', this.clusterData.aliveNodes, '个');
        
        // 更新CPU使用率
        const cpuUsage = this.clusterData.totalCpus > 0 
            ? ((this.clusterData.usedCpus / this.clusterData.totalCpus) * 100).toFixed(1)
            : 0;
        this.updateMetricCard('cpu-usage', cpuUsage, '%');
        
        // 更新内存使用率
        const memUsage = this.clusterData.totalMemory > 0 
            ? ((this.clusterData.usedMemory / this.clusterData.totalMemory) * 100).toFixed(1)
            : 0;
        this.updateMetricCard('memory-usage', memUsage, '%');
    }

    // 更新单个指标卡片
    updateMetricCard(metricId, value, unit) {
        const card = document.querySelector(\`[data-metric="\${metricId}"]\`);
        if (card) {
            const valueElement = card.querySelector('.metric-value');
            if (valueElement) {
                valueElement.textContent = \`\${value}\${unit}\`;
            }
        }
    }

    // 更新节点网格
    updateNodesGrid() {
        const nodesGrid = document.getElementById('cluster-nodes-grid');
        if (!nodesGrid) return;

        // 清空现有内容
        nodesGrid.innerHTML = '';

        if (this.nodes.length === 0) {
            this.showEmptyState('暂无节点数据');
            return;
        }

        // 创建节点卡片
        this.nodes.forEach(node => {
            const nodeCard = this.createNodeCard(node);
            nodesGrid.appendChild(nodeCard);
        });
    }

    // 创建节点卡片
    createNodeCard(node) {
        const card = document.createElement('div');
        card.className = 'cluster-node-card';
        
        const isAlive = node.is_alive;
        const statusClass = isAlive ? 'alive' : 'dead';
        const statusText = isAlive ? '在线' : '离线';
        
        card.innerHTML = \`
            <div class="node-header">
                <h4 class="node-title">\${node.node_id || 'Unknown Node'}</h4>
                <span class="node-badge \${statusClass}">\${statusText}</span>
            </div>
            <div class="node-info">
                <div class="info-item">
                    <span class="info-label">节点IP</span>
                    <span class="info-value">\${node.node_ip || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">启动时间</span>
                    <span class="info-value">\${this.formatUptime(node.boot_time)}</span>
                </div>
            </div>
            <div class="node-resources">
                <div class="resource-item">
                    <span class="resource-label">CPU</span>
                    <div class="stat-bar">
                        <div class="stat-fill cpu" style="width: \${this.calculateCpuUsage(node)}%"></div>
                    </div>
                    <span class="resource-value">\${node.cpu || 0}核</span>
                </div>
                <div class="resource-item">
                    <span class="resource-label">内存</span>
                    <div class="stat-bar">
                        <div class="stat-fill memory" style="width: \${this.calculateMemoryUsage(node)}%"></div>
                    </div>
                    <span class="resource-value">\${this.formatBytes(node.memory || 0)}</span>
                </div>
                <div class="resource-item">
                    <span class="resource-label">磁盘</span>
                    <div class="stat-bar">
                        <div class="stat-fill disk" style="width: \${this.calculateDiskUsage(node)}%"></div>
                    </div>
                    <span class="resource-value">\${this.formatBytes(node.disk || 0)}</span>
                </div>
            </div>
        \`;
        
        return card;
    }

    // 计算CPU使用率
    calculateCpuUsage(node) {
        return node.cpu_usage ? (node.cpu_usage * 100).toFixed(1) : 0;
    }

    // 计算内存使用率
    calculateMemoryUsage(node) {
        if (!node.memory_total || node.memory_total === 0) return 0;
        return ((node.memory_used || 0) / node.memory_total * 100).toFixed(1);
    }

    // 计算磁盘使用率
    calculateDiskUsage(node) {
        if (!node.disk_total || node.disk_total === 0) return 0;
        return ((node.disk_used || 0) / node.disk_total * 100).toFixed(1);
    }

    // 格式化字节数
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 格式化运行时间
    formatUptime(bootTime) {
        if (!bootTime) return 'N/A';
        
        const now = new Date();
        const boot = new Date(bootTime * 1000); // 假设是Unix时间戳
        const diffMs = now - boot;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) {
            return \`\${diffDays}天\${diffHours % 24}小时\`;
        } else {
            return \`\${diffHours}小时\`;
        }
    }

    // 显示空状态
    showEmptyState(message = '正在加载集群数据...') {
        const nodesGrid = document.getElementById('cluster-nodes-grid');
        if (!nodesGrid) return;

        nodesGrid.innerHTML = \`
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-server"></i>
                </div>
                <div class="empty-state-title">暂无集群数据</div>
                <div class="empty-state-description">\${message}</div>
            </div>
        \`;
    }

    // 更新连接状态
    updateConnectionStatus(status) {
        const statusElement = document.querySelector('.cluster-status-indicator');
        if (statusElement) {
            statusElement.className = \`cluster-status-indicator \${status}\`;
            statusElement.innerHTML = \`
                <div class="status-dot"></div>
                <span>\${status === 'connected' ? '已连接' : '未连接'}</span>
            \`;
        }
    }

    // 开始定期更新
    startPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            if (this.isConnected) {
                this.fetchClusterData();
            }
        }, 5000); // 每5秒更新一次
    }

    // 停止定期更新
    stopPeriodicUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    // 重启集群
    async restartCluster() {
        try {
            const response = await fetch(\`\${this.backendUrl}/cluster/restart\`, {
                method: 'POST'
            });
            
            if (response.ok) {
                console.log('Cluster restart initiated');
                // 稍后刷新数据
                setTimeout(() => this.fetchClusterData(), 3000);
            }
        } catch (error) {
            console.error('Error restarting cluster:', error);
        }
    }

    // 停止集群
    async stopCluster() {
        try {
            const response = await fetch(\`\${this.backendUrl}/cluster/stop\`, {
                method: 'POST'
            });
            
            if (response.ok) {
                console.log('Cluster stop initiated');
                this.showEmptyState('集群已停止');
            }
        } catch (error) {
            console.error('Error stopping cluster:', error);
        }
    }

    // 销毁管理器
    destroy() {
        this.stopPeriodicUpdates();
        
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        console.log('Ray Cluster Manager destroyed');
    }
}

// 确保在全局作用域中可用
window.RayClusterManager = RayClusterManager;
