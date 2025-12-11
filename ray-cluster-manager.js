/**
 * CastRay Cluster Manager for droneOnCampus Dashboard
 * 专为dashboard集成优化的CastRay集群管理器
 */

class RayClusterManager {
    constructor() {
        // 优先使用 window.appConfig.castrayApiBase（CastRay 内嵌服务，端口 28823），其次使用默认地址
        try {
            const cfg = (window && window.appConfig) ? window.appConfig : {};
            this.backendUrl = cfg.castrayApiBase || 'http://10.30.2.11:28823';
        } catch (e) {
            this.backendUrl = 'http://10.30.2.11:28823';
        }
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
        console.log('Initializing CastRay Cluster Manager...');
        console.log('[CastRay] Backend URL:', this.backendUrl);
        
        // 初始化UI
        this.initializeUI();
        
        // 先获取初始数据,然后再建立WebSocket连接
        await this.fetchClusterData();
        
        // 建立WebSocket连接(用于实时更新)
        this.connectWebSocket();
        
        // WebSocket已经提供实时更新,不需要额外的轮询
        // this.startPeriodicUpdates();
        
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

        // 节点过滤
        const nodesFilter = document.getElementById('nodes-filter');
        if (nodesFilter) {
            nodesFilter.addEventListener('change', () => this.updateNodesGrid());
        }

        // 节点排序
        const nodesSort = document.getElementById('nodes-sort');
        if (nodesSort) {
            nodesSort.addEventListener('change', () => this.updateNodesGrid());
        }

        // 文件传输按钮
        const fileTransferBtn = document.getElementById('cluster-file-transfer-btn');
        if (fileTransferBtn) {
            fileTransferBtn.addEventListener('click', () => this.showFileTransferModal());
        }

        // 文件传输模态框关闭
        const modalClose = document.querySelector('#file-transfer-modal .modal-close');
        const modalCancel = document.getElementById('file-transfer-cancel');
        if (modalClose) {
            modalClose.addEventListener('click', () => this.hideFileTransferModal());
        }
        if (modalCancel) {
            modalCancel.addEventListener('click', () => this.hideFileTransferModal());
        }

        // 文件传输表单提交
        const fileTransferForm = document.getElementById('file-transfer-form');
        if (fileTransferForm) {
            fileTransferForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitFileTransfer();
            });
        }
    }

    // 建立WebSocket连接
    connectWebSocket() {
        try {
            // 优先使用 window.appConfig.castrayWsUrl，否则从 backendUrl 转换
            let wsUrl = (window && window.appConfig && window.appConfig.castrayWsUrl)
                ? window.appConfig.castrayWsUrl
                : (this.backendUrl.replace('http', 'ws') + '/ws');
            
            console.log('[CastRay] Connecting to WebSocket:', wsUrl);
            this.websocket = new WebSocket(wsUrl);

            this.websocket.onopen = () => {
                console.log('[CastRay] WebSocket connected:', wsUrl);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected');
            };

            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[Ray] WebSocket message received:', data.type);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('[Ray] Error parsing WebSocket message:', error);
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
            const apiUrl = `${this.backendUrl}/api/ray-dashboard`;
            console.log('[CastRay] Fetching cluster data from:', apiUrl);
            
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('[CastRay] Cluster data received:', result);
            // /api/ray-dashboard 返回 {data: {nodes: [], summary: {}}}
            if (result.data) {
                this.updateClusterData(result.data);
            } else {
                console.warn('Unexpected data structure from API');
                this.updateClusterData(result);
            }
            
        } catch (error) {
            console.error('Error fetching cluster data:', error);
            this.showEmptyState('无法连接到CastRay集群');
        }
    }

    // 更新集群数据
    updateClusterData(data) {
        // 从 /api/ray-dashboard 的响应中提取数据
        // data 应该是 {nodes: [], summary: {}}
        if (!data || typeof data !== 'object') {
            console.warn('Invalid data received:', data);
            return;
        }
        
        const nodes = data.nodes || [];
        const summary = data.summary || {};
        
        console.log(`[Ray] Updating cluster data: ${nodes.length} nodes`);
        
        // 防止空数据覆盖现有数据
        if (nodes.length === 0 && this.nodes.length > 0) {
            console.warn('[Ray] Received empty nodes array, keeping existing data');
            return;
        }
        
        // 使用 summary 中的聚合数据
        const cpuResources = summary.resources?.cpu || {};
        const memoryResources = summary.resources?.memory || {};
        const gpuResources = summary.resources?.gpu || {};
        
        this.clusterData = {
            totalNodes: summary.totalNodes || nodes.length,
            aliveNodes: summary.aliveNodes || nodes.filter(n => n.status === 'active').length,
            totalCpus: cpuResources.total || 0,
            usedCpus: cpuResources.used || 0,
            totalMemory: memoryResources.total || 0,
            usedMemory: memoryResources.used || 0,
            totalGpus: gpuResources.total || 0,
            usedGpus: gpuResources.used || 0
        };
        
        this.nodes = nodes;
        
        this.updateMetrics();
        this.updateNodesGrid();
        this.updateConnectionStatus('connected');
    }

    // 更新指标卡片
    updateMetrics() {
        // 更新总节点数
        const totalNodesEl = document.getElementById('total-nodes-value');
        if (totalNodesEl) totalNodesEl.textContent = this.clusterData.totalNodes;
        
        // 更新活跃节点数
        const aliveNodesEl = document.getElementById('alive-nodes-value');
        if (aliveNodesEl) aliveNodesEl.textContent = this.clusterData.aliveNodes;
        
        // 更新 CPU 使用 - 仅显示百分比
        const cpuUsageEl = document.getElementById('cpu-usage-value');
        if (cpuUsageEl) {
            const cpuPercent = this.clusterData.totalCpus > 0 
                ? (this.clusterData.usedCpus / this.clusterData.totalCpus * 100).toFixed(0) 
                : 0;
            cpuUsageEl.textContent = `${cpuPercent}%`;
        }
        
        // 更新内存使用 - 仅显示百分比
        const memUsageEl = document.getElementById('memory-usage-value');
        if (memUsageEl) {
            const memPercent = this.clusterData.totalMemory > 0 
                ? (this.clusterData.usedMemory / this.clusterData.totalMemory * 100).toFixed(0) 
                : 0;
            memUsageEl.textContent = `${memPercent}%`;
        }
        
        // 更新 GPU 资源
        const gpuUsageEl = document.getElementById('gpu-usage-value');
        if (gpuUsageEl) {
            gpuUsageEl.textContent = `${this.clusterData.totalGpus || 0}`;
        }
        
        // 更新节点计数徽章
        const nodeBadge = document.getElementById('node-count-badge');
        if (nodeBadge) nodeBadge.textContent = this.clusterData.totalNodes;
        
        // 更新总节点数（旧方法保留兼容）
        this.updateMetricCard('total-nodes', this.clusterData.totalNodes, '个');
        
        // 更新活跃节点数（旧方法保留兼容）
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
        const card = document.querySelector(`[data-metric="${metricId}"]`);
        if (card) {
            const valueElement = card.querySelector('.metric-value');
            if (valueElement) {
                valueElement.textContent = `${value}${unit}`;
            }
        }
    }

    // 更新节点网格 - 使用增量更新避免闪烁
    updateNodesGrid() {
        const nodesGrid = document.getElementById('cluster-nodes-grid');
        if (!nodesGrid) return;

        if (this.nodes.length === 0) {
            nodesGrid.innerHTML = '';
            this.showEmptyState('暂无节点数据');
            return;
        }

        // 获取过滤和排序选项
        const filterValue = document.getElementById('nodes-filter')?.value || 'all';
        const sortValue = document.getElementById('nodes-sort')?.value || 'name';

        // 过滤节点
        let filteredNodes = this.nodes.filter(node => {
            if (filterValue === 'all') return true;
            if (filterValue === 'active') return node.status === 'active';
            if (filterValue === 'inactive') return node.status !== 'active';
            if (filterValue === 'gpu') return node.resources && node.resources.totalGpu > 0;
            if (filterValue === 'wired') return node.connectionType === 'wired';
            if (filterValue === 'wireless') return node.connectionType === 'wireless';
            return true;
        });

        // 排序节点
        filteredNodes.sort((a, b) => {
            if (sortValue === 'name') {
                return (a.name || '').localeCompare(b.name || '');
            } else if (sortValue === 'cpu') {
                return (b.cpu || 0) - (a.cpu || 0);
            } else if (sortValue === 'memory') {
                return (b.memory || 0) - (a.memory || 0);
            } else if (sortValue === 'gpu') {
                return (b.gpu || 0) - (a.gpu || 0);
            }
            return 0;
        });

        // 如果没有匹配的节点，显示空状态
        if (filteredNodes.length === 0) {
            nodesGrid.innerHTML = '';
            this.showEmptyState('没有符合条件的节点');
            return;
        }

        // 使用增量更新策略 - 构建现有卡片映射
        const existingCards = {};
        Array.from(nodesGrid.children).forEach(card => {
            const nodeId = card.dataset.nodeId;
            if (nodeId) {
                existingCards[nodeId] = card;
            }
        });

        // 构建应该显示的节点ID集合
        const displayedNodeIds = new Set(filteredNodes.map(n => n.nodeId || n.nodeIp));

        // 移除不再显示的节点卡片
        Object.keys(existingCards).forEach(nodeId => {
            if (!displayedNodeIds.has(nodeId)) {
                existingCards[nodeId].remove();
                delete existingCards[nodeId];
            }
        });

        // 更新或创建节点卡片
        filteredNodes.forEach((node, index) => {
            const nodeId = node.nodeId || node.nodeIp;
            const existingCard = existingCards[nodeId];

            if (existingCard) {
                // 更新现有卡片
                this.updateNodeCard(existingCard, node);
                // 确保顺序正确
                if (nodesGrid.children[index] !== existingCard) {
                    nodesGrid.insertBefore(existingCard, nodesGrid.children[index] || null);
                }
            } else {
                // 创建新卡片
                const newCard = this.createNodeCard(node);
                if (index < nodesGrid.children.length) {
                    nodesGrid.insertBefore(newCard, nodesGrid.children[index]);
                } else {
                    nodesGrid.appendChild(newCard);
                }
            }
        });
    }

    // 更新现有节点卡片 - 只更新变化的数据，不重建DOM
    updateNodeCard(card, node) {
        const nodeId = node.nodeId || node.nodeIp;
        card.dataset.nodeId = nodeId;

        // 更新状态徽章
        const isAlive = node.status === 'active';
        const statusBadge = card.querySelector('.node-badge');
        if (statusBadge) {
            statusBadge.className = `node-badge ${isAlive ? 'alive' : 'dead'}`;
            statusBadge.textContent = isAlive ? '在线' : '离线';
        }

        // 更新工作状态指示灯
        this.updateWorkStatus(card, node.workStatus || 'idle');

        // 获取资源使用率
        const cpuUsedPercent = node.cpu || 0;
        const memUsedPercent = node.memory || 0;
        const gpuUsedPercent = node.gpu || 0;

        // 更新CPU资源卡片
        const cpuCards = card.querySelectorAll('.resource-card');
        if (cpuCards[0]) {
            const cpuRing = cpuCards[0].querySelector('.progress-ring-fill');
            const cpuPercent = cpuCards[0].querySelector('.progress-percentage');
            const cpuValue = cpuCards[0].querySelector('.resource-card-value');
            if (cpuRing) {
                cpuRing.style.stroke = this.getUsageColor(cpuUsedPercent);
                cpuRing.style.strokeDasharray = `${(cpuUsedPercent / 100 * 163.36).toFixed(2)} 163.36`;
            }
            if (cpuPercent) cpuPercent.textContent = `${cpuUsedPercent.toFixed(0)}%`;
            if (cpuValue) {
                const cpuTotal = (node.resources?.totalCpu || 0).toFixed(0);
                cpuValue.textContent = `${cpuTotal} 核`;
            }
        }

        // 更新内存资源卡片
        if (cpuCards[1]) {
            const memRing = cpuCards[1].querySelector('.progress-ring-fill');
            const memPercent = cpuCards[1].querySelector('.progress-percentage');
            const memValue = cpuCards[1].querySelector('.resource-card-value');
            if (memRing) {
                memRing.style.stroke = this.getUsageColor(memUsedPercent);
                memRing.style.strokeDasharray = `${(memUsedPercent / 100 * 163.36).toFixed(2)} 163.36`;
            }
            if (memPercent) memPercent.textContent = `${memUsedPercent.toFixed(0)}%`;
            if (memValue) {
                const memoryTotal = node.resources?.totalMemory || 0;
                memValue.textContent = `${memoryTotal.toFixed(1)} GB`;
            }
        }

        // 更新GPU资源卡片(如果存在)
        if (cpuCards[2]) {
            const gpuRing = cpuCards[2].querySelector('.progress-ring-fill');
            const gpuPercent = cpuCards[2].querySelector('.progress-percentage');
            const gpuValue = cpuCards[2].querySelector('.resource-card-value');
            if (gpuRing) {
                gpuRing.style.stroke = this.getUsageColor(gpuUsedPercent);
                gpuRing.style.strokeDasharray = `${(gpuUsedPercent / 100 * 163.36).toFixed(2)} 163.36`;
            }
            if (gpuPercent) gpuPercent.textContent = `${gpuUsedPercent.toFixed(0)}%`;
            if (gpuValue) {
                const gpuTotal = node.resources?.totalGpu || 0;
                gpuValue.textContent = `${gpuTotal} 个`;
            }
        }

        // 更新任务标签
        const tasks = node.tasks || [];
        const tasksContainer = card.querySelector('.node-tasks');
        if (tasks.length > 0) {
            if (!tasksContainer) {
                // 如果任务容器不存在，创建它
                const resourcesDiv = card.querySelector('.node-resources');
                if (resourcesDiv) {
                    const newTasksDiv = document.createElement('div');
                    newTasksDiv.className = 'node-tasks';
                    newTasksDiv.innerHTML = `
                        <span class="tasks-label"><i class="fas fa-tasks"></i> 任务:</span>
                        ${tasks.map(task => `<span class="task-badge">${task}</span>`).join('')}
                    `;
                    resourcesDiv.insertAdjacentElement('afterend', newTasksDiv);
                }
            } else {
                // 更新现有任务
                const taskBadges = tasks.map(task => `<span class="task-badge">${task}</span>`).join('');
                const existingBadges = Array.from(tasksContainer.querySelectorAll('.task-badge'))
                    .map(b => b.textContent).join(',');
                const newBadges = tasks.join(',');
                
                if (existingBadges !== newBadges) {
                    tasksContainer.innerHTML = `
                        <span class="tasks-label"><i class="fas fa-tasks"></i> 任务:</span>
                        ${taskBadges}
                    `;
                }
            }
        } else if (tasksContainer) {
            // 如果没有任务了，移除容器
            tasksContainer.remove();
        }
    }

    // 创建节点卡片
    createNodeCard(node) {
        const card = document.createElement('div');
        card.className = 'cluster-node-card';
        
        // 添加节点ID作为data属性,用于后续的增量更新
        const nodeId = node.nodeId || node.nodeIp;
        card.dataset.nodeId = nodeId;
        
        const isAlive = node.status === 'active';
        const statusClass = isAlive ? 'alive' : 'dead';
        const statusText = isAlive ? '在线' : '离线';
        
        // 获取资源数据
        const resources = node.resources || {};
        const cpuTotal = resources.totalCpu || 0;
        const memoryTotal = resources.totalMemory || 0;
        const gpuTotal = resources.totalGpu || 0;
        
        // 获取资源使用率(来自Ray Dashboard的真实数据)
        const cpuUsedPercent = node.cpu || 0;
        const memUsedPercent = node.memory || 0;
        const gpuUsedPercent = node.gpu || 0;
        
        // 连接类型
        const connectionType = node.connectionType === 'wired' ? 'Wired' : 
                               node.connectionType === 'wireless' ? 'Wireless' : 'Unknown';
        const nodeType = node.isHeadNode ? 'Head' : 'Worker';
        
        // 任务信息
        const tasks = node.tasks || [];
        
        card.innerHTML = `
            <div class="node-header">
                <h4 class="node-title">${node.name || node.nodeIp || 'Unknown Node'}</h4>
                <span class="node-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="node-status-indicators">
                <div class="status-indicator" data-status="idle" title="正常运行">
                    <div class="status-light idle"></div>
                    <span class="status-label">正常运行</span>
                </div>
                <div class="status-indicator" data-status="detecting" title="检测中">
                    <div class="status-light detecting"></div>
                    <span class="status-label">检测中</span>
                </div>
                <div class="status-indicator" data-status="sending" title="服务端检测中">
                    <div class="status-light sending"></div>
                    <span class="status-label">服务端检测中</span>
                </div>
            </div>
            <div class="node-info">
                <div class="info-item">
                    <span class="info-label"><i class="fas fa-network-wired"></i> 连接</span>
                    <span class="info-value">${connectionType}</span>
                </div>
                <div class="info-item">
                    <span class="info-label"><i class="fas fa-server"></i> 类型</span>
                    <span class="info-value">${nodeType}</span>
                </div>
            </div>
            <div class="node-resources">
                <div class="resource-card-grid">
                    <div class="resource-card">
                        <div class="resource-card-icon"><i class="fas fa-microchip"></i></div>
                        <div class="resource-card-content">
                            <div class="resource-card-label">CPU</div>
                            <div class="resource-card-value">${cpuTotal.toFixed(0)} 核</div>
                            <div class="resource-progress-ring" data-progress="${cpuUsedPercent}">
                                <svg class="progress-ring" width="60" height="60">
                                    <circle class="progress-ring-bg" cx="30" cy="30" r="26" />
                                    <circle class="progress-ring-fill" cx="30" cy="30" r="26" 
                                        style="stroke: ${this.getUsageColor(cpuUsedPercent)}; 
                                               stroke-dasharray: ${(cpuUsedPercent / 100 * 163.36).toFixed(2)} 163.36" />
                                </svg>
                                <div class="progress-percentage">${cpuUsedPercent.toFixed(0)}%</div>
                            </div>
                        </div>
                    </div>
                    <div class="resource-card">
                        <div class="resource-card-icon"><i class="fas fa-memory"></i></div>
                        <div class="resource-card-content">
                            <div class="resource-card-label">内存</div>
                            <div class="resource-card-value">${memoryTotal.toFixed(1)} GB</div>
                            <div class="resource-progress-ring" data-progress="${memUsedPercent}">
                                <svg class="progress-ring" width="60" height="60">
                                    <circle class="progress-ring-bg" cx="30" cy="30" r="26" />
                                    <circle class="progress-ring-fill" cx="30" cy="30" r="26" 
                                        style="stroke: ${this.getUsageColor(memUsedPercent)}; 
                                               stroke-dasharray: ${(memUsedPercent / 100 * 163.36).toFixed(2)} 163.36" />
                                </svg>
                                <div class="progress-percentage">${memUsedPercent.toFixed(0)}%</div>
                            </div>
                        </div>
                    </div>
                    ${gpuTotal > 0 ? `
                    <div class="resource-card">
                        <div class="resource-card-icon"><i class="fas fa-cube"></i></div>
                        <div class="resource-card-content">
                            <div class="resource-card-label">GPU</div>
                            <div class="resource-card-value">${gpuTotal} 个</div>
                            <div class="resource-progress-ring" data-progress="${gpuUsedPercent}">
                                <svg class="progress-ring" width="60" height="60">
                                    <circle class="progress-ring-bg" cx="30" cy="30" r="26" />
                                    <circle class="progress-ring-fill" cx="30" cy="30" r="26" 
                                        style="stroke: ${this.getUsageColor(gpuUsedPercent)}; 
                                               stroke-dasharray: ${(gpuUsedPercent / 100 * 163.36).toFixed(2)} 163.36" />
                                </svg>
                                <div class="progress-percentage">${gpuUsedPercent.toFixed(0)}%</div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            ${tasks.length > 0 ? `
            <div class="node-tasks">
                <span class="tasks-label"><i class="fas fa-tasks"></i> 任务:</span>
                ${tasks.map(task => `<span class="task-badge">${task}</span>`).join('')}
            </div>
            ` : ''}
        `;
        
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
                return `${diffDays}天${diffHours % 24}小时`;
        } else {
                return `${diffHours}小时`;
        }
    }

    // 显示空状态
    showEmptyState(message = '正在加载集群数据...') {
        const nodesGrid = document.getElementById('cluster-nodes-grid');
        if (!nodesGrid) return;

        nodesGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fas fa-server"></i>
                </div>
                <div class="empty-state-title">暂无集群数据</div>
                <div class="empty-state-description">${message}</div>
            </div>
        `;
    }

    // 更新连接状态
    updateConnectionStatus(status) {
        const statusElement = document.querySelector('.cluster-status-indicator');
        if (statusElement) {
            statusElement.className = `cluster-status-indicator ${status}`;
            statusElement.innerHTML = `
                <div class="status-dot"></div>
                <span>${status === 'connected' ? '已连接' : '未连接'}</span>
            `;
        }
    }

    // 更新节点工作状态指示灯
    updateWorkStatus(card, workStatus) {
        // workStatus: 'idle', 'detecting', 'sending'
        const indicators = card.querySelectorAll('.status-indicator');
        
        indicators.forEach(indicator => {
            const status = indicator.dataset.status;
            const light = indicator.querySelector('.status-light');
            
            if (status === workStatus) {
                indicator.classList.add('active');
                light.classList.add('active');
            } else {
                indicator.classList.remove('active');
                light.classList.remove('active');
            }
        });
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
        // 注意：当前 CastRay 后端不支持集群重启功能
        console.warn('Cluster restart is not supported by the current backend');
        alert('集群重启功能当前不可用');
        // 如需实现，请在 CastRay 后端添加 /api/cluster/restart 端点
    }

    // 停止集群
    async stopCluster() {
        // 注意：当前 CastRay 后端不支持集群停止功能
        console.warn('Cluster stop is not supported by the current backend');
        alert('集群停止功能当前不可用');
        // 如需实现，请在 CastRay 后端添加 /api/cluster/stop 端点
    }

    // 显示文件传输模态框
    showFileTransferModal() {
        const modal = document.getElementById('file-transfer-modal');
        if (!modal) return;

        // 填充节点选择器
        this.populateNodeSelectors();

        // 显示模态框
        modal.style.display = 'flex';
    }

    // 隐藏文件传输模态框
    hideFileTransferModal() {
        const modal = document.getElementById('file-transfer-modal');
        if (modal) {
            modal.style.display = 'none';
        }

        // 清空表单
        const form = document.getElementById('file-transfer-form');
        if (form) form.reset();

        // 清空状态
        const statusDiv = document.getElementById('transfer-status');
        if (statusDiv) statusDiv.innerHTML = '';
    }

    // 填充节点选择器
    populateNodeSelectors() {
        const sourceSelect = document.getElementById('source-node');
        const targetSelect = document.getElementById('target-node');

        if (!sourceSelect || !targetSelect) return;

        // 清空现有选项
        sourceSelect.innerHTML = '<option value="">-- 选择源节点 --</option>';
        targetSelect.innerHTML = '<option value="">-- 选择目标节点 --</option>';

        // 添加节点选项（只显示运行中的节点）
        const runningNodes = this.nodes.filter(n => n.status === 'active');
        runningNodes.forEach(node => {
            const nodeId = node.nodeIp || node.nodeId || node.name;
            const displayName = node.name ? `${node.name} (${node.nodeIp})` : nodeId;
            
            const option1 = document.createElement('option');
            option1.value = nodeId;
            option1.textContent = displayName;
            sourceSelect.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = nodeId;
            option2.textContent = displayName;
            targetSelect.appendChild(option2);
        });
    }

    // 提交文件传输
    async submitFileTransfer() {
        const sourceNode = document.getElementById('source-node')?.value;
        const targetNode = document.getElementById('target-node')?.value;
        const filePath = document.getElementById('file-path')?.value;
        const transferMode = document.getElementById('transfer-mode')?.value || 'direct';

        // 验证输入
        if (!sourceNode || !targetNode || !filePath) {
            this.showTransferStatus('请填写所有必填字段', 'error');
            return;
        }

        if (sourceNode === targetNode) {
            this.showTransferStatus('源节点和目标节点不能相同', 'error');
            return;
        }

        // 显示加载状态
        this.showTransferStatus('正在发起文件传输...', 'info');

        try {
            const response = await fetch(`${this.backendUrl}/api/file-transfers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source_node: sourceNode,
                    target_node: targetNode,
                    file_path: filePath,
                    transfer_mode: transferMode
                })
            });

            if (!response.ok) {
                throw new Error(`传输请求失败: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success || result.transfer_id) {
                this.showTransferStatus('文件传输已启动！', 'success');
                
                // 如果有 transfer_id，可以监控传输状态
                if (result.transfer_id) {
                    setTimeout(() => {
                        this.showTransferStatus(`传输ID: ${result.transfer_id}`, 'info');
                    }, 1500);
                }

                // 3秒后关闭模态框
                setTimeout(() => {
                    this.hideFileTransferModal();
                }, 3000);
            } else {
                this.showTransferStatus(result.message || '传输启动失败', 'error');
            }
        } catch (error) {
            console.error('File transfer error:', error);
            this.showTransferStatus(`错误: ${error.message}`, 'error');
        }
    }

    // 显示传输状态
    showTransferStatus(message, type = 'info') {
        const statusDiv = document.getElementById('transfer-status');
        if (!statusDiv) return;

        const iconMap = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle'
        };

        statusDiv.innerHTML = `
            <div class="transfer-status-message ${type}">
                <i class="fas ${iconMap[type] || 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
    }

    // 根据使用率获取颜色
    getUsageColor(percent) {
        if (percent < 30) return '#4caf50'; // 绿色 - 低使用率
        if (percent < 60) return '#2196f3'; // 蓝色 - 中等使用率
        if (percent < 80) return '#ff9800'; // 橙色 - 高使用率
        return '#f44336'; // 红色 - 非常高使用率
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
